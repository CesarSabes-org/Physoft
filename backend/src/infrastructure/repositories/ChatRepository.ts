import { randomUUID } from 'crypto'
import { ChatConversation, ChatTurn, Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../prismaClient'
import { ChatError, ChatMode } from '../../domain/types/chat'

export type ConversationDetail = ChatConversation & { turns: ChatTurn[] }
const missing = () => new ChatError(404, 'CHAT_NOT_FOUND', 'Conversation not found.')

export class ChatRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(userId: string, id: string, mode: ChatMode) {
    // Client-generated UUID makes creation safe to retry after a network failure.
    await this.db.chatConversation.createMany({ data: [{ id, userId, mode }], skipDuplicates: true })
    const conversation = await this.get(userId, id)
    if (conversation.mode !== mode) throw new ChatError(409, 'FOCUS_LOCKED', 'The focus is fixed for this conversation.')
    return conversation
  }

  list(userId: string) {
    return this.db.chatConversation.findMany({
      where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, title: true, mode: true, createdAt: true, updatedAt: true },
    })
  }

  async get(userId: string, id: string): Promise<ConversationDetail> {
    const owned = await this.db.chatConversation.findFirst({ where: { id, userId } })
    if (!owned) throw missing()
    await this.db.chatTurn.updateMany({
      where: { conversationId: id, status: 'pending', leaseExpiresAt: { lte: new Date() } },
      data: { status: 'failed', errorCode: 'INTERRUPTED' },
    })
    const result = await this.db.chatConversation.findFirst({
      where: { id, userId }, include: { turns: { orderBy: { sequence: 'asc' } } },
    })
    if (!result) throw missing()
    return result
  }

  async delete(userId: string, id: string) {
    const result = await this.db.chatConversation.deleteMany({ where: { id, userId } })
    if (!result.count) throw missing()
  }

  private async lock(tx: Prisma.TransactionClient, userId: string, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "chat_conversations" WHERE "id" = ${id} AND "userId" = ${userId} FOR UPDATE`
    if (!rows.length) throw missing()
  }

  async begin(userId: string, id: string, requestId: string, prompt: string) {
    return this.db.$transaction(async tx => {
      await this.lock(tx, userId, id)
      const conversation = await tx.chatConversation.findUniqueOrThrow({ where: { id } })
      const existing = await tx.chatTurn.findUnique({ where: { conversationId_requestId: { conversationId: id, requestId } } })
      if (existing && existing.prompt !== prompt) throw new ChatError(409, 'REQUEST_CONFLICT', 'This request ID already belongs to another question.')
      if (existing?.status === 'completed') return { conversation, turn: existing, cached: true }
      const latest = await tx.chatTurn.findFirst({ where: { conversationId: id }, orderBy: { sequence: 'desc' } })
      if (existing && latest?.id !== existing.id) throw new ChatError(409, 'TURN_NOT_LATEST', 'Only the latest unanswered question can be retried.')
      const now = new Date()
      const running = await tx.chatTurn.findFirst({ where: { conversationId: id, status: 'pending', leaseExpiresAt: { gt: now } } })
      if (running) throw new ChatError(409, 'CHAT_BUSY', 'A reply is already in progress. Please wait and reopen this chat.')
      await tx.chatTurn.updateMany({ where: { conversationId: id, status: 'pending' }, data: { status: 'failed', errorCode: 'INTERRUPTED' } })
      const claim = { status: 'pending', errorCode: null, attemptId: randomUUID(), leaseExpiresAt: new Date(Date.now() + 65000) }
      const turn = existing
        ? await tx.chatTurn.update({ where: { id: existing.id }, data: claim })
        : await tx.chatTurn.create({ data: { ...claim, conversationId: id, requestId, prompt, sequence: conversation.nextSequence } })
      await tx.chatConversation.update({ where: { id }, data: {
        nextSequence: existing ? undefined : { increment: 1 },
        title: conversation.nextSequence === 0 ? prompt.slice(0, 80) : undefined,
        updatedAt: now,
      } })
      return { conversation, turn, cached: false }
    })
  }

  async finish(turn: ChatTurn, answer: string | null, truncated: boolean, status: string, errorCode: string | null = null) {
    // An expired/superseded worker may never overwrite a later attempt.
    await this.db.$transaction(async tx => {
      const result = await tx.chatTurn.updateMany({ where: { id: turn.id, attemptId: turn.attemptId, status: 'pending' }, data: { answer, truncated, status, errorCode } })
      if (result.count) await tx.chatConversation.updateMany({ where: { id: turn.conversationId }, data: { updatedAt: new Date() } })
    })
  }

  async completedHistory(id: string, beforeSequence: number) {
    return this.db.chatTurn.findMany({ where: { conversationId: id, status: 'completed', sequence: { lt: beforeSequence } }, orderBy: { sequence: 'desc' }, take: 10 })
  }
}

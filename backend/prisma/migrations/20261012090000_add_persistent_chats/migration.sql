CREATE TABLE "chat_conversations" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'New conversation',
  "nextSequence" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_mode_check" CHECK ("mode" IN ('general','interpret_results','explain_concepts','protocol_guidance','performance_advice'))
);
CREATE TABLE "chat_turns" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "answer" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "truncated" BOOLEAN NOT NULL DEFAULT false,
  "errorCode" TEXT,
  "attemptId" TEXT NOT NULL,
  "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_turns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_status_check" CHECK ("status" IN ('pending','completed','failed','cancelled'))
);
CREATE INDEX "chat_conversations_userId_updatedAt_idx" ON "chat_conversations"("userId", "updatedAt");
CREATE UNIQUE INDEX "chat_turns_conversationId_requestId_key" ON "chat_turns"("conversationId", "requestId");
CREATE UNIQUE INDEX "chat_turns_conversationId_sequence_key" ON "chat_turns"("conversationId", "sequence");
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_turns" ADD CONSTRAINT "chat_turns_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

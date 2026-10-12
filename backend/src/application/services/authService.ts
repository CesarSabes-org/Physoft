// ============================================
// SERVICE: Auth - Application Layer
// ============================================
// Login, password changes, and safe first-run admin bootstrap.
// Always resolves user identity against the database — never a
// hardcoded credential check.
// ============================================

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'
import { prisma } from '../../infrastructure/prismaClient'

const BCRYPT_SALT_ROUNDS = 10

export interface JwtPayload {
  id: string
  email: string
  role: UserRole
}

export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

function toAuthUser(user: { id: string; email: string; role: UserRole }): AuthUser {
  return { id: user.id, email: user.email, role: user.role }
}

function signToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions)
}

export class AuthService {
  /**
   * Validates credentials against the database. Returns null for both
   * "no such user" and "wrong password" so callers can't distinguish
   * which one it was.
   */
  static async login(email: string, password: string): Promise<{ token: string; user: AuthUser } | null> {
    const normalizedEmail = email.trim().toLowerCase()

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user) {
      return null
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatches) {
      return null
    }

    const authUser = toAuthUser(user)
    const token = signToken({ id: authUser.id, email: authUser.email, role: authUser.role })

    return { token, user: authUser }
  }

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!currentMatches) {
      return { success: false, error: 'Current password is incorrect' }
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } })

    return { success: true }
  }

}

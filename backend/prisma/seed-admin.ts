import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Explicit configuration only: no known fallback password in production.
// Normal runs never reset an existing account; --reset-password is opt-in.
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password || password.length < 8) throw new Error('Configure ADMIN_EMAIL and ADMIN_PASSWORD (at least 8 characters).')
  const db = new PrismaClient()
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const reset = process.argv.includes('--reset-password')
    await db.user.upsert({ where: { email },
      create: { email, passwordHash, role: 'ADMIN' },
      update: reset ? { passwordHash, role: 'ADMIN' } : {},
    })
    console.log(`Admin ${email}: ${reset ? 'credentials updated' : 'ready (existing password preserved)'}.`)
  } finally { await db.$disconnect() }
}
main().catch(() => {
  console.error('Admin seed failed. Check database access, the users migration and ADMIN_EMAIL / ADMIN_PASSWORD.')
  process.exitCode = 1
})

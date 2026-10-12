// ============================================
// PRISMA CLIENT - Infraestructura
// ============================================
// Cliente único de Prisma para toda la aplicación
// Evita múltiples instancias en desarrollo (hot-reload)
// ============================================

import { PrismaClient } from '@prisma/client'

// Prevenir múltiples instancias en desarrollo
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    // Query logging can disclose persisted conversations and password hashes.
    log: [],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Add connection pool and timeout configuration
    // These are typically configured via the connection string or environment variables
    // For explicit configuration in PrismaClient, it's usually done via `datasource` block in schema.prisma
    // or by appending parameters to the DATABASE_URL.
    // However, if the user intends to add them directly here, it would look like:
    // prisma: {
    //   log: ['query', 'error', 'warn'],
    //   errorFormat: 'pretty',
    //   // connection pool settings are usually part of the connection string
    //   // or handled by the underlying driver.
    //   // For example, `?connection_limit=10&pool_timeout=60` in the DATABASE_URL
    // },
  })
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export default prisma

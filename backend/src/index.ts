// ============================================
// SERVIDOR PRINCIPAL - Physoft Backend
// ============================================
// Express + TypeScript + Prisma
// Servidor API REST para análisis deportivo
// ============================================

import express, { Application, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import athleteRoutes from './presentation/routes/athleteRoutes'
import analysisRoutes from './presentation/routes/analysisRoutes'
import claudeRoutes from './presentation/routes/claudeRoutes'
import authRoutes from './presentation/routes/authRoutes'
import chatRoutes from './presentation/routes/chatRoutes'
// TEMPORARILY DISABLED - Authentication paused until production infrastructure is available.
// `authenticate` is unused in this file while the three route mounts below go unprotected.
// The middleware itself is untouched at ./middleware/authenticate.ts — re-import it here to re-enable.
// import { authenticate } from './middleware/authenticate'
import { AuthService } from './application/services/authService'

// Load environment variables
dotenv.config()

const app: Application = express()
const PORT = process.env.PORT || 3000

// Trust the first proxy hop (Vercel) so express-rate-limit and req.ip see
// the real client IP instead of bucketing every user together.
app.set('trust proxy', 1)

// ============================================
// MIDDLEWARES
// ============================================

// CORS - MUST be before other middleware
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:4173', 'file://'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
}
app.use(cors(corsOptions))

// Health check endpoint (for Electron)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Backend is running' })
})

// HTTP headers security (after CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))

// Chat owns its smaller JSON limit and authentication; it does not read patient data.
app.use('/api/chat', chatRoutes)

// JSON parser
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// HTTP request logger
app.use(morgan('dev'))

// Serve static files (for uploaded images) - AFTER CORS
app.use('/uploads', express.static('public/uploads'))

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/api/ping', (_req: Request, res: Response) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() })
})

// Ensure the initial admin user exists before any route handles a request.
// Runs once per cold start; on warm invocations the promise is already
// resolved so this is a no-op microtask. Kept after /api/health and
// /api/ping so uptime checks don't depend on it succeeding.
const adminBootstrapPromise = AuthService.bootstrapAdminUser()
app.use((_req: Request, _res: Response, next: NextFunction) => {
  adminBootstrapPromise.then(() => next())
})

// Auth routes (public)
app.use('/api/auth', authRoutes)

// TEMPORARILY DISABLED - Authentication paused until production infrastructure is available.
// `authenticate` removed from the three mounts below so the API behaves exactly as it did
// before this feature. To re-enable, restore `authenticate,` as the second argument to each
// app.use() call (see git history / imperative-sauteeing-sedgewick plan for the original code).

// Athlete routes
app.use('/api/athletes', athleteRoutes)

// Analysis routes
app.use('/api/analyses', analysisRoutes)

// Claude (AI Textual Analysis) routes
app.use('/api/claude', claudeRoutes)

// 404 route
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: _req.path,
  })
})

// ============================================
// MANEJO DE ERRORES GLOBAL
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
})

// ============================================
// INICIAR SERVIDOR
// ============================================

// Solo iniciar el servidor si no está en modo serverless (Vercel)
if (process.env.VERCEL !== '1') {
  const databaseUrl = process.env.DATABASE_URL
  const safeDatabaseUrl = databaseUrl
    ? databaseUrl.replace(/(postgresql:\/\/[^:]+:)[^@]+@/, '$1****@')
    : 'not configured'

  app.listen(PORT, () => {
    console.log('========================================')
    console.log('   🚀 Physoft Backend API')
    console.log('========================================')
    console.log(`✓ Servidor corriendo en http://localhost:${PORT}`)
    console.log(`✓ Entorno: ${process.env.NODE_ENV || 'development'}`)
    console.log(`✓ Base de datos: ${safeDatabaseUrl}`)
    console.log('========================================')
  })
}

// Export para Vercel Serverless
export default app

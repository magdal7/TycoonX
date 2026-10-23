import 'dotenv/config'
import 'express-async-errors'
import express, { Application } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { prisma } from './lib/prisma'
import { installErrorHandling } from './lib/errorHandling'
import authRoutes from './routes/auth'
import ceoRoutes from './routes/ceo'
import { createGameCeoRouter } from './routes/game/ceos'
import { createGameProductionRouter } from './routes/game/production'
import { createGameProgressionRouter } from './routes/game/progression'
import { createGameWithdrawalRouter } from './routes/game/withdrawals'
import { createGameSpecialTaskRouter } from './routes/game/specialTasks'
import { createGameWalletRouter } from './routes/game/wallet'
import { createPaymentRouter } from './routes/payments'
import { createAdminWithdrawalRouter } from './routes/admin/withdrawals'
import { createAdminSpecialTaskRouter } from './routes/admin/specialTasks'
import { createAdminUserRouter } from './routes/admin/users'
import { createAdminCatalogRouter } from './routes/admin/catalog'
import { createAdminEconomyRouter } from './routes/admin/economy'
import { createAdminSettingsRouter } from './routes/admin/settings'
import { createAdminReferralRouter } from './routes/admin/referrals'
import { createAdminPaymentRouter } from './routes/admin/payments'
import { createPublicRouter } from './routes/public'
import { requireAuth, requireAdmin } from './middleware/auth'

const app: Application = express()
const PORT = Number(process.env.PORT) || 4000
const isProduction = process.env.NODE_ENV === 'production'

// Strict CORS: credentials are only allowed for explicitly allowlisted browser
// origins. Requests without an Origin header (same-origin, curl, server-to-server)
// are always permitted. Development mirrors any origin for local tooling.
const corsAllowlist = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0 && value !== '*')
if (isProduction && corsAllowlist.length === 0) {
  console.warn(
    '[security] CORS_ORIGINS is empty in production; cross-origin browser requests will be blocked.'
  )
}

// Trust proxy is deployment-specific and opt-in only: set TRUST_PROXY to the
// number of proxy hops (e.g. 1 behind a single reverse proxy) or an Express
// trust-proxy string such as "loopback". Left unset, Express uses its default
// (no trusted proxy). This avoids assuming any particular host or edge topology.
const trustProxy = process.env.TRUST_PROXY
if (trustProxy !== undefined && trustProxy.trim() !== '') {
  const hops = Number(trustProxy)
  app.set('trust proxy', Number.isInteger(hops) && hops >= 0 ? hops : trustProxy.trim())
}

app.disable('x-powered-by')

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (!isProduction || corsAllowlist.includes(origin)) return cb(null, true)
      return cb(null, false)
    },
    credentials: true,
  })
)
app.use(cookieParser())

// Payment gateway callbacks must read the exact raw request body for HMAC
// verification, so this router is mounted BEFORE the JSON body parser and parses
// the body itself.
app.use('/api/payments', createPaymentRouter(prisma))

app.use(express.json())

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true })
app.use('/api/auth', authLimiter)

app.use('/api/auth', authRoutes)

app.use('/api/ceos', ceoRoutes)

const gameLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true })
app.use('/api/game', gameLimiter, createGameCeoRouter(prisma))
app.use('/api/game', gameLimiter, createGameProductionRouter(prisma))
app.use('/api/game', gameLimiter, createGameProgressionRouter(prisma))
app.use('/api/game', gameLimiter, createGameWithdrawalRouter(prisma))
app.use('/api/game', gameLimiter, createGameSpecialTaskRouter(prisma))
app.use('/api/game', gameLimiter, createGameWalletRouter(prisma))

app.use('/api/public', createPublicRouter(prisma))
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 240, standardHeaders: true })
app.use('/api/admin', adminLimiter, createAdminWithdrawalRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminSpecialTaskRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminUserRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminCatalogRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminEconomyRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminSettingsRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminReferralRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminPaymentRouter(prisma))

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('db timeout')), ms))])

app.get('/api/health', async (_req, res) => {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 5000)
    res.json({ status: 'ok', service: 'tycoonx-server', database: 'connected' })
  } catch {
    res.status(503).json({ status: 'degraded', service: 'tycoonx-server', database: 'disconnected' })
  }
})

app.get('/api/admin/ping', requireAuth, requireAdmin, (_req, res) => {
  res.json({ ok: true })
})

// Terminal error handling: async route rejections are forwarded here (via
// express-async-errors) and answered with JSON instead of terminating the
// process. Registered after every route; safe to log only non-sensitive names.
installErrorHandling(app)

// Last-resort process safety net: never let a stray rejected promise take the
// API down. Route errors are handled above; this only guards the unexpected.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection: ' + (reason instanceof Error ? reason.name : typeof reason))
})

app.listen(PORT, () => {
  console.log(`TycoonX server listening on http://localhost:${PORT}`)
})

import 'dotenv/config'
import express, { Application } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { prisma } from './lib/prisma'
import authRoutes from './routes/auth'
import ceoRoutes from './routes/ceo'
import { createGameCeoRouter } from './routes/game/ceos'
import { createGameProductionRouter } from './routes/game/production'
import { createGameProgressionRouter } from './routes/game/progression'
import { createGameWithdrawalRouter } from './routes/game/withdrawals'
import { createGameSpecialTaskRouter } from './routes/game/specialTasks'
import { createAdminWithdrawalRouter } from './routes/admin/withdrawals'
import { createAdminSpecialTaskRouter } from './routes/admin/specialTasks'
import { createAdminUserRouter } from './routes/admin/users'
import { createAdminCatalogRouter } from './routes/admin/catalog'
import { createAdminEconomyRouter } from './routes/admin/economy'
import { createAdminSettingsRouter } from './routes/admin/settings'
import { createAdminReferralRouter } from './routes/admin/referrals'
import { createPublicRouter } from './routes/public'
import { requireAuth, requireAdmin } from './middleware/auth'

const app: Application = express()
const PORT = Number(process.env.PORT) || 4000

app.use(
  cors({
    origin: (origin, cb) => cb(null, origin || '*'),
    credentials: true,
  })
)
app.use(cookieParser())
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

app.use('/api/public', createPublicRouter(prisma))
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 240, standardHeaders: true })
app.use('/api/admin', adminLimiter, createAdminWithdrawalRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminSpecialTaskRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminUserRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminCatalogRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminEconomyRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminSettingsRouter(prisma))
app.use('/api/admin', adminLimiter, createAdminReferralRouter(prisma))

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

app.listen(PORT, () => {
  console.log(`TycoonX server listening on http://localhost:${PORT}`)
})

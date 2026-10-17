import express, { Application } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { prisma } from './lib/prisma'
import authRoutes from './routes/auth'
import ceoRoutes from './routes/ceo'
import { requireAuth, requireAdmin } from './middleware/auth'

dotenv.config()

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

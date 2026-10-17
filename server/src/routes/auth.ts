import { Router, Response } from 'express'
import { registerSchema, loginSchema } from '../validation/auth'
import { hashPassword, comparePassword, signToken } from '../lib/auth'
import { prisma } from '../lib/prisma'
import { AuthRequest, requireAuth } from '../middleware/auth'

const router = Router()

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

router.post('/register', async (req: AuthRequest, res: Response) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
  const { email, username, password } = parsed.data
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } })
  if (existing) return res.status(409).json({ error: 'user already exists' })
  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: { email, username, passwordHash },
    select: { id: true, email: true, username: true, role: true },
  })
  res.cookie('token', signToken({ sub: user.id, email: user.email, role: user.role }), cookieOpts)
  res.status(201).json({ user })
})

router.post('/login', async (req: AuthRequest, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await comparePassword(password, user.passwordHash)))
    return res.status(401).json({ error: 'invalid credentials' })
  res.cookie('token', signToken({ sub: user.id, email: user.email, role: user.role }), cookieOpts)
  res.json({ user: { id: user.id, email: user.email, username: user.username, role: user.role } })
})

router.post('/logout', (_req, res: Response) => {
  res.clearCookie('token', { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user })
})

export default router

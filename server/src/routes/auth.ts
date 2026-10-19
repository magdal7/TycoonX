import { Router, Response } from 'express'
import { loginSchema } from '../validation/auth'
import { registerWithReferralSchema } from '../validation/game'
import { hashPassword, comparePassword, signToken } from '../lib/auth'
import { POLICY_VERSIONS } from '../lib/policies'
import { prisma } from '../lib/prisma'
import { AuthRequest, requireAuth } from '../middleware/auth'
import { findRegistrationConflict } from '../services/registration'
import { attributeReferral } from '../services/referral'

const router = Router()

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

router.post('/register', async (req: AuthRequest, res: Response) => {
  const parsed = registerWithReferralSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
  const { email, username, password, ref } = parsed.data
  const conflict = await findRegistrationConflict(prisma, { email, username })
  if (conflict) return res.status(409).json({ error: 'user already exists' })
  const passwordHash = await hashPassword(password)
  // Create the account and its policy consent atomically. The recorded policy
  // versions are server-authoritative and the timestamp is the DB acceptance time.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true, role: true },
    })
    await tx.policyConsent.create({
      data: {
        userId: created.id,
        termsVersion: POLICY_VERSIONS.terms,
        privacyVersion: POLICY_VERSIONS.privacy,
      },
    })
    return created
  })
  // Referral attribution only; rewards remain disabled pending approved qualification.
  if (ref) {
    try {
      await attributeReferral(prisma, {
        referredUserId: user.id,
        referredUsername: user.username,
        code: ref,
      })
    } catch {
      /* attribution must never block registration */
    }
  }
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

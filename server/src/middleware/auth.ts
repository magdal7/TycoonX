import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/auth'
import { prisma } from '../lib/prisma'

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token
  if (!token) return res.status(401).json({ error: 'unauthenticated' })
  try {
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    })
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    req.user = { id: user.id, email: user.email, role: user.role }
    next()
  } catch {
    res.status(401).json({ error: 'unauthenticated' })
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' })
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' })
  next()
}

import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { getLeaderboard, getPublicProfile } from '../services/leaderboard'
import { getSiteSettings } from '../services/siteSettings'
import { toPublicSettings } from '../lib/siteSettings'
import { usernameParamSchema } from '../validation/game'

/** Public, read-only endpoints. No private data (no email, balances, referrals). */
export function createPublicRouter(db: PrismaClient): Router {
  const router = Router()

  router.get('/settings', async (_req, res: Response) => {
    res.json(toPublicSettings(await getSiteSettings(db)))
  })

  router.get('/leaderboard', async (_req, res: Response) => {
    res.json({ entries: await getLeaderboard(db, 100) })
  })

  router.get('/profile/:username', async (req, res: Response) => {
    const parsed = usernameParamSchema.safeParse(req.params)
    if (!parsed.success) return res.status(400).json({ error: 'invalid username' })
    const profile = await getPublicProfile(db, parsed.data.username)
    if (!profile) return res.status(404).json({ error: 'profile not found' })
    res.json(profile)
  })

  return router
}

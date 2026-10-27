import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { getLeaderboard, getPublicProfile } from '../services/leaderboard'
import { getSiteSettings } from '../services/siteSettings'
import { toPublicSettings } from '../lib/siteSettings'
import { runtimeCapabilities } from '../lib/paymentAccess'
import { usernameParamSchema } from '../validation/game'

/** Public, read-only endpoints. No private data (no email, balances, referrals). */
export function createPublicRouter(db: PrismaClient): Router {
  const router = Router()

  router.get('/settings', async (_req, res: Response) => {
    res.json({ ...toPublicSettings(await getSiteSettings(db)), capabilities: runtimeCapabilities() })
  })

  router.get('/leaderboard', async (_req, res: Response) => {
    res.json({ entries: await getLeaderboard(db, 100) })
  })

  // Public catalog preview: display fields only (no admin/economy internals).
  router.get('/ceos', async (_req, res: Response) => {
    const rows = await db.cEO.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      take: 12,
      select: {
        id: true,
        name: true,
        slug: true,
        rarity: true,
        priceUsd: true,
        nominalSpPer24h: true,
        lifetimeCapSp: true,
        cycleHours: true,
        isForSale: true,
        imageUrl: true,
      },
    })
    res.json({
      ceos: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        rarity: c.rarity,
        priceUsd: c.priceUsd.toString(),
        nominalSpPer24h: c.nominalSpPer24h,
        lifetimeCapSp: c.lifetimeCapSp?.toString() ?? null,
        cycleHours: c.cycleHours,
        isForSale: c.isForSale,
        imageUrl: c.imageUrl ?? null,
      })),
    })
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

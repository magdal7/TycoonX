import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAdmin, requireAuth } from '../../middleware/auth'
import { getEconomyOverview } from '../../services/adminEconomy'

/** Admin economy monitoring: SP totals, ledger, production stats, suspicious activity. */
export function createAdminEconomyRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth, requireAdmin)

  router.get('/economy', async (_req: AuthRequest, res: Response) => {
    try {
      res.json(await getEconomyOverview(db))
    } catch (error) {
      console.error('[admin/economy] unexpected error:', error)
      res.status(500).json({ error: 'internal error' })
    }
  })

  return router
}

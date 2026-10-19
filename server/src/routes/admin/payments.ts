import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAdmin, requireAuth } from '../../middleware/auth'
import { listPaymentIntentsAdmin } from '../../services/payments'
import { listPurchasesAdmin } from '../../services/purchases'

/** Admin view of payments (deposit invoices) and CEO purchases. Payouts disabled. */
export function createAdminPaymentRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth, requireAdmin)

  router.get('/payments', async (req: AuthRequest, res: Response) => {
    const status = typeof req.query.status === 'string' ? (req.query.status as never) : undefined
    res.json({
      payments: await listPaymentIntentsAdmin(db, status ? { status } : {}),
      paymentsEnabled: false,
    })
  })

  router.get('/purchases', async (req: AuthRequest, res: Response) => {
    const status = typeof req.query.status === 'string' ? (req.query.status as never) : undefined
    res.json({
      purchases: await listPurchasesAdmin(db, status ? { status } : {}),
      paymentsEnabled: false,
    })
  })

  return router
}

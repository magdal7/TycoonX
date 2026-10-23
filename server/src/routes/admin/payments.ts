import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAdmin, requireAuth } from '../../middleware/auth'
import { PaymentError, listPaymentIntentsAdmin, reconcileDepositIntent } from '../../services/payments'
import { OxapayError, loadOxapayConfig } from '../../services/oxapay'
import { listPurchasesAdmin } from '../../services/purchases'
import { isPaymentsEnabled } from '../../lib/payments'
import { idParamSchema } from '../../validation/game'

/** Admin view of payments (deposit invoices) and CEO purchases. Payouts disabled. */
export function createAdminPaymentRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth, requireAdmin)

  router.get('/payments', async (req: AuthRequest, res: Response) => {
    const status = typeof req.query.status === 'string' ? (req.query.status as never) : undefined
    res.json({
      payments: await listPaymentIntentsAdmin(db, status ? { status } : {}),
      paymentsEnabled: isPaymentsEnabled(),
    })
  })

  router.get('/purchases', async (req: AuthRequest, res: Response) => {
    const status = typeof req.query.status === 'string' ? (req.query.status as never) : undefined
    res.json({
      purchases: await listPurchasesAdmin(db, status ? { status } : {}),
      paymentsEnabled: isPaymentsEnabled(),
    })
  })

  // Independently reconcile a deposit against the provider payment lookup.
  // Gated by PAYMENTS_ENABLED; replay-safe via the webhook-event uniqueness.
  router.post('/payments/:id/reconcile', async (req: AuthRequest, res: Response) => {
    const params = idParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    try {
      const result = await reconcileDepositIntent(db, loadOxapayConfig(), params.data.id)
      res.json({ result, paymentsEnabled: isPaymentsEnabled() })
    } catch (error) {
      if (error instanceof PaymentError) {
        const status = error.code === 'payments_disabled' ? 503 : error.code === 'not_found' ? 404 : 409
        return res.status(status).json({ error: error.code })
      }
      if (error instanceof OxapayError) {
        return res.status(502).json({ error: error.code })
      }
      console.error('[admin/payments] reconcile error')
      return res.status(500).json({ error: 'internal error' })
    }
  })

  return router
}

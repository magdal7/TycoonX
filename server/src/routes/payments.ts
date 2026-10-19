import { Router, Response } from 'express'
import rateLimit from 'express-rate-limit'
import type { PrismaClient } from '@prisma/client'
import { processWebhook } from '../services/payments'
import { oxapayWebhookSchema } from '../validation/game'

/**
 * Payment gateway callbacks. OxaPay is NOT connected/activated: while payments
 * are disabled every event is recorded and ignored (never credits), and the
 * endpoint is rate-limited and idempotent on (provider, eventId).
 */
export function createPaymentRouter(db: PrismaClient): Router {
  const router = Router()
  const webhookLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true })

  router.post('/oxapay/webhook', webhookLimiter, async (req, res: Response) => {
    const parsed = oxapayWebhookSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const result = await processWebhook(db, {
        eventId: parsed.data.eventId,
        externalId: parsed.data.externalId,
        status: parsed.data.status,
        ...(parsed.data.amountUsdt ? { amountUsdt: parsed.data.amountUsdt } : {}),
        ...(parsed.data.metadata ? { metadata: parsed.data.metadata as never } : {}),
      })
      // 200 so a future gateway stops retrying; never credits while disabled.
      res.json({ received: true, ...result })
    } catch (error) {
      console.error('[payments/webhook] unexpected error:', error)
      res.status(500).json({ error: 'internal error' })
    }
  })

  return router
}

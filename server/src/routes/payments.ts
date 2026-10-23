import express, { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import type { Prisma, PrismaClient } from '@prisma/client'
import { processWebhook } from '../services/payments'
import { processPayoutWebhook } from '../services/withdrawals'
import { loadOxapayConfig } from '../services/oxapay'
import { synthesizeWebhookEventId, verifyHmacSha512 } from '../lib/oxapay'
import { oxapayCallbackSchema } from '../validation/game'

/**
 * Payment gateway callbacks.
 *
 * The exact raw request body is captured and its HMAC-SHA512 signature verified
 * BEFORE the body is parsed or processed. The signature header is read
 * case-insensitively. Missing, malformed or incorrectly signed callbacks are
 * rejected without touching any wallet state. While payments are disabled every
 * authenticated event is recorded and ignored (never credits).
 *
 * This router MUST be mounted before the global JSON body parser so it can read
 * the raw body itself (see `index.ts`).
 */
export function createPaymentRouter(db: PrismaClient): Router {
  const router = Router()
  const webhookLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true })
  const rawBody = express.raw({ type: '*/*', limit: '256kb' })

  router.post('/oxapay/webhook', webhookLimiter, rawBody, async (req: Request, res: Response) => {
    const config = loadOxapayConfig()
    // Merchant and payout credentials are separate (Master Spec §9). A callback
    // is accepted only if it verifies against the key matching its type.
    const merchantKey = config.merchantApiKey
    const payoutKey = config.payoutApiKey
    if (!merchantKey && !payoutKey) return res.status(503).json({ error: 'payments_not_configured' })

    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('')
    const signature = req.get('hmac')
    const merchantOk = merchantKey ? verifyHmacSha512(raw, signature, merchantKey) : false
    const payoutOk = payoutKey ? verifyHmacSha512(raw, signature, payoutKey) : false
    if (!merchantOk && !payoutOk) {
      return res.status(401).json({ error: 'invalid_signature' })
    }

    let json: unknown
    try {
      json = JSON.parse(raw.toString('utf8'))
    } catch {
      return res.status(400).json({ error: 'invalid_payload' })
    }

    const parsed = oxapayCallbackSchema.safeParse(json)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
    const callback = parsed.data

    // Payout callbacks are verified with the payout key and settled idempotently.
    if (typeof callback.type === 'string' && callback.type.trim().toLowerCase() === 'payout') {
      if (!payoutOk) return res.status(401).json({ error: 'invalid_signature' })
      try {
        await processPayoutWebhook(db, {
          eventId: synthesizeWebhookEventId({
            trackId: String(callback.track_id),
            status: callback.status,
            txHash: null,
          }),
          trackId: String(callback.track_id),
          status: callback.status,
          metadata: callback as unknown as Prisma.InputJsonValue,
        })
        return res.status(200).send('OK')
      } catch {
        console.error('[payments/webhook] unexpected payout processing error')
        return res.status(500).json({ error: 'internal error' })
      }
    }

    if (!merchantOk) return res.status(401).json({ error: 'invalid_signature' })

    const txs = Array.isArray(callback.txs) ? callback.txs : []
    const tx = txs.find((t) => typeof t.tx_hash === 'string' && t.tx_hash.trim() !== '') ?? txs[0]
    const trackId = String(callback.track_id)
    // Top-level `currency` carries the paid asset; the network comes from the tx.
    const asset = callback.currency ?? tx?.currency
    const network = tx?.network

    try {
      await processWebhook(db, {
        eventId: synthesizeWebhookEventId({ trackId, status: callback.status, txHash: tx?.tx_hash ?? null }),
        externalId: trackId,
        status: callback.status,
        ...(callback.amount !== undefined ? { amountUsdt: String(callback.amount) } : {}),
        ...(callback.order_id ? { orderId: callback.order_id } : {}),
        ...(asset ? { asset } : {}),
        ...(network ? { network } : {}),
        metadata: callback as unknown as Prisma.InputJsonValue,
      })
      // HTTP 200 "OK" so OxaPay stops retrying; nothing is credited while disabled.
      res.status(200).send('OK')
    } catch {
      // Do not log payloads or signatures.
      console.error('[payments/webhook] unexpected processing error')
      res.status(500).json({ error: 'internal error' })
    }
  })

  return router
}

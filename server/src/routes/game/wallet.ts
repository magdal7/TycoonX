import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAuth } from '../../middleware/auth'
import { PaymentError, createDepositIntent, listUserPaymentIntents } from '../../services/payments'
import {
  PurchaseError,
  createPurchase,
  listUserPurchases,
} from '../../services/purchases'
import { getWalletSummary, getWalletTransactions } from '../../services/wallet'
import { PAYMENTS_ENABLED } from '../../lib/payments'
import { depositCreateSchema, purchaseCreateSchema } from '../../validation/game'

function sendError(res: Response, error: unknown) {
  if (error instanceof PaymentError || error instanceof PurchaseError) {
    const status =
      error.code === 'payments_disabled'
        ? 503
        : error.code === 'not_found'
          ? 404
          : error.code === 'invalid_amount' ||
              error.code === 'invalid_price' ||
              error.code === 'unsupported_pair' ||
              error.code === 'asset_not_accepted'
            ? 422
            : 409
    return res.status(status).json({ error: error.code })
  }
  console.error('[game/wallet] unexpected error:', error)
  return res.status(500).json({ error: 'internal error' })
}

/** Wallet balances/history plus deposit and CEO-purchase endpoints (payments disabled). */
export function createGameWalletRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth)

  router.get('/wallet', async (req: AuthRequest, res: Response) => {
    res.json(await getWalletSummary(db, req.user!.id))
  })

  router.get('/wallet/transactions', async (req: AuthRequest, res: Response) => {
    res.json({ transactions: await getWalletTransactions(db, req.user!.id) })
  })

  router.get('/deposits', async (req: AuthRequest, res: Response) => {
    res.json({ deposits: await listUserPaymentIntents(db, req.user!.id), paymentsEnabled: PAYMENTS_ENABLED })
  })

  router.post('/deposits', async (req: AuthRequest, res: Response) => {
    const parsed = depositCreateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      res.status(201).json({
        deposit: await createDepositIntent(db, req.user!.id, parsed.data.amountUsdt, undefined, {
          asset: parsed.data.asset,
          network: parsed.data.network,
        }),
      })
    } catch (error) {
      sendError(res, error)
    }
  })

  router.get('/purchases', async (req: AuthRequest, res: Response) => {
    res.json({ purchases: await listUserPurchases(db, req.user!.id), paymentsEnabled: PAYMENTS_ENABLED })
  })

  router.post('/purchases', async (req: AuthRequest, res: Response) => {
    const parsed = purchaseCreateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const purchase = await createPurchase(db, req.user!.id, parsed.data.ceoId, parsed.data.idempotencyKey)
      res.status(201).json({ purchase })
    } catch (error) {
      sendError(res, error)
    }
  })

  return router
}

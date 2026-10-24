import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAuth } from '../../middleware/auth'
import {
  cancelWithdrawalRequest,
  createWithdrawalRequest,
  getWithdrawalWallet,
  listWithdrawals,
  setWithdrawalWallet,
  WithdrawalError,
  type WithdrawalErrorCode,
} from '../../services/withdrawals'
import { isPayoutsEnabled } from '../../lib/payments'
import { idParamSchema, withdrawalCreateSchema, withdrawalWalletSchema } from '../../validation/game'

const STATUS: Record<WithdrawalErrorCode, number> = {
  below_minimum: 422,
  below_payout_minimum: 422,
  invalid_address: 422,
  invalid_input: 400,
  pending_exists: 409,
  not_found: 404,
  invalid_state: 409,
  cooldown: 409,
  withdrawals_unavailable: 503,
  payouts_disabled: 503,
  payout_uncertain: 409,
  not_submitted: 409,
  wallet_hold: 409,
  wallet_pending: 409,
  wallet_mismatch: 422,
  insufficient_sp: 422,
}

function handle(error: unknown, res: Response): boolean {
  if (error instanceof WithdrawalError) {
    res.status(STATUS[error.code]).json({ error: error.code })
    return true
  }
  return false
}

/** Withdrawal request/review states only. No crypto is transferred; payouts are disabled. */
export function createGameWithdrawalRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth)

  router.get('/withdrawals', async (req: AuthRequest, res: Response) => {
    const [withdrawals, wallet] = await Promise.all([
      listWithdrawals(db, req.user!.id),
      getWithdrawalWallet(db, req.user!.id),
    ])
    res.json({ withdrawals, wallet, payoutsEnabled: isPayoutsEnabled() })
  })

  router.get('/withdrawals/wallet', async (req: AuthRequest, res: Response) => {
    try {
      res.json({ wallet: await getWithdrawalWallet(db, req.user!.id) })
    } catch (error) {
      if (handle(error, res)) return
      throw error
    }
  })

  router.post('/withdrawals/wallet', async (req: AuthRequest, res: Response) => {
    const parsed = withdrawalWalletSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const wallet = await setWithdrawalWallet(db, req.user!.id, parsed.data.address)
      res.json({ wallet })
    } catch (error) {
      if (handle(error, res)) return
      throw error
    }
  })

  router.post('/withdrawals', async (req: AuthRequest, res: Response) => {
    const parsed = withdrawalCreateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const withdrawal = await createWithdrawalRequest(db, req.user!.id, parsed.data)
      res.status(201).json({ withdrawal, payoutsEnabled: isPayoutsEnabled() })
    } catch (error) {
      if (handle(error, res)) return
      throw error
    }
  })

  router.post('/withdrawals/:id/cancel', async (req: AuthRequest, res: Response) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return res.status(400).json({ error: 'invalid id' })
    try {
      const withdrawal = await cancelWithdrawalRequest(db, req.user!.id, parsed.data.id)
      res.json({ withdrawal })
    } catch (error) {
      if (handle(error, res)) return
      throw error
    }
  })

  return router
}

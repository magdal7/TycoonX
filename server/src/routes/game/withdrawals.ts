import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAuth } from '../../middleware/auth'
import {
  cancelWithdrawalRequest,
  createWithdrawalRequest,
  listWithdrawals,
  WithdrawalError,
  type WithdrawalErrorCode,
} from '../../services/withdrawals'
import { idParamSchema, withdrawalCreateSchema } from '../../validation/game'

const STATUS: Record<WithdrawalErrorCode, number> = {
  below_minimum: 422,
  invalid_address: 422,
  pending_exists: 409,
  not_found: 404,
  invalid_state: 409,
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
    res.json({ withdrawals: await listWithdrawals(db, req.user!.id), payoutsEnabled: false })
  })

  router.post('/withdrawals', async (req: AuthRequest, res: Response) => {
    const parsed = withdrawalCreateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const withdrawal = await createWithdrawalRequest(db, req.user!.id, parsed.data)
      res.status(201).json({ withdrawal, payoutsEnabled: false })
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

import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAdmin, requireAuth } from '../../middleware/auth'
import {
  reviewWithdrawal,
  WithdrawalError,
  type WithdrawalErrorCode,
} from '../../services/withdrawals'
import { idParamSchema, withdrawalReviewSchema } from '../../validation/game'

const STATUS: Record<WithdrawalErrorCode, number> = {
  below_minimum: 422,
  invalid_address: 422,
  pending_exists: 409,
  not_found: 404,
  invalid_state: 409,
}

/** Admin withdrawal review queue. Approving never triggers a real payout. */
export function createAdminWithdrawalRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth, requireAdmin)

  router.get('/withdrawals', async (req: AuthRequest, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const rows = await db.withdrawalRequest.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { id: 'asc' },
      take: 200,
      include: { user: { select: { username: true } } },
    })
    res.json({
      withdrawals: rows.map((r) => ({
        id: r.id,
        username: r.user.username,
        grossSp: r.grossSp.toString(),
        feeUsdt: r.feeUsdt.toString(),
        netUsdt: r.netUsdt.toString(),
        address: r.address,
        network: r.network,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      payoutsEnabled: false,
    })
  })

  router.post('/withdrawals/:id/review', async (req: AuthRequest, res: Response) => {
    const params = idParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    const body = withdrawalReviewSchema.safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: body.error.flatten().fieldErrors })
    try {
      const withdrawal = await reviewWithdrawal(
        db,
        req.user!.id,
        params.data.id,
        body.data.decision,
        body.data.note,
      )
      res.json({ withdrawal, payoutsEnabled: false })
    } catch (error) {
      if (error instanceof WithdrawalError) {
        return res.status(STATUS[error.code]).json({ error: error.code })
      }
      throw error
    }
  })

  return router
}

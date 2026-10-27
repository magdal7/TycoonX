import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAdmin, requireAuth } from '../../middleware/auth'
import {
  executeWithdrawalPayout,
  getWithdrawalPayoutSubmissions,
  reconcileWithdrawalPayout,
  resolveUncertainPayoutSubmission,
  reviewWithdrawal,
  WithdrawalError,
  type WithdrawalErrorCode,
} from '../../services/withdrawals'
import { isPayoutsEnabled } from '../../lib/payments'
import { idParamSchema, payoutResolveSchema, withdrawalReviewSchema } from '../../validation/game'

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
  payout_fee_semantics_unverified: 503,
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
    const submissions = await getWithdrawalPayoutSubmissions(db, rows.map((r) => r.id))
    res.json({
      withdrawals: rows.map((r) => {
        const sub = submissions.get(r.id)
        return {
          id: r.id,
          userId: r.userId,
          username: r.user.username,
          grossSp: r.grossSp.toString(),
          feeUsdt: r.feeUsdt.toString(),
          netUsdt: r.netUsdt.toString(),
          address: r.address,
          network: r.network,
          status: r.status,
          note: r.note,
          reviewedBy: r.reviewedBy,
          reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
          payoutTrackId: r.payoutTrackId,
          paidAt: r.paidAt ? r.paidAt.toISOString() : null,
          payoutSubmitted: sub?.submitted ?? false,
          payoutUncertain: sub?.uncertain ?? false,
          payoutIntentTrackId: sub?.trackId ?? null,
          createdAt: r.createdAt.toISOString(),
        }
      }),
      payoutsEnabled: isPayoutsEnabled(),
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
      res.json({ withdrawal, payoutsEnabled: isPayoutsEnabled() })
    } catch (error) {
      if (error instanceof WithdrawalError) {
        return res.status(STATUS[error.code]).json({ error: error.code })
      }
      throw error
    }
  })

  // Submit an APPROVED withdrawal to the provider (requires PAYOUTS_ENABLED).
  router.post('/withdrawals/:id/payout', async (req: AuthRequest, res: Response) => {
    const params = idParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    try {
      const submission = await executeWithdrawalPayout(db, params.data.id)
      res.json({ submission, payoutsEnabled: isPayoutsEnabled() })
    } catch (error) {
      if (error instanceof WithdrawalError) {
        return res.status(STATUS[error.code]).json({ error: error.code })
      }
      console.error('[admin/withdrawals] payout error')
      return res.status(502).json({ error: 'provider_error' })
    }
  })

  // Independently reconcile a submitted payout against the provider lookup.
  router.post('/withdrawals/:id/reconcile', async (req: AuthRequest, res: Response) => {
    const params = idParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    try {
      const result = await reconcileWithdrawalPayout(db, params.data.id)
      res.json({ result, payoutsEnabled: isPayoutsEnabled() })
    } catch (error) {
      if (error instanceof WithdrawalError) {
        return res.status(STATUS[error.code]).json({ error: error.code })
      }
      console.error('[admin/withdrawals] reconcile error')
      return res.status(502).json({ error: 'provider_error' })
    }
  })

  // Resolve an uncertain payout submission (anchor with no track id) AFTER an
  // operator has verified the provider dashboard. Never moves funds by itself.
  router.post('/withdrawals/:id/payout/resolve', async (req: AuthRequest, res: Response) => {
    const params = idParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    const body = payoutResolveSchema.safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: body.error.flatten().fieldErrors })
    try {
      const result = await resolveUncertainPayoutSubmission(
        db,
        req.user!.id,
        params.data.id,
        body.data.resolution,
        body.data.trackId,
      )
      res.json({ result })
    } catch (error) {
      if (error instanceof WithdrawalError) {
        return res.status(STATUS[error.code]).json({ error: error.code })
      }
      console.error('[admin/withdrawals] resolve error')
      return res.status(502).json({ error: 'internal error' })
    }
  })

  return router
}

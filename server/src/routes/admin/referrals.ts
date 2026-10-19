import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAdmin, requireAuth } from '../../middleware/auth'
import {
  ReferralError,
  listAdminReferrals,
  listAdminReferralRewards,
  reviewReferral,
  type ReferralErrorCode,
} from '../../services/referrals'
import {
  adminUserIdParamSchema,
  referralReviewSchema,
  referralRewardFilterSchema,
  referralStatusFilterSchema,
} from '../../validation/admin'

const STATUS: Record<ReferralErrorCode, number> = {
  not_found: 404,
  invalid_state: 409,
  confirmation_required: 422,
}

function sendError(res: Response, error: unknown) {
  if (error instanceof ReferralError) return res.status(STATUS[error.code]).json({ error: error.code })
  console.error('[admin/referrals] unexpected error:', error)
  return res.status(500).json({ error: 'internal error' })
}

/** Admin referral management: review, commission records and abuse flags. */
export function createAdminReferralRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth, requireAdmin)

  router.get('/referrals', async (req: AuthRequest, res: Response) => {
    const statusParsed = referralStatusFilterSchema.safeParse(req.query.status)
    const q = typeof req.query.q === 'string' ? req.query.q : undefined
    res.json({
      referrals: await listAdminReferrals(db, {
        ...(statusParsed.success ? { status: statusParsed.data } : {}),
        ...(q ? { q } : {}),
      }),
      rewardsEnabled: false,
    })
  })

  router.post('/referrals/:id/review', async (req: AuthRequest, res: Response) => {
    const params = adminUserIdParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    const parsed = referralReviewSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const referral = await reviewReferral(
        db,
        req.user!.id,
        params.data.id,
        parsed.data.decision,
        parsed.data.note,
        parsed.data.confirm,
      )
      res.json({ referral: { id: referral.id, status: referral.status } })
    } catch (error) {
      sendError(res, error)
    }
  })

  router.get('/referral-rewards', async (req: AuthRequest, res: Response) => {
    const parsed = referralRewardFilterSchema.safeParse(req.query)
    const filter = parsed.success ? parsed.data : {}
    res.json({ rewards: await listAdminReferralRewards(db, filter) })
  })

  return router
}

import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAuth } from '../../middleware/auth'
import { getTaskBoard, claimTask, claimAllTasks } from '../../services/tasks'
import { listAchievements, claimAchievement } from '../../services/achievements'
import { getPlayerRank, setAvatar, setFeaturedBadges } from '../../services/leaderboard'
import { REFERRAL_REWARDS_ENABLED } from '../../services/referralRewards'
import {
  achievementClaimSchema,
  avatarSchema,
  claimTaskSchema,
  featuredBadgesSchema,
} from '../../validation/game'

export function createGameProgressionRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth)

  router.get('/tasks', async (req: AuthRequest, res: Response) => {
    const board = await getTaskBoard(db, req.user!.id)
    res.json(board)
  })

  router.post('/tasks/claim', async (req: AuthRequest, res: Response) => {
    const parsed = claimTaskSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const result = await claimTask(db, req.user!.id, parsed.data.taskKey)
      // A completed task that was already claimed is a successful no-op, not an error.
      if (!result.claimable) {
        return res.status(409).json({ error: 'task not claimable', board: result.board })
      }
      res.json(result)
    } catch {
      res.status(500).json({ error: 'internal error' })
    }
  })

  router.post('/tasks/claim-all', async (req: AuthRequest, res: Response) => {
    try {
      res.json(await claimAllTasks(db, req.user!.id))
    } catch {
      res.status(500).json({ error: 'internal error' })
    }
  })

  router.get('/achievements', async (req: AuthRequest, res: Response) => {
    res.json({ tracks: await listAchievements(db, req.user!.id) })
  })

  router.post('/achievements/claim', async (req: AuthRequest, res: Response) => {
    const parsed = achievementClaimSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const xpAwarded = await claimAchievement(db, req.user!.id, parsed.data.trackKey, parsed.data.stage)
      if (xpAwarded === 0) return res.status(409).json({ error: 'achievement not claimable' })
      res.json({ trackKey: parsed.data.trackKey, stage: parsed.data.stage, xpAwarded })
    } catch {
      res.status(500).json({ error: 'internal error' })
    }
  })

  router.get('/leaderboard/me', async (req: AuthRequest, res: Response) => {
    const rank = await getPlayerRank(db, req.user!.id)
    res.json({ rank })
  })

  router.post('/me/featured', async (req: AuthRequest, res: Response) => {
    const parsed = featuredBadgesSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    const badges = await setFeaturedBadges(db, req.user!.id, parsed.data.badges)
    res.json({ featured: badges })
  })

  router.post('/me/avatar', async (req: AuthRequest, res: Response) => {
    const parsed = avatarSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    await setAvatar(db, req.user!.id, parsed.data.avatarKey)
    res.json({ avatarKey: parsed.data.avatarKey })
  })

  router.get('/referrals', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id
    const [total, qualified] = await Promise.all([
      db.referralAttribution.count({ where: { referrerId: userId } }),
      db.referralAttribution.count({ where: { referrerId: userId, eligible: true } }),
    ])
    res.json({
      total,
      qualified,
      rewardsEnabled: REFERRAL_REWARDS_ENABLED,
      registrationBonusSp: '10',
      commissionPercent: '10',
    })
  })

  return router
}

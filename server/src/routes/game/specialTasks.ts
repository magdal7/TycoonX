import { Router, Response } from 'express'
import rateLimit from 'express-rate-limit'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAuth } from '../../middleware/auth'
import {
  SpecialTaskError,
  type SpecialTaskErrorCode,
  claimSpecialTaskReward,
  listPlayerSpecialTasks,
  submitSpecialTask,
} from '../../services/specialTasks'
import { specialTaskIdParamSchema, submissionCreateSchema } from '../../validation/specialTasks'

const STATUS: Record<SpecialTaskErrorCode, number> = {
  not_found: 404,
  invalid_state: 409,
  not_published: 409,
  expired: 410,
  ineligible: 403,
  full: 409,
  max_attempts: 409,
  pending_exists: 409,
  already_completed: 409,
  high_reward_confirmation_required: 422,
  already_reviewed: 409,
  not_approved: 409,
}

function sendError(res: Response, error: unknown) {
  if (error instanceof SpecialTaskError) {
    return res.status(STATUS[error.code]).json({ error: error.code })
  }
  return res.status(500).json({ error: 'internal error' })
}

/** Player-facing special tasks: list, submit proof, claim an approved reward. */
export function createGameSpecialTaskRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth)

  // Abuse protection: submissions are a reviewable action, so throttle them.
  const submitLimiter = rateLimit({ windowMs: 60 * 1000, max: 15, standardHeaders: true })

  router.get('/special-tasks', async (req: AuthRequest, res: Response) => {
    res.json({ tasks: await listPlayerSpecialTasks(db, req.user!.id) })
  })

  router.post('/special-tasks/:id/submit', submitLimiter, async (req: AuthRequest, res: Response) => {
    const params = specialTaskIdParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    const parsed = submissionCreateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const result = await submitSpecialTask(db, req.user!.id, params.data.id, parsed.data)
      res.status(201).json(result)
    } catch (error) {
      sendError(res, error)
    }
  })

  router.post('/special-tasks/submissions/:id/claim', async (req: AuthRequest, res: Response) => {
    const params = specialTaskIdParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    try {
      res.json(await claimSpecialTaskReward(db, req.user!.id, params.data.id))
    } catch (error) {
      sendError(res, error)
    }
  })

  return router
}

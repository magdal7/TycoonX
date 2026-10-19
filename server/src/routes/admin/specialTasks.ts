import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAdmin, requireAuth } from '../../middleware/auth'
import {
  SpecialTaskError,
  type SpecialTaskErrorCode,
  applySpecialTaskAction,
  createSpecialTask,
  getAdminDashboard,
  listAuditLog,
  listSpecialTasksAdmin,
  listSubmissionsAdmin,
  reviewSubmission,
  serializeAdminTask,
  updateSpecialTask,
} from '../../services/specialTasks'
import {
  submissionReviewSchema,
  specialTaskActionSchema,
  specialTaskConfigSchema,
  specialTaskIdParamSchema,
} from '../../validation/specialTasks'

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
  console.error('[admin/special-tasks] unexpected error:', error)
  return res.status(500).json({ error: 'internal error' })
}

/** Admin-only special task management. Every mutation requires an ADMIN session. */
export function createAdminSpecialTaskRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth, requireAdmin)

  router.get('/special-tasks/dashboard', async (_req: AuthRequest, res: Response) => {
    res.json(await getAdminDashboard(db))
  })

  router.get('/special-tasks', async (req: AuthRequest, res: Response) => {
    const status = typeof req.query.status === 'string' ? (req.query.status as never) : undefined
    res.json({ tasks: await listSpecialTasksAdmin(db, status ? { status } : {}) })
  })

  router.post('/special-tasks', async (req: AuthRequest, res: Response) => {
    const parsed = specialTaskConfigSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const task = await createSpecialTask(db, req.user!.id, parsed.data)
      res.status(201).json({ task: serializeAdminTask(task) })
    } catch (error) {
      sendError(res, error)
    }
  })

  router.put('/special-tasks/:id', async (req: AuthRequest, res: Response) => {
    const params = specialTaskIdParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    const parsed = specialTaskConfigSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const task = await updateSpecialTask(db, req.user!.id, params.data.id, parsed.data)
      res.json({ task: serializeAdminTask(task) })
    } catch (error) {
      sendError(res, error)
    }
  })

  router.post('/special-tasks/:id/status', async (req: AuthRequest, res: Response) => {
    const params = specialTaskIdParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    const parsed = specialTaskActionSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const task = await applySpecialTaskAction(db, req.user!.id, params.data.id, parsed.data.action)
      res.json({ task: serializeAdminTask(task) })
    } catch (error) {
      sendError(res, error)
    }
  })

  router.get('/submissions', async (req: AuthRequest, res: Response) => {
    const taskId = typeof req.query.taskId === 'string' ? Number(req.query.taskId) : undefined
    const status = typeof req.query.status === 'string' ? (req.query.status as never) : undefined
    res.json({
      submissions: await listSubmissionsAdmin(db, {
        ...(Number.isFinite(taskId) ? { taskId } : {}),
        ...(status ? { status } : {}),
      }),
    })
  })

  router.post('/submissions/:id/review', async (req: AuthRequest, res: Response) => {
    const params = specialTaskIdParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    const parsed = submissionReviewSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const submission = await reviewSubmission(db, req.user!.id, params.data.id, parsed.data.decision, parsed.data.note)
      res.json({ submission: { id: submission.id, status: submission.status } })
    } catch (error) {
      sendError(res, error)
    }
  })

  router.get('/audit', async (_req: AuthRequest, res: Response) => {
    res.json({ entries: await listAuditLog(db) })
  })

  return router
}

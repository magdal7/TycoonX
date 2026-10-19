import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAdmin, requireAuth } from '../../middleware/auth'
import { AdminError, ADMIN_ERROR_STATUS } from '../../services/adminErrors'
import { getUserDetail, searchUsers, setUserSuspension } from '../../services/adminUsers'
import { adminUserIdParamSchema, adminUserSearchSchema, userSuspensionSchema } from '../../validation/admin'

function sendError(res: Response, error: unknown) {
  if (error instanceof AdminError) return res.status(ADMIN_ERROR_STATUS[error.code]).json({ error: error.code })
  console.error('[admin/users] unexpected error:', error)
  return res.status(500).json({ error: 'internal error' })
}

/** Admin user management: search, detail, suspend/reactivate. */
export function createAdminUserRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth, requireAdmin)

  router.get('/users', async (req: AuthRequest, res: Response) => {
    const parsed = adminUserSearchSchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    res.json({ users: await searchUsers(db, parsed.data) })
  })

  router.get('/users/:id', async (req: AuthRequest, res: Response) => {
    const params = adminUserIdParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    try {
      res.json(await getUserDetail(db, params.data.id))
    } catch (error) {
      sendError(res, error)
    }
  })

  router.post('/users/:id/suspension', async (req: AuthRequest, res: Response) => {
    const params = adminUserIdParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    const parsed = userSuspensionSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const user = await setUserSuspension(db, req.user!.id, params.data.id, parsed.data)
      res.json({ user })
    } catch (error) {
      sendError(res, error)
    }
  })

  return router
}

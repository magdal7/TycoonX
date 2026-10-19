import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAdmin, requireAuth } from '../../middleware/auth'
import { AdminError, ADMIN_ERROR_STATUS } from '../../services/adminErrors'
import {
  createCatalogEntry,
  deleteCatalogEntry,
  listCatalog,
  updateCatalogPresentation,
} from '../../services/adminCatalog'
import {
  adminUserIdParamSchema,
  catalogCreateSchema,
  catalogUpdateSchema,
  confirmSchema,
} from '../../validation/admin'

function sendError(res: Response, error: unknown) {
  if (error instanceof AdminError) return res.status(ADMIN_ERROR_STATUS[error.code]).json({ error: error.code })
  console.error('[admin/catalog] unexpected error:', error)
  return res.status(500).json({ error: 'internal error' })
}

/** Admin CEO catalog management. Production/economy fields are never editable here. */
export function createAdminCatalogRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth, requireAdmin)

  router.get('/catalog', async (_req: AuthRequest, res: Response) => {
    res.json({ ceos: await listCatalog(db) })
  })

  router.post('/catalog', async (req: AuthRequest, res: Response) => {
    const parsed = catalogCreateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const ceo = await createCatalogEntry(db, req.user!.id, parsed.data)
      res.status(201).json({ ceo })
    } catch (error) {
      sendError(res, error)
    }
  })

  router.put('/catalog/:id', async (req: AuthRequest, res: Response) => {
    const params = adminUserIdParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    const parsed = catalogUpdateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    try {
      const ceo = await updateCatalogPresentation(db, req.user!.id, params.data.id, parsed.data)
      res.json({ ceo })
    } catch (error) {
      sendError(res, error)
    }
  })

  router.delete('/catalog/:id', async (req: AuthRequest, res: Response) => {
    const params = adminUserIdParamSchema.safeParse(req.params)
    if (!params.success) return res.status(400).json({ error: 'invalid id' })
    const parsed = confirmSchema.safeParse(req.body ?? {})
    if (!parsed.success) return res.status(400).json({ error: 'confirmation required' })
    try {
      res.json(await deleteCatalogEntry(db, req.user!.id, params.data.id, parsed.data.confirm))
    } catch (error) {
      sendError(res, error)
    }
  })

  return router
}

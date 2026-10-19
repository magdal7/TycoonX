import { Router, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthRequest, requireAdmin, requireAuth } from '../../middleware/auth'
import { getSiteSettings, updateSiteSettings } from '../../services/siteSettings'
import { toPublicSettings } from '../../lib/siteSettings'
import { settingsUpdateSchema } from '../../validation/admin'

/** Admin site settings: registration, maintenance, feature visibility, announcements. */
export function createAdminSettingsRouter(db: PrismaClient): Router {
  const router = Router()
  router.use(requireAuth, requireAdmin)

  router.get('/settings', async (_req: AuthRequest, res: Response) => {
    res.json({ settings: await getSiteSettings(db) })
  })

  router.put('/settings', async (req: AuthRequest, res: Response) => {
    const parsed = settingsUpdateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    if (!parsed.data.confirm) return res.status(422).json({ error: 'confirmation_required' })
    const { confirm: _confirm, ...patch } = parsed.data
    try {
      const settings = await updateSiteSettings(db, req.user!.id, patch)
      res.json({ settings: toPublicSettings(settings) })
    } catch (error) {
      console.error('[admin/settings] unexpected error:', error)
      res.status(500).json({ error: 'internal error' })
    }
  })

  return router
}

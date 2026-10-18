import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest, requireAdmin, requireAuth } from '../middleware/auth'
import {
  ceoCreateSchema,
  ceoQuerySchema,
  ceoUpdateSchema,
  type CEOCreateInput,
  type CEOUpdateInput,
} from '../validation/ceo'

const router = Router()

function serializeCEO(ceo: any) {
  return {
    id: ceo.id,
    name: ceo.name,
    slug: ceo.slug,
    rarity: ceo.rarity,
    priceUsd: ceo.priceUsd?.toString?.() ?? ceo.priceUsd,
    dailyRatePercent: ceo.dailyRatePercent?.toString?.() ?? ceo.dailyRatePercent,
    nominalSpPer24h: ceo.nominalSpPer24h ?? null,
    lifetimeCapSp: ceo.lifetimeCapSp?.toString?.() ?? null,
    cycleHours: ceo.cycleHours,
    energyCost: ceo.energyCost,
    isActive: ceo.isActive,
    createdAt: ceo.createdAt,
    updatedAt: ceo.updatedAt,
  }
}

/** GET /api/ceos - list CEOs (authenticated) */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = ceoQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
  }
  const { isActive, rarity, search } = parsed.data

  const where: any = {}
  if (isActive !== undefined) where.isActive = isActive
  if (rarity) where.rarity = rarity
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ]
  }

  const ceos = await prisma.cEO.findMany({ where, orderBy: { id: 'asc' } })
  res.json({ ceos: ceos.map(serializeCEO) })
})

/** GET /api/ceos/:id - get one CEO (authenticated) */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'invalid ceo id' })
  }
  const ceo = await prisma.cEO.findUnique({ where: { id } })
  if (!ceo) return res.status(404).json({ error: 'ceo not found' })
  res.json({ ceo: serializeCEO(ceo) })
})

/** POST /api/ceos - create CEO (admin only) */
router.post('/', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = ceoCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
  }
  const data: CEOCreateInput = parsed.data

  const existing = await prisma.cEO.findUnique({ where: { slug: data.slug } })
  if (existing) {
    return res.status(409).json({ error: 'ceo slug already exists' })
  }

  const ceo = await prisma.cEO.create({
    data: {
      name: data.name,
      slug: data.slug,
      rarity: data.rarity,
      priceUsd: data.priceUsd,
      dailyRatePercent: data.dailyRatePercent,
      cycleHours: data.cycleHours,
      energyCost: data.energyCost,
      isActive: data.isActive,
    },
  })
  res.status(201).json({ ceo: serializeCEO(ceo) })
})

/** PUT /api/ceos/:id - update CEO (admin only) */
router.put('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'invalid ceo id' })
  }

  const parsed = ceoUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors })
  }
  const data: CEOUpdateInput = parsed.data

  const existing = await prisma.cEO.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'ceo not found' })

  if (data.slug && data.slug !== existing.slug) {
    const slugTaken = await prisma.cEO.findUnique({ where: { slug: data.slug } })
    if (slugTaken) {
      return res.status(409).json({ error: 'ceo slug already exists' })
    }
  }

  const ceo = await prisma.cEO.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.rarity !== undefined && { rarity: data.rarity }),
      ...(data.priceUsd !== undefined && { priceUsd: data.priceUsd }),
      ...(data.dailyRatePercent !== undefined && { dailyRatePercent: data.dailyRatePercent }),
      ...(data.cycleHours !== undefined && { cycleHours: data.cycleHours }),
      ...(data.energyCost !== undefined && { energyCost: data.energyCost }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  })
  res.json({ ceo: serializeCEO(ceo) })
})

/** DELETE /api/ceos/:id - delete CEO (admin only) */
router.delete('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'invalid ceo id' })
  }

  const existing = await prisma.cEO.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'ceo not found' })

  await prisma.cEO.delete({ where: { id } })
  res.json({ ok: true })
})

export default router

import type { PrismaClient } from '@prisma/client'
import { AdminError } from './adminErrors'
import type { CatalogCreateBody, CatalogUpdateBody } from '../validation/admin'

type CeoRow = {
  id: number
  name: string
  slug: string
  rarity: string
  priceUsd: { toString(): string }
  dailyRatePercent: { toString(): string }
  nominalSpPer24h: number | null
  lifetimeCapSp: bigint | null
  cycleHours: number
  energyCost: number
  isActive: boolean
  isForSale: boolean
  category: string | null
  displayOrder: number
  imageUrl: string | null
  isStarter: boolean
  rewardEligible: boolean
  maxOwned: number
  createdAt: Date
  updatedAt: Date
}

export function serializeCatalogCEO(row: CeoRow, ownedCount = 0) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    rarity: row.rarity,
    priceUsd: row.priceUsd.toString(),
    dailyRatePercent: row.dailyRatePercent.toString(),
    nominalSpPer24h: row.nominalSpPer24h,
    lifetimeCapSp: row.lifetimeCapSp?.toString() ?? null,
    cycleHours: row.cycleHours,
    energyCost: row.energyCost,
    isActive: row.isActive,
    isForSale: row.isForSale,
    category: row.category,
    displayOrder: row.displayOrder,
    imageUrl: row.imageUrl,
    isStarter: row.isStarter,
    rewardEligible: row.rewardEligible,
    maxOwned: row.maxOwned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ownedCount,
  }
}

export async function listCatalog(db: PrismaClient) {
  const rows = await db.cEO.findMany({
    orderBy: { displayOrder: 'asc' },
    include: { _count: { select: { owned: true } } },
  })
  return rows.map((r) => serializeCatalogCEO(r as unknown as CeoRow, r._count.owned))
}

/**
 * Updates presentation/visibility fields only. Production/economy fields are not
 * accepted by the validation schema, so approved parameters cannot be changed.
 */
export async function updateCatalogPresentation(
  db: PrismaClient,
  actorId: number,
  id: number,
  input: CatalogUpdateBody,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.cEO.findUnique({ where: { id } })
    if (!existing) throw new AdminError('not_found')

    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.rarity !== undefined) data.rarity = input.rarity
    if (input.category !== undefined) data.category = input.category
    if (input.displayOrder !== undefined) data.displayOrder = input.displayOrder
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl
    if (input.isActive !== undefined) data.isActive = input.isActive
    if (input.isForSale !== undefined) data.isForSale = input.isForSale

    const updated = await tx.cEO.update({ where: { id }, data })
    await tx.adminAuditLog.create({
      data: {
        actorId,
        action: 'catalog.update',
        targetType: 'CEO',
        targetId: String(id),
        metadata: { fields: Object.keys(data), ...data },
      },
    })
    return serializeCatalogCEO(updated as unknown as CeoRow)
  })
}

/**
 * Creates a new catalog tier as an inactive, not-for-sale draft. Activating a new
 * tier with production values is an economy decision pending owner governance.
 */
export async function createCatalogEntry(db: PrismaClient, actorId: number, input: CatalogCreateBody) {
  if (!input.confirmNewTier) throw new AdminError('confirmation_required')
  return db.$transaction(async (tx) => {
    const taken = await tx.cEO.findUnique({ where: { slug: input.slug }, select: { id: true } })
    if (taken) throw new AdminError('slug_exists')

    const created = await tx.cEO.create({
      data: {
        name: input.name,
        slug: input.slug,
        rarity: input.rarity,
        priceUsd: input.priceUsd,
        dailyRatePercent: input.dailyRatePercent,
        cycleHours: input.cycleHours,
        energyCost: input.energyCost,
        category: input.category ?? null,
        displayOrder: input.displayOrder,
        imageUrl: input.imageUrl ?? null,
        isActive: false,
        isForSale: false,
      },
    })
    await tx.adminAuditLog.create({
      data: {
        actorId,
        action: 'catalog.create',
        targetType: 'CEO',
        targetId: String(created.id),
        metadata: { name: created.name, slug: created.slug, draft: true },
      },
    })
    return serializeCatalogCEO(created as unknown as CeoRow)
  })
}

/** Safeguard: a tier with owned copies cannot be deleted (deactivate instead). */
export async function deleteCatalogEntry(db: PrismaClient, actorId: number, id: number, confirm: boolean) {
  if (!confirm) throw new AdminError('confirmation_required')
  return db.$transaction(async (tx) => {
    const existing = await tx.cEO.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!existing) throw new AdminError('not_found')
    const owned = await tx.ownedCeo.count({ where: { templateId: id } })
    if (owned > 0) throw new AdminError('owned_exists')

    await tx.cEO.delete({ where: { id } })
    await tx.adminAuditLog.create({
      data: { actorId, action: 'catalog.delete', targetType: 'CEO', targetId: String(id), metadata: { name: existing.name } },
    })
    return { ok: true }
  })
}

import type { PrismaClient } from '@prisma/client'
import { claimIdempotencyKey, isUniqueViolation } from '../lib/idempotency'
import { assertOwnershipCapacity } from './ownership'

export const STARTER_SCOPE = 'starter_ceo'
export const STARTER_KEY = 'v1'
export const STARTER_TEMPLATE_MISSING = 'No active starter CEO template is configured'

export interface StarterGrantResult {
  ownedCeoId: number
  templateId: number
  created: boolean
}

/**
 * Grants the one free starter CEO to a user. Idempotent and concurrency-safe:
 * guarded by an idempotency key and, as a backstop, by the partial unique index
 * "OwnedCeo_starter_user_key" (one STARTER row per user). Must run against real
 * tables before any route is enabled.
 */
export async function grantStarterCeo(
  prisma: PrismaClient,
  userId: number,
): Promise<StarterGrantResult> {
  const template = await prisma.cEO.findFirst({
    where: { isStarter: true, isActive: true },
    orderBy: { id: 'asc' },
    select: { id: true, maxOwned: true },
  })
  if (!template) throw new Error(STARTER_TEMPLATE_MISSING)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.ownedCeo.findFirst({
      where: { userId, acquisitionType: 'STARTER' },
      select: { id: true, templateId: true },
    })
    if (existing) {
      return { ownedCeoId: existing.id, templateId: existing.templateId, created: false }
    }

    await assertOwnershipCapacity(tx, userId, template)

    await claimIdempotencyKey(tx, userId, STARTER_SCOPE, STARTER_KEY)

    try {
      const owned = await tx.ownedCeo.create({
        data: { userId, templateId: template.id, acquisitionType: 'STARTER', status: 'IDLE' },
        select: { id: true, templateId: true },
      })
      return { ownedCeoId: owned.id, templateId: owned.templateId, created: true }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const raced = await tx.ownedCeo.findFirst({
        where: { userId, acquisitionType: 'STARTER' },
        select: { id: true, templateId: true },
      })
      if (raced) return { ownedCeoId: raced.id, templateId: raced.templateId, created: false }
      throw error
    }
  })
}

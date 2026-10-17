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
 * Grants the one free starter CEO to a user. Idempotent and concurrency-safe.
 *
 * Uniqueness is enforced twice: the `IdempotencyKey` row
 * (`@@unique([userId, scope, key])`) and the partial unique index
 * `OwnedCeo_starter_user_key` (`userId WHERE acquisitionType = 'STARTER'`).
 * A concurrent loser gets a P2002 that rolls the whole transaction back; the
 * replay result is then derived from the committed domain state *outside* the
 * transaction, never by catching the error inside it (which would poison the
 * aborted PostgreSQL transaction).
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

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.ownedCeo.findFirst({
        where: { userId, acquisitionType: 'STARTER' },
        select: { id: true, templateId: true },
      })
      if (existing) {
        return { ownedCeoId: existing.id, templateId: existing.templateId, created: false }
      }

      await assertOwnershipCapacity(tx, userId, template)

      await claimIdempotencyKey(tx, userId, STARTER_SCOPE, STARTER_KEY)

      const owned = await tx.ownedCeo.create({
        data: { userId, templateId: template.id, acquisitionType: 'STARTER', status: 'IDLE' },
        select: { id: true, templateId: true },
      })
      return { ownedCeoId: owned.id, templateId: owned.templateId, created: true }
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const raced = await prisma.ownedCeo.findFirst({
      where: { userId, acquisitionType: 'STARTER' },
      select: { id: true, templateId: true },
    })
    if (raced) return { ownedCeoId: raced.id, templateId: raced.templateId, created: false }
    throw error
  }
}

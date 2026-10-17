import type { Prisma, PrismaClient } from '@prisma/client'
import { claimIdempotencyKey, isUniqueViolation } from '../lib/idempotency'
import { assertOwnershipCapacity, OwnershipLimitError } from './ownership'

export const STARTER_SCOPE = 'starter_ceo'
export const STARTER_KEY = 'v1'
export const STARTER_TEMPLATE_MISSING = 'No active starter CEO template is configured'
export const STARTER_MAX_ATTEMPTS = 3

export interface StarterGrantResult {
  ownedCeoId: number
  templateId: number
  created: boolean
}

type OwnedCeoReader = Pick<Prisma.TransactionClient, 'ownedCeo'>

function findStarterCeo(db: OwnedCeoReader, userId: number) {
  return db.ownedCeo.findFirst({
    where: { userId, acquisitionType: 'STARTER' },
    select: { id: true, templateId: true },
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Grants the one free starter CEO to a user. Idempotent and concurrency-safe.
 *
 * Invariants: at most one STARTER OwnedCeo per user; concurrent callers never
 * create duplicates; a caller that finds an existing copy returns it with
 * `created: false`; exactly one caller may report `created: true`.
 *
 * The `IdempotencyKey` unique row is claimed as the FIRST write of the
 * transaction, so it is the serialization point: concurrent grants queue on
 * that unique index and all but one raise P2002, which rolls the transaction
 * back cleanly and is reconciled to a replay from committed state *outside* the
 * transaction. Claiming the key before the capacity count matters because
 * PostgreSQL READ COMMITTED takes a fresh snapshot per statement: a loser could
 * otherwise observe the winner's committed STARTER in `assertOwnershipCapacity`
 * (count >= maxOwned) while its earlier existence check did not, and fail with
 * OwnershipLimitError instead of replaying.
 *
 * The partial unique index `OwnedCeo_starter_user_key`
 * (`userId WHERE acquisitionType = 'STARTER'`) remains the final database-level
 * protection against duplicate starter ownership. Bounded retries reconcile the
 * rare case where a unique violation has no visible winner yet.
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

  for (let attempt = 0; attempt < STARTER_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await findStarterCeo(tx, userId)
        if (existing) {
          return { ownedCeoId: existing.id, templateId: existing.templateId, created: false }
        }

        // Serialization point: only one concurrent grant can insert this row.
        await claimIdempotencyKey(tx, userId, STARTER_SCOPE, STARTER_KEY)

        // Capacity guard, AFTER the claim. The cap may have been consumed by this
        // user's own STARTER that committed between the existence check and the
        // claim; reconcile to a replay in that case. A non-starter acquisition
        // that genuinely fills the cap still raises OwnershipLimitError (and rolls
        // back the just-claimed key, leaving no side effect).
        try {
          await assertOwnershipCapacity(tx, userId, template)
        } catch (error) {
          if (!(error instanceof OwnershipLimitError)) throw error
          const raced = await findStarterCeo(tx, userId)
          if (raced) {
            return { ownedCeoId: raced.id, templateId: raced.templateId, created: false }
          }
          throw error
        }

        const owned = await tx.ownedCeo.create({
          data: { userId, templateId: template.id, acquisitionType: 'STARTER', status: 'IDLE' },
          select: { id: true, templateId: true },
        })
        return { ownedCeoId: owned.id, templateId: owned.templateId, created: true }
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      // A unique violation aborted the transaction; never continue inside it.
      // Reconcile outside, using committed state.
      const raced = await findStarterCeo(prisma, userId)
      if (raced) {
        return { ownedCeoId: raced.id, templateId: raced.templateId, created: false }
      }
      // No visible winner yet (e.g. the winner has not committed): back off
      // briefly and retry within the bounded attempt budget.
      await sleep(10 * (attempt + 1))
    }
  }

  const raced = await findStarterCeo(prisma, userId)
  if (raced) {
    return { ownedCeoId: raced.id, templateId: raced.templateId, created: false }
  }
  throw new Error('Starter grant could not be reconciled after concurrent attempts')
}

import type { Prisma } from '@prisma/client'

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

/**
 * Attempts to claim an idempotency scope/key for a user inside an open
 * transaction. Returns true if newly claimed, false if it was already claimed
 * (unique violation). Idempotency has no result payload by design; callers
 * derive the replay result from existing domain state.
 */
export async function claimIdempotencyKey(
  tx: Prisma.TransactionClient,
  userId: number,
  scope: string,
  key: string,
): Promise<boolean> {
  try {
    await tx.idempotencyKey.create({ data: { userId, scope, key } })
    return true
  } catch (error) {
    if (isUniqueViolation(error)) return false
    throw error
  }
}

import type { Prisma } from '@prisma/client'

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

/**
 * Claims an idempotency scope/key for a user inside an open transaction.
 *
 * IMPORTANT: this deliberately does NOT swallow a unique violation. On
 * PostgreSQL, *any* error aborts the current transaction, so catching P2002 and
 * continuing to issue statements inside the same interactive transaction leaves
 * it in an aborted state ("current transaction is aborted") and every later
 * statement fails. Instead, a duplicate claim throws, the transaction rolls
 * back cleanly, and the caller reconciles the replay from existing domain state
 * outside the transaction (see grantStarterCeo).
 */
export async function claimIdempotencyKey(
  tx: Prisma.TransactionClient,
  userId: number,
  scope: string,
  key: string,
): Promise<void> {
  await tx.idempotencyKey.create({ data: { userId, scope, key } })
}

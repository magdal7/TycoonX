import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

export type SpBucketName = 'EARNED' | 'BONUS'
export type SpSource =
  | 'CYCLE_CLAIM'
  | 'MISSION_REWARD'
  | 'REFERRAL_REWARD'
  | 'SPECIAL_TASK_REWARD'
  | 'EQUIPMENT_PURCHASE'
  | 'ADMIN_ADJUSTMENT'
  | 'WITHDRAWAL_LOCK'
  | 'WITHDRAWAL_SETTLE'
  | 'WITHDRAWAL_RELEASE'
  | 'DEPOSIT_CREDIT'
  | 'CEO_PURCHASE'

export class InsufficientSpError extends Error {
  constructor() {
    super('insufficient SP')
    this.name = 'InsufficientSpError'
  }
}

export interface SpBalances {
  earnedSp: bigint
  bonusSp: bigint
  lifetimeEarnedSp: bigint
}

const ZERO = BigInt(0)

async function readAccount(tx: Tx, userId: number) {
  return tx.spAccount.findUnique({ where: { userId } })
}

/** Reads balances, returning zeros for a user with no account yet. */
export async function getSpBalances(tx: Tx, userId: number): Promise<SpBalances> {
  const account = await readAccount(tx, userId)
  return {
    earnedSp: account?.earnedSp ?? ZERO,
    bonusSp: account?.bonusSp ?? ZERO,
    lifetimeEarnedSp: account?.lifetimeEarnedSp ?? ZERO,
  }
}

export interface CreditSpInput {
  userId: number
  bucket: SpBucketName
  amountSp: bigint
  sourceType: SpSource
  sourceId?: bigint | null
  metadata?: Prisma.InputJsonValue
}

/**
 * Credits SP to one bucket and appends an immutable ledger entry. Earned credits
 * also advance `lifetimeEarnedSp`. Caller must supply a stable `sourceId` so the
 * unique ledger constraint makes the credit exactly-once.
 */
export async function creditSp(tx: Tx, input: CreditSpInput): Promise<SpBalances> {
  if (input.amountSp <= ZERO) throw new Error('credit amount must be positive')
  const sourceId = input.sourceId ?? null

  const account = await tx.spAccount.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      earnedSp: input.bucket === 'EARNED' ? input.amountSp : ZERO,
      bonusSp: input.bucket === 'BONUS' ? input.amountSp : ZERO,
      lifetimeEarnedSp: input.bucket === 'EARNED' ? input.amountSp : ZERO,
    },
    update: {
      earnedSp: input.bucket === 'EARNED' ? { increment: input.amountSp } : undefined,
      bonusSp: input.bucket === 'BONUS' ? { increment: input.amountSp } : undefined,
      lifetimeEarnedSp: input.bucket === 'EARNED' ? { increment: input.amountSp } : undefined,
      version: { increment: 1 },
    },
  })

  await tx.spLedgerEntry.create({
    data: {
      userId: input.userId,
      bucket: input.bucket,
      amountSp: input.amountSp,
      balanceAfterEarnedSp: account.earnedSp,
      balanceAfterBonusSp: account.bonusSp,
      sourceType: input.sourceType,
      sourceId,
      metadata: input.metadata,
    },
  })

  return {
    earnedSp: account.earnedSp,
    bonusSp: account.bonusSp,
    lifetimeEarnedSp: account.lifetimeEarnedSp,
  }
}

/**
 * Debits Earned SP only (never Bonus). Used for withdrawal locks, which must be
 * backed solely by withdrawable Earned SP (Master Spec §9). Guarded so the bucket
 * cannot go negative; throws `InsufficientSpError` on guard failure.
 */
export async function debitEarnedSp(
  tx: Tx,
  input: {
    userId: number
    amountSp: bigint
    sourceType: SpSource
    sourceId?: bigint | null
    metadata?: Prisma.InputJsonValue
  },
): Promise<SpBalances> {
  if (input.amountSp <= ZERO) throw new Error('debit amount must be positive')
  const guard = await tx.spAccount.updateMany({
    where: { userId: input.userId, earnedSp: { gte: input.amountSp } },
    data: { earnedSp: { decrement: input.amountSp }, version: { increment: 1 } },
  })
  if (guard.count !== 1) throw new InsufficientSpError()
  const after = await tx.spAccount.findUniqueOrThrow({ where: { userId: input.userId } })
  await tx.spLedgerEntry.create({
    data: {
      userId: input.userId,
      bucket: 'EARNED',
      amountSp: -input.amountSp,
      balanceAfterEarnedSp: after.earnedSp,
      balanceAfterBonusSp: after.bonusSp,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      metadata: input.metadata,
    },
  })
  return { earnedSp: after.earnedSp, bonusSp: after.bonusSp, lifetimeEarnedSp: after.lifetimeEarnedSp }
}

export interface SpendSpResult extends SpBalances {
  bonusDebit: bigint
  earnedDebit: bigint
}

/**
 * Debits SP, spending Bonus SP first then Earned SP (Master Spec §2). Uses a guarded
 * conditional update so concurrent debits cannot drive a bucket negative; on guard
 * failure it throws `InsufficientSpError` and the caller's transaction rolls back.
 * Writes one ledger entry per debited bucket (both share the same source event).
 */
export async function spendSp(
  tx: Tx,
  input: {
    userId: number
    amountSp: bigint
    sourceType: SpSource
    sourceId?: bigint | null
    metadata?: Prisma.InputJsonValue
  },
): Promise<SpendSpResult> {
  if (input.amountSp <= ZERO) throw new Error('spend amount must be positive')
  const account = await readAccount(tx, input.userId)
  const bonusSp = account?.bonusSp ?? ZERO
  const earnedSp = account?.earnedSp ?? ZERO

  if (bonusSp + earnedSp < input.amountSp) throw new InsufficientSpError()

  // Bonus SP is spent first, then Earned SP (Master Spec §2). BigInt math.
  const bonusDebit = bonusSp >= input.amountSp ? input.amountSp : bonusSp
  const earnedDebit = input.amountSp - bonusDebit
  const sourceId = input.sourceId ?? null

  const guard = await tx.spAccount.updateMany({
    where: { userId: input.userId, bonusSp: { gte: bonusDebit }, earnedSp: { gte: earnedDebit } },
    data: {
      bonusSp: { decrement: bonusDebit },
      earnedSp: { decrement: earnedDebit },
      version: { increment: 1 },
    },
  })
  if (guard.count !== 1) throw new InsufficientSpError()

  const after = await tx.spAccount.findUniqueOrThrow({ where: { userId: input.userId } })
  const base = {
    userId: input.userId,
    balanceAfterEarnedSp: after.earnedSp,
    balanceAfterBonusSp: after.bonusSp,
    sourceType: input.sourceType,
    sourceId,
    metadata: input.metadata,
  }
  if (bonusDebit > ZERO) {
    await tx.spLedgerEntry.create({ data: { ...base, bucket: 'BONUS', amountSp: -bonusDebit } })
  }
  if (earnedDebit > ZERO) {
    await tx.spLedgerEntry.create({ data: { ...base, bucket: 'EARNED', amountSp: -earnedDebit } })
  }

  return {
    earnedSp: after.earnedSp,
    bonusSp: after.bonusSp,
    lifetimeEarnedSp: after.lifetimeEarnedSp,
    bonusDebit,
    earnedDebit,
  }
}

import type { PrismaClient, WithdrawalStatus } from '@prisma/client'
import { creditSp, debitEarnedSp } from './spLedger'

/** Owner-approved withdrawal rules (Master Spec §9): USDT BEP20 only. */
export const MIN_GROSS_SP = 3000n // 3 USDT
export const FLAT_FEE_SP = 300n // 0.30 USDT == 300 SP at 1,000 SP/USDT
export const NETWORK = 'BEP20'

export type WithdrawalErrorCode =
  | 'below_minimum'
  | 'invalid_address'
  | 'pending_exists'
  | 'not_found'
  | 'invalid_state'

export class WithdrawalError extends Error {
  readonly code: WithdrawalErrorCode
  constructor(code: WithdrawalErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'WithdrawalError'
    this.code = code
  }
}

const PENDING: WithdrawalStatus[] = ['REQUESTED', 'ON_HOLD', 'APPROVED']

export function netUsdtString(grossSp: bigint): string {
  return (Number(grossSp - FLAT_FEE_SP) / 1000).toFixed(2)
}

function feeUsdtString(): string {
  return (Number(FLAT_FEE_SP) / 1000).toFixed(2)
}

function validAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export interface WithdrawalView {
  id: number
  grossSp: string
  feeUsdt: string
  netUsdt: string
  address: string
  network: string
  status: string
  createdAt: string
}

function toView(row: {
  id: number
  grossSp: bigint
  feeUsdt: { toString(): string }
  netUsdt: { toString(): string }
  address: string
  network: string
  status: string
  createdAt: Date
}): WithdrawalView {
  return {
    id: row.id,
    grossSp: row.grossSp.toString(),
    feeUsdt: row.feeUsdt.toString(),
    netUsdt: row.netUsdt.toString(),
    address: row.address,
    network: row.network,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Creates a withdrawal request and atomically locks the gross Earned SP. No crypto
 * is transferred; payouts stay disabled. One pending request per account.
 */
export async function createWithdrawalRequest(
  db: PrismaClient,
  userId: number,
  input: { grossSp: bigint; address: string },
): Promise<WithdrawalView> {
  if (input.grossSp < MIN_GROSS_SP) throw new WithdrawalError('below_minimum')
  if (!validAddress(input.address)) throw new WithdrawalError('invalid_address')

  return db.$transaction(async (tx) => {
    const pending = await tx.withdrawalRequest.findFirst({
      where: { userId, status: { in: PENDING } },
      select: { id: true },
    })
    if (pending) throw new WithdrawalError('pending_exists')

    const row = await tx.withdrawalRequest.create({
      data: {
        userId,
        grossSp: input.grossSp,
        feeUsdt: feeUsdtString(),
        netUsdt: netUsdtString(input.grossSp),
        address: input.address,
        network: NETWORK,
        status: 'REQUESTED',
      },
    })
    await debitEarnedSp(tx, {
      userId,
      amountSp: input.grossSp,
      sourceType: 'WITHDRAWAL_LOCK',
      sourceId: BigInt(row.id),
      metadata: { requestId: row.id },
    })
    return toView(row)
  })
}

/** Cancels a pending request and releases the locked Earned SP. */
export async function cancelWithdrawalRequest(
  db: PrismaClient,
  userId: number,
  id: number,
): Promise<WithdrawalView> {
  return db.$transaction(async (tx) => {
    const row = await tx.withdrawalRequest.findFirst({ where: { id, userId } })
    if (!row) throw new WithdrawalError('not_found')
    if (row.status !== 'REQUESTED' && row.status !== 'ON_HOLD') throw new WithdrawalError('invalid_state')

    await creditSp(tx, {
      userId,
      bucket: 'EARNED',
      amountSp: row.grossSp,
      sourceType: 'WITHDRAWAL_RELEASE',
      sourceId: BigInt(row.id),
    })
    const updated = await tx.withdrawalRequest.update({
      where: { id },
      data: { status: 'CANCELLED', reviewedAt: new Date() },
    })
    return toView(updated)
  })
}

export type ReviewDecision = 'APPROVED' | 'REJECTED' | 'ON_HOLD'

/** Admin review transition. Never performs a payout. Rejection releases the lock. */
export async function reviewWithdrawal(
  db: PrismaClient,
  adminId: number,
  id: number,
  decision: ReviewDecision,
  note?: string,
): Promise<WithdrawalView> {
  return db.$transaction(async (tx) => {
    const row = await tx.withdrawalRequest.findUnique({ where: { id } })
    if (!row) throw new WithdrawalError('not_found')
    if (row.status === 'CANCELLED' || row.status === 'PAID' || row.status === 'REJECTED') {
      throw new WithdrawalError('invalid_state')
    }

    if (decision === 'REJECTED') {
      await creditSp(tx, {
        userId: row.userId,
        bucket: 'EARNED',
        amountSp: row.grossSp,
        sourceType: 'WITHDRAWAL_RELEASE',
        sourceId: BigInt(row.id),
      })
    }
    const updated = await tx.withdrawalRequest.update({
      where: { id },
      data: { status: decision, reviewedBy: adminId, reviewedAt: new Date(), note: note ?? null },
    })
    await tx.adminAuditLog.create({
      data: {
        actorId: adminId,
        action: `withdrawal.${decision.toLowerCase()}`,
        targetType: 'WithdrawalRequest',
        targetId: String(id),
        metadata: { userId: row.userId, grossSp: row.grossSp.toString(), note: note ?? null },
      },
    })
    return toView(updated)
  })
}

export async function listWithdrawals(db: PrismaClient, userId: number): Promise<WithdrawalView[]> {
  const rows = await db.withdrawalRequest.findMany({ where: { userId }, orderBy: { id: 'desc' } })
  return rows.map(toView)
}

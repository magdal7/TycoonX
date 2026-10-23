import type { Prisma, PrismaClient, WithdrawalStatus } from '@prisma/client'
import { isUniqueViolation } from '../lib/idempotency'
import { isPayoutConfirmed, isPayoutFailed, synthesizeWebhookEventId } from '../lib/oxapay'
import { isPayoutsEnabled } from '../lib/payments'
import { createPayout, getPayoutInfo, loadOxapayConfig, type OxapayConfig } from './oxapay'
import { creditSp, debitEarnedSp } from './spLedger'

/** Owner-approved withdrawal rules (Master Spec §9): USDT BEP20 only. */
export const MIN_GROSS_SP = 3000n // 3 USDT
export const FLAT_FEE_SP = 300n // 0.30 USDT == 300 SP at 1,000 SP/USDT
export const NETWORK = 'BEP20'
/** A new request is blocked for 24h after a successful payout (Master Spec §9). */
export const PAYOUT_COOLDOWN_MS = 24 * 60 * 60 * 1000

/**
 * Configurable wallet-change security hold (Master Spec §9): new withdrawal
 * requests are blocked for this long after the saved wallet changes. Default 24h.
 */
export function walletHoldMs(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.WITHDRAWAL_WALLET_HOLD_HOURS)
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
}

export type WithdrawalErrorCode =
  | 'below_minimum'
  | 'invalid_address'
  | 'pending_exists'
  | 'not_found'
  | 'invalid_state'
  | 'cooldown'
  | 'payouts_disabled'
  | 'not_submitted'
  | 'wallet_hold'
  | 'wallet_pending'
  | 'wallet_mismatch'

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
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user) throw new WithdrawalError('not_found')

    const pending = await tx.withdrawalRequest.findFirst({
      where: { userId, status: { in: PENDING } },
      select: { id: true },
    })
    if (pending) throw new WithdrawalError('pending_exists')

    const lastPaid = await tx.withdrawalRequest.findFirst({
      where: { userId, status: 'PAID' },
      orderBy: { updatedAt: 'desc' },
    })
    if (lastPaid) {
      const settledAt = (lastPaid.updatedAt ?? lastPaid.createdAt).getTime()
      if (Date.now() - settledAt < PAYOUT_COOLDOWN_MS) throw new WithdrawalError('cooldown')
    }

    // Saved wallet is authoritative. The first request saves it (no hold);
    // later requests must match it and respect the change-hold window.
    let address = user.withdrawalWallet
    if (address) {
      if (address.toLowerCase() !== input.address.toLowerCase()) throw new WithdrawalError('wallet_mismatch')
      const changedAt = user.withdrawalWalletChangedAt
      if (changedAt && Date.now() - changedAt.getTime() < walletHoldMs()) {
        throw new WithdrawalError('wallet_hold')
      }
    } else {
      address = input.address
      await tx.user.update({
        where: { id: userId },
        data: { withdrawalWallet: address, withdrawalWalletChangedAt: new Date() },
      })
    }

    const row = await tx.withdrawalRequest.create({
      data: {
        userId,
        grossSp: input.grossSp,
        feeUsdt: feeUsdtString(),
        netUsdt: netUsdtString(input.grossSp),
        address,
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

// ---------------------------------------------------------------------------
// Saved withdrawal wallet + change-hold (Master Spec §9)
// ---------------------------------------------------------------------------

export interface WithdrawalWalletView {
  address: string | null
  changedAt: string | null
  holdUntil: string | null
  holdActive: boolean
}

function walletView(user: {
  withdrawalWallet: string | null
  withdrawalWalletChangedAt: Date | null
}): WithdrawalWalletView {
  const changedAt = user.withdrawalWalletChangedAt
  const holdUntil = changedAt ? new Date(changedAt.getTime() + walletHoldMs()) : null
  return {
    address: user.withdrawalWallet ?? null,
    changedAt: changedAt ? changedAt.toISOString() : null,
    holdUntil: holdUntil ? holdUntil.toISOString() : null,
    holdActive: Boolean(holdUntil && holdUntil.getTime() > Date.now()),
  }
}

export async function getWithdrawalWallet(db: PrismaClient, userId: number): Promise<WithdrawalWalletView> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new WithdrawalError('not_found')
  return walletView(user)
}

/**
 * Sets or changes the saved BEP20 wallet. Blocked while a withdrawal is pending
 * (no redirection of in-flight funds). Changing the wallet restarts the hold.
 * A no-op when unchanged. Emits a non-sensitive security log (no address).
 */
export async function setWithdrawalWallet(
  db: PrismaClient,
  userId: number,
  address: string,
): Promise<WithdrawalWalletView> {
  if (!validAddress(address)) throw new WithdrawalError('invalid_address')

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user) throw new WithdrawalError('not_found')

    const pending = await tx.withdrawalRequest.findFirst({
      where: { userId, status: { in: PENDING } },
      select: { id: true },
    })
    if (pending) throw new WithdrawalError('wallet_pending')

    if (user.withdrawalWallet && user.withdrawalWallet.toLowerCase() === address.toLowerCase()) {
      return walletView(user)
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { withdrawalWallet: address, withdrawalWalletChangedAt: new Date() },
    })
    console.log(JSON.stringify({ scope: 'security.withdrawal_wallet', action: 'changed', userId }))
    return walletView(updated)
  })
}

// ---------------------------------------------------------------------------
// Payout execution + reconciliation (gated by PAYOUTS_ENABLED, disabled by
// default). Reuses the PaymentIntent/PaymentWebhookEvent machinery so a payout
// is submitted at most once per request and settled exactly once from a verified
// callback/reconciliation. No live transfer occurs while the gate is closed.
// ---------------------------------------------------------------------------

export const PAYOUT_PURPOSE = 'withdrawal'

function payoutIntentWhere(withdrawalId: number): Prisma.PaymentIntentWhereInput {
  return { purpose: PAYOUT_PURPOSE, metadata: { path: ['withdrawalRequestId'], equals: withdrawalId } }
}

export async function findWithdrawalPayoutIntent(db: PrismaClient, withdrawalId: number) {
  return db.paymentIntent.findFirst({ where: payoutIntentWhere(withdrawalId) })
}

export interface PayoutSubmission {
  withdrawalId: number
  trackId: string
  alreadySubmitted: boolean
}

/**
 * Submits an APPROVED withdrawal to the provider. Idempotent: the deterministic
 * anchor row (`externalId = wd_<id>`) is created before the provider call, so a
 * second call can never submit a duplicate payout. The anchor is removed only if
 * the provider call itself throws (safe to retry).
 */
export async function executeWithdrawalPayout(
  db: PrismaClient,
  withdrawalId: number,
  config: OxapayConfig = loadOxapayConfig(),
): Promise<PayoutSubmission> {
  if (!isPayoutsEnabled()) throw new WithdrawalError('payouts_disabled')

  const existing = await findWithdrawalPayoutIntent(db, withdrawalId)
  if (existing) {
    if (existing.externalId.startsWith('wd_')) throw new WithdrawalError('invalid_state')
    return { withdrawalId, trackId: existing.externalId, alreadySubmitted: true }
  }

  const row = await db.withdrawalRequest.findUnique({ where: { id: withdrawalId } })
  if (!row) throw new WithdrawalError('not_found')
  if (row.status !== 'APPROVED') throw new WithdrawalError('invalid_state')

  const intent = await db.paymentIntent.create({
    data: {
      userId: row.userId,
      provider: 'OXAPAY',
      externalId: `wd_${withdrawalId}`,
      amountUsdt: row.netUsdt,
      status: 'CREATED',
      purpose: PAYOUT_PURPOSE,
      payAddress: row.address,
      metadata: { withdrawalRequestId: withdrawalId },
    },
  })

  let payout
  try {
    payout = await createPayout(config, {
      address: row.address,
      currency: 'USDT',
      amount: row.netUsdt.toString(),
      network: NETWORK,
      description: `Withdrawal #${withdrawalId}`,
      ...(config.callbackUrl ? { callbackUrl: config.callbackUrl } : {}),
    })
  } catch (error) {
    try {
      await db.paymentIntent.delete({ where: { id: intent.id } })
    } catch {
      /* best-effort cleanup; the anchor remains for manual review */
    }
    throw error
  }

  await db.paymentIntent.update({
    where: { id: intent.id },
    data: {
      externalId: payout.trackId,
      status: 'PENDING',
      metadata: { withdrawalRequestId: withdrawalId, trackId: payout.trackId },
    },
  })
  return { withdrawalId, trackId: payout.trackId, alreadySubmitted: false }
}

export interface PayoutWebhookInput {
  eventId: string
  trackId: string
  status: string
  metadata?: Prisma.InputJsonValue
}

export type PayoutWebhookReason =
  | 'duplicate'
  | 'intent_not_found'
  | 'payouts_disabled'
  | 'pending'
  | 'settled'
  | 'reversed'
  | 'already_paid'

export interface PayoutWebhookResult {
  ignored: boolean
  reason?: PayoutWebhookReason
  withdrawalRequestId?: number
}

/**
 * Idempotent payout callback/reconciliation handler. A confirmed payout marks the
 * request PAID (the gross Earned SP was already debited at lock time, so nothing
 * is debited again). A failed payout releases the locked Earned SP back once and
 * marks the request REJECTED. Duplicate events are recorded and ignored.
 */
export async function processPayoutWebhook(
  db: PrismaClient,
  input: PayoutWebhookInput,
): Promise<PayoutWebhookResult> {
  let eventId: number
  try {
    const event = await db.paymentWebhookEvent.create({
      data: {
        provider: 'OXAPAY',
        eventId: input.eventId,
        status: 'RECEIVED',
        payload: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    eventId = event.id
  } catch (error) {
    if (isUniqueViolation(error)) return { ignored: true, reason: 'duplicate' }
    throw error
  }

  const intent = await db.paymentIntent.findUnique({ where: { externalId: input.trackId } })
  if (!intent || intent.purpose !== PAYOUT_PURPOSE) {
    await db.paymentWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'IGNORED', processedAt: new Date() },
    })
    return { ignored: true, reason: 'intent_not_found' }
  }

  const withdrawalRequestId = Number(
    (intent.metadata as Record<string, unknown> | null)?.withdrawalRequestId ?? Number.NaN,
  )
  if (!Number.isInteger(withdrawalRequestId)) {
    await db.paymentWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'IGNORED', processedAt: new Date(), paymentIntentId: intent.id },
    })
    return { ignored: true, reason: 'intent_not_found' }
  }

  if (!isPayoutsEnabled()) {
    await db.paymentWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'IGNORED', processedAt: new Date(), paymentIntentId: intent.id },
    })
    return { ignored: true, reason: 'payouts_disabled', withdrawalRequestId }
  }

  const outcome = await db.$transaction(async (tx) => {
    const row = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalRequestId } })
    if (!row) return 'intent_not_found' as const

    if (isPayoutConfirmed(input.status)) {
      // Never resurrect a request already settled as paid, rejected or cancelled.
      if (row.status === 'PAID' || row.status === 'REJECTED' || row.status === 'CANCELLED') {
        return 'already_paid' as const
      }
      await tx.withdrawalRequest.updateMany({
        where: { id: row.id, status: row.status },
        data: { status: 'PAID' },
      })
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      })
      await tx.adminAuditLog.create({
        data: {
          actorId: 0,
          action: 'withdrawal.paid',
          targetType: 'WithdrawalRequest',
          targetId: String(row.id),
          metadata: { trackId: input.trackId },
        },
      })
      return 'settled' as const
    }

    if (isPayoutFailed(input.status)) {
      if (row.status === 'PAID' || row.status === 'REJECTED') return 'already_paid' as const
      await creditSp(tx, {
        userId: row.userId,
        bucket: 'EARNED',
        amountSp: row.grossSp,
        sourceType: 'WITHDRAWAL_RELEASE',
        sourceId: BigInt(row.id),
        metadata: { reason: 'payout_failed', trackId: input.trackId },
      })
      await tx.withdrawalRequest.updateMany({
        where: { id: row.id, status: row.status },
        data: { status: 'REJECTED', note: 'payout_failed', reviewedAt: new Date() },
      })
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED' } })
      return 'reversed' as const
    }

    return 'pending' as const
  })

  await db.paymentWebhookEvent.update({
    where: { id: eventId },
    data: { status: 'PROCESSED', processedAt: new Date(), paymentIntentId: intent.id },
  })

  if (outcome === 'settled') return { ignored: false, reason: 'settled', withdrawalRequestId }
  if (outcome === 'reversed') return { ignored: false, reason: 'reversed', withdrawalRequestId }
  if (outcome === 'already_paid') return { ignored: true, reason: 'already_paid', withdrawalRequestId }
  if (outcome === 'pending') return { ignored: true, reason: 'pending', withdrawalRequestId }
  return { ignored: true, reason: 'intent_not_found' }
}

/** Independently reconciles a submitted payout against the provider lookup. */
export async function reconcileWithdrawalPayout(
  db: PrismaClient,
  withdrawalId: number,
  config: OxapayConfig = loadOxapayConfig(),
): Promise<PayoutWebhookResult> {
  if (!isPayoutsEnabled()) throw new WithdrawalError('payouts_disabled')
  const intent = await findWithdrawalPayoutIntent(db, withdrawalId)
  if (!intent || intent.externalId.startsWith('wd_')) throw new WithdrawalError('not_submitted')

  const info = await getPayoutInfo(config, intent.externalId)
  return processPayoutWebhook(db, {
    eventId: synthesizeWebhookEventId({
      trackId: intent.externalId,
      status: info.rawStatus,
      txHash: info.txHash ?? null,
    }),
    trackId: intent.externalId,
    status: info.rawStatus,
    metadata: { source: 'reconcile', status: info.rawStatus } as Prisma.InputJsonValue,
  })
}

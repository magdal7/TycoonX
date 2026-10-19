import type { Prisma, PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { isUniqueViolation } from '../lib/idempotency'
import {
  PAYMENTS_ENABLED,
  isValidUsdtAmount,
  nextIntentStatus,
  usdtToSp,
  type PaymentIntentStatusName,
} from '../lib/payments'
import { creditSp } from './spLedger'

export type PaymentErrorCode =
  | 'payments_disabled'
  | 'invalid_amount'
  | 'not_found'
  | 'invalid_state'
  | 'duplicate'

export class PaymentError extends Error {
  constructor(public code: PaymentErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'PaymentError'
  }
}

export const PAYMENT_PROVIDER = 'OXAPAY'

export type WebhookStatus = 'pending' | 'paid' | 'failed' | 'expired'

export interface ProcessWebhookInput {
  eventId: string
  externalId: string
  status: WebhookStatus
  amountUsdt?: string
  metadata?: Prisma.InputJsonValue
}

export interface ProcessWebhookResult {
  ignored: boolean
  reason?: 'payments_disabled' | 'intent_not_found' | 'duplicate' | 'non_confirming'
  paymentIntentId?: number
  confirmed?: boolean
}

function serializeIntent(row: {
  id: number
  userId: number
  provider: string
  externalId: string
  amountUsdt: { toString(): string }
  creditedSp: bigint | null
  status: string
  purpose: string
  payAddress: string | null
  payUrl: string | null
  createdAt: Date
  confirmedAt: Date | null
}) {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    externalId: row.externalId,
    amountUsdt: row.amountUsdt.toString(),
    creditedSp: row.creditedSp?.toString() ?? null,
    status: row.status,
    purpose: row.purpose,
    payAddress: row.payAddress,
    payUrl: row.payUrl,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
  }
}

/**
 * Creates a deposit invoice (OxaPay in future). DISABLED until payments are
 * activated; the invoice is still the intended entry point for the gateway.
 */
export async function createDepositIntent(db: PrismaClient, userId: number, amountUsdt: string) {
  if (!PAYMENTS_ENABLED) throw new PaymentError('payments_disabled')
  if (!isValidUsdtAmount(amountUsdt) || usdtToSp(amountUsdt) <= 0n) throw new PaymentError('invalid_amount')

  const intent = await db.paymentIntent.create({
    data: {
      userId,
      provider: PAYMENT_PROVIDER,
      externalId: `inv_${randomUUID()}`,
      amountUsdt,
      creditedSp: usdtToSp(amountUsdt),
      purpose: 'deposit',
      status: 'CREATED',
    },
  })
  return serializeIntent(intent)
}

export async function listUserPaymentIntents(db: PrismaClient, userId: number) {
  const rows = await db.paymentIntent.findMany({ where: { userId }, orderBy: { id: 'desc' }, take: 50 })
  return rows.map(serializeIntent)
}

/**
 * Confirms a deposit intent and credits SP exactly once. Uses the ledger's
 * unique source key as a second backstop. Deposits credit **Bonus SP**
 * (non-withdrawable) per Master Spec §2 (deposit-related bonuses); the bucket is
 * a documented safe default pending owner confirmation.
 */
export async function confirmDepositIntent(db: PrismaClient, paymentIntentId: number) {
  return db.$transaction(async (tx) => {
    const intent = await tx.paymentIntent.findUnique({ where: { id: paymentIntentId } })
    if (!intent) throw new PaymentError('not_found')

    const target = nextIntentStatus(intent.status as PaymentIntentStatusName, 'confirm')
    if (!target) throw new PaymentError('invalid_state')

    const guard = await tx.paymentIntent.updateMany({
      where: { id: paymentIntentId, status: intent.status },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    })
    if (guard.count !== 1) throw new PaymentError('invalid_state')

    const creditedSp = intent.creditedSp ?? usdtToSp(intent.amountUsdt.toString())
    if (creditedSp > 0n) {
      await creditSp(tx, {
        userId: intent.userId,
        bucket: 'BONUS',
        amountSp: creditedSp,
        sourceType: 'DEPOSIT_CREDIT',
        sourceId: BigInt(paymentIntentId),
        metadata: { externalId: intent.externalId, amountUsdt: intent.amountUsdt.toString() },
      })
    }
    const updated = await tx.paymentIntent.findUniqueOrThrow({ where: { id: paymentIntentId } })
    return serializeIntent(updated)
  })
}

/**
 * Processes a gateway webhook idempotently. DISABLED: while payments are off the
 * event is recorded and ignored (never credits). When enabled, a paid event
 * confirms the intent through the guarded transition.
 */
export async function processWebhook(
  db: PrismaClient,
  input: ProcessWebhookInput,
): Promise<ProcessWebhookResult> {
  // Idempotency: the (provider, eventId) unique row is the replay guard.
  let eventId: number
  try {
    const event = await db.paymentWebhookEvent.create({
      data: {
        provider: PAYMENT_PROVIDER,
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

  const intent = await db.paymentIntent.findUnique({ where: { externalId: input.externalId } })

  if (!PAYMENTS_ENABLED) {
    await db.paymentWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'IGNORED', processedAt: new Date(), paymentIntentId: intent?.id ?? null },
    })
    return { ignored: true, reason: 'payments_disabled', ...(intent ? { paymentIntentId: intent.id } : {}) }
  }

  if (!intent) {
    await db.paymentWebhookEvent.update({ where: { id: eventId }, data: { status: 'IGNORED', processedAt: new Date() } })
    return { ignored: true, reason: 'intent_not_found' }
  }

  if (input.status !== 'paid') {
    await db.paymentWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'PROCESSED', processedAt: new Date(), paymentIntentId: intent.id },
    })
    return { ignored: true, reason: 'non_confirming', paymentIntentId: intent.id }
  }

  await confirmDepositIntent(db, intent.id)
  await db.paymentWebhookEvent.update({
    where: { id: eventId },
    data: { status: 'PROCESSED', processedAt: new Date(), paymentIntentId: intent.id },
  })
  return { ignored: false, paymentIntentId: intent.id, confirmed: true }
}

export interface AdminPaymentFilter {
  status?: PaymentIntentStatusName
}

export async function listPaymentIntentsAdmin(db: PrismaClient, filter: AdminPaymentFilter = {}) {
  const rows = await db.paymentIntent.findMany({
    where: filter.status ? { status: filter.status } : undefined,
    orderBy: { id: 'desc' },
    take: 200,
    include: { user: { select: { username: true } } },
  })
  return rows.map((r) => ({ ...serializeIntent(r), username: r.user.username }))
}

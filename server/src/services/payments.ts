import type { Prisma, PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { isUniqueViolation } from '../lib/idempotency'
import { buildDepositDiagnostic, compareDecimal, evaluateDepositSettlement, synthesizeWebhookEventId } from '../lib/oxapay'
import { isSupportedDepositPair, normalizeAsset, normalizeNetwork } from '../lib/oxapayAssets'
import {
  isPaymentsEnabled,
  isValidUsdtAmount,
  minDepositUsdt,
  nextIntentStatus,
  usdtToSp,
  type PaymentIntentStatusName,
} from '../lib/payments'
import {
  createInvoice,
  getAcceptedCurrencies,
  getPaymentInfo,
  loadOxapayConfig,
  type OxapayConfig,
  type PaymentInfo,
} from './oxapay'
import { creditSp } from './spLedger'

export type PaymentErrorCode =
  | 'payments_disabled'
  | 'invalid_amount'
  | 'not_found'
  | 'invalid_state'
  | 'duplicate'
  | 'unsupported_pair'
  | 'asset_not_accepted'

export class PaymentError extends Error {
  constructor(public code: PaymentErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'PaymentError'
  }
}

export const PAYMENT_PROVIDER = 'OXAPAY'

export type ProcessWebhookReason =
  | 'payments_disabled'
  | 'intent_not_found'
  | 'duplicate'
  | 'non_confirming'
  | 'amount_missing'
  | 'amount_mismatch'
  | 'order_mismatch'
  | 'unsupported_asset'
  | 'unsupported_network'
  | 'unsupported_pair'
  | 'asset_mismatch'
  | 'network_mismatch'
  | 'already_confirmed'

export interface ProcessWebhookInput {
  eventId: string
  externalId: string
  status: string
  amountUsdt?: string
  orderId?: string
  asset?: string
  network?: string
  metadata?: Prisma.InputJsonValue
}

export interface ProcessWebhookResult {
  ignored: boolean
  reason?: ProcessWebhookReason
  paymentIntentId?: number
  confirmed?: boolean
  alreadyConfirmed?: boolean
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
  metadata?: Prisma.JsonValue | null
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
    expectedAsset: readMetadataString(row.metadata ?? null, 'asset') ?? null,
    expectedNetwork: readMetadataString(row.metadata ?? null, 'network') ?? null,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
  }
}

/**
 * Reads a non-empty string field from a Prisma JSON metadata blob.
 */
function readMetadataString(
  metadata: Prisma.JsonValue | null | undefined,
  key: string,
): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/** Structured, non-sensitive settlement logging (no payloads/keys/signatures/PII). */
function logDepositDiagnostic(diagnostic: ReturnType<typeof buildDepositDiagnostic>): void {
  console.log(JSON.stringify({ scope: 'oxapay.deposit', ...diagnostic }))
}

/** Optional user-selected deposit asset/network (verified against the allowlist). */
export interface DepositSelection {
  asset?: string
  network?: string
}

/**
 * Creates an OxaPay invoice and persists the intent. Internal helper kept
 * ungated so it can be exercised directly by tests; the public entry point
 * `createDepositIntent` enforces the `PAYMENTS_ENABLED` gate.
 *
 * When a selection is supplied, its asset/network must be a verified allowlisted
 * pair AND the asset must be enabled in the merchant's OxaPay accepted
 * currencies. The canonical pair is stored as the intent expectation so the
 * callback is validated against it. The invoice amount stays USD-denominated
 * (OxaPay's invoice API lets the payer choose the asset/network).
 */
export async function createDepositInvoice(
  db: PrismaClient,
  config: OxapayConfig,
  userId: number,
  amountUsdt: string,
  selection?: DepositSelection,
) {
  const metadata: Record<string, unknown> = { orderId: `dep_${randomUUID()}` }

  if (selection && (selection.asset || selection.network)) {
    const asset = normalizeAsset(selection.asset)
    const network = normalizeNetwork(selection.network)
    if (!asset || !network || !isSupportedDepositPair(asset, network)) {
      throw new PaymentError('unsupported_pair')
    }
    const accepted = await getAcceptedCurrencies(config)
    const acceptedAssets = new Set(
      accepted.map((symbol) => normalizeAsset(symbol)).filter((symbol): symbol is string => Boolean(symbol)),
    )
    if (!acceptedAssets.has(asset)) throw new PaymentError('asset_not_accepted')
    metadata.asset = asset
    metadata.network = network
  }

  const invoice = await createInvoice(config, {
    amountUsdt,
    orderId: String(metadata.orderId),
    // Merchant dashboard has "payer pays fees" enabled; send it explicitly.
    feePaidByPayer: true,
    ...(config.callbackUrl ? { callbackUrl: config.callbackUrl } : {}),
    description: 'TycoonX deposit',
  })

  const intent = await db.paymentIntent.create({
    data: {
      userId,
      provider: PAYMENT_PROVIDER,
      externalId: invoice.trackId,
      amountUsdt,
      creditedSp: usdtToSp(amountUsdt),
      purpose: 'deposit',
      status: 'CREATED',
      payUrl: invoice.paymentUrl,
      metadata: { ...metadata, expiredAt: invoice.expiredAt },
    },
  })
  return serializeIntent(intent)
}

/**
 * Creates a deposit invoice (OxaPay in future). DISABLED until payments are
 * activated; while disabled this always throws and no invoice is created.
 */
export async function createDepositIntent(
  db: PrismaClient,
  userId: number,
  amountUsdt: string,
  config?: OxapayConfig,
  selection?: DepositSelection,
) {
  if (!isPaymentsEnabled()) throw new PaymentError('payments_disabled')
  if (!isValidUsdtAmount(amountUsdt) || usdtToSp(amountUsdt) <= 0n) throw new PaymentError('invalid_amount')
  if (compareDecimal(amountUsdt, minDepositUsdt()) < 0) throw new PaymentError('invalid_amount')
  return createDepositInvoice(db, config ?? loadOxapayConfig(), userId, amountUsdt, selection)
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
        // Confirmed real deposit: this Bonus SP is the referral commission base.
        depositFunded: true,
      })
    }
    const updated = await tx.paymentIntent.findUniqueOrThrow({ where: { id: paymentIntentId } })
    return serializeIntent(updated)
  })
}

/**
 * Processes a gateway webhook idempotently. DISABLED: while payments are off the
 * event is recorded and ignored (never credits). When enabled, a `paid` event is
 * only settled after amount/order/currency consistency checks against the stored
 * intent, then confirmed through the guarded transition.
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
    if (!isUniqueViolation(error)) throw error
    // A replayed delivery of a known transition is ignored. A transition that
    // was recorded IGNORED *and* matched to a real intent (payments were
    // disabled, or a since-fixed verification failure) may be safely
    // re-evaluated: the SP-ledger unique source key still guarantees the credit
    // happens at most once. Unmatched IGNORED events (unknown track id) keep
    // their dedup behaviour.
    const existing = await db.paymentWebhookEvent.findUnique({
      where: { provider_eventId: { provider: PAYMENT_PROVIDER, eventId: input.eventId } },
      select: { id: true, status: true, paymentIntentId: true },
    })
    const recoverable = existing?.status === 'IGNORED' && existing.paymentIntentId != null
    if (!recoverable) return { ignored: true, reason: 'duplicate' }
    const reopened = await db.paymentWebhookEvent.update({
      where: { id: existing.id },
      data: {
        status: 'RECEIVED',
        processedAt: null,
        paymentIntentId: null,
        payload: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    eventId = reopened.id
  }

  const intent = await db.paymentIntent.findUnique({ where: { externalId: input.externalId } })

  if (!isPaymentsEnabled()) {
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

  if (intent.status === 'CONFIRMED') {
    await db.paymentWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'PROCESSED', processedAt: new Date(), paymentIntentId: intent.id },
    })
    logDepositDiagnostic(
      buildDepositDiagnostic({
        outcome: 'already_confirmed',
        status: input.status,
        asset: input.asset ?? null,
        network: input.network ?? null,
        invoiceAmountUsdt: intent.amountUsdt.toString(),
        paymentIntentId: intent.id,
      }),
    )
    return {
      ignored: true,
      reason: 'already_confirmed',
      paymentIntentId: intent.id,
      confirmed: true,
      alreadyConfirmed: true,
    }
  }

  const decision = evaluateDepositSettlement(
    {
      status: input.status,
      amount: input.amountUsdt ?? null,
      asset: input.asset ?? null,
      network: input.network ?? null,
      orderId: input.orderId ?? null,
    },
    {
      amountUsdt: intent.amountUsdt.toString(),
      orderId: readMetadataString(intent.metadata, 'orderId'),
      asset: readMetadataString(intent.metadata, 'asset'),
      network: readMetadataString(intent.metadata, 'network'),
    },
  )

  if (!decision.settle) {
    // Non-confirming provider statuses are expected transitions; verification
    // failures are recorded as IGNORED. Neither credits anything.
    const eventStatus = decision.reason === 'non_confirming' ? 'PROCESSED' : 'IGNORED'
    await db.paymentWebhookEvent.update({
      where: { id: eventId },
      data: { status: eventStatus, processedAt: new Date(), paymentIntentId: intent.id },
    })
    logDepositDiagnostic(
      buildDepositDiagnostic({
        outcome: decision.reason,
        status: input.status,
        asset: input.asset ?? null,
        network: input.network ?? null,
        invoiceAmountUsdt: input.amountUsdt ?? null,
        paymentIntentId: intent.id,
      }),
    )
    return { ignored: true, reason: decision.reason, paymentIntentId: intent.id }
  }

  try {
    await confirmDepositIntent(db, intent.id)
  } catch (error) {
    // A concurrent callback may have confirmed the intent first; that is a
    // successful exactly-once outcome, not an error to retry.
    if (!(error instanceof PaymentError && error.code === 'invalid_state')) throw error
  }
  await db.paymentWebhookEvent.update({
    where: { id: eventId },
    data: { status: 'PROCESSED', processedAt: new Date(), paymentIntentId: intent.id },
  })
  logDepositDiagnostic(
    buildDepositDiagnostic({
      outcome: 'settled',
      status: input.status,
      asset: input.asset ?? null,
      network: input.network ?? null,
      invoiceAmountUsdt: intent.amountUsdt.toString(),
      creditedSp: intent.creditedSp ?? usdtToSp(intent.amountUsdt.toString()),
      paymentIntentId: intent.id,
    }),
  )
  return { ignored: false, paymentIntentId: intent.id, confirmed: true }
}

/**
 * Maps a provider payment lookup into the same normalized webhook input used by
 * callbacks, so reconciliation shares replay protection and settlement rules.
 */
export function buildReconciliationInput(trackId: string, info: PaymentInfo): ProcessWebhookInput {
  const tx = info.transactions.find((t) => t.txHash) ?? info.transactions[0]
  const txHash = tx?.txHash ?? null
  const rawStatus = info.rawStatus || info.status || 'unknown'
  return {
    eventId: synthesizeWebhookEventId({ trackId, status: rawStatus, txHash }),
    externalId: trackId,
    status: rawStatus,
    ...(info.amount ? { amountUsdt: info.amount } : {}),
    ...(info.orderId ? { orderId: info.orderId } : {}),
    ...(tx?.currency ? { asset: tx.currency } : {}),
    ...(tx?.network ? { network: tx.network } : {}),
    metadata: { source: 'reconcile', status: info.rawStatus } as Prisma.InputJsonValue,
  }
}

/**
 * Independently reconciles a deposit intent against the provider's payment
 * lookup. Gated by `PAYMENTS_ENABLED` and replay-safe through the same webhook
 * event uniqueness used by callbacks. Intended for the admin reconcile endpoint.
 */
export async function reconcileDepositIntent(
  db: PrismaClient,
  config: OxapayConfig,
  paymentIntentId: number,
): Promise<ProcessWebhookResult> {
  if (!isPaymentsEnabled()) throw new PaymentError('payments_disabled')

  const intent = await db.paymentIntent.findUnique({ where: { id: paymentIntentId } })
  if (!intent) throw new PaymentError('not_found')
  if (intent.status === 'CONFIRMED') {
    return {
      ignored: true,
      reason: 'already_confirmed',
      paymentIntentId: intent.id,
      confirmed: true,
      alreadyConfirmed: true,
    }
  }

  const info = await getPaymentInfo(config, intent.externalId)
  return processWebhook(db, buildReconciliationInput(intent.externalId, info))
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

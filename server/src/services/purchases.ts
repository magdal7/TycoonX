import type { PrismaClient } from '@prisma/client'
import { isUniqueViolation } from '../lib/idempotency'
import { PAYMENTS_ENABLED, nextPurchaseStatus, usdtToSp, type PurchaseStatusName } from '../lib/payments'
import { assertOwnershipCapacity, OwnershipLimitError } from './ownership'
import { recordReferralPurchaseEvent } from './referrals'

export type PurchaseErrorCode =
  | 'payments_disabled'
  | 'not_found'
  | 'not_for_sale'
  | 'invalid_price'
  | 'invalid_state'
  | 'ownership_limit'

export class PurchaseError extends Error {
  constructor(public code: PurchaseErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'PurchaseError'
  }
}

interface PurchaseRow {
  id: number
  userId: number
  ceoId: number
  priceUsdSnap: { toString(): string }
  status: string
  paymentIntentId: number | null
  ownedCeoId: number | null
  createdAt: Date
  paidAt: Date | null
  deliveredAt: Date | null
}

function serializePurchase(row: PurchaseRow, extra: { ceoName?: string; username?: string } = {}) {
  return {
    id: row.id,
    userId: row.userId,
    ceoId: row.ceoId,
    priceUsd: row.priceUsdSnap.toString(),
    status: row.status,
    paymentIntentId: row.paymentIntentId,
    ownedCeoId: row.ownedCeoId,
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    ...extra,
  }
}

/**
 * Creates a CEO purchase against the server-side catalog price. DISABLED until
 * payments are activated. Idempotent on `idempotencyKey`.
 */
export async function createPurchase(
  db: PrismaClient,
  userId: number,
  ceoId: number,
  idempotencyKey: string,
) {
  if (!PAYMENTS_ENABLED) throw new PurchaseError('payments_disabled')

  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.ceoPurchase.findUnique({ where: { idempotencyKey } })
      if (existing) return serializePurchase(existing)

      const ceo = await tx.cEO.findUnique({ where: { id: ceoId } })
      if (!ceo) throw new PurchaseError('not_found')
      if (!ceo.isActive || !ceo.isForSale) throw new PurchaseError('not_for_sale')

      const priceUsd = ceo.priceUsd.toString()
      if (usdtToSp(priceUsd) <= 0n) throw new PurchaseError('invalid_price')

      try {
        await assertOwnershipCapacity(tx, userId, ceo)
      } catch (error) {
        if (error instanceof OwnershipLimitError) throw new PurchaseError('ownership_limit')
        throw error
      }

      const purchase = await tx.ceoPurchase.create({
        data: { userId, ceoId, priceUsdSnap: priceUsd, status: 'PENDING', idempotencyKey },
      })
      const intent = await tx.paymentIntent.create({
        data: {
          userId,
          provider: 'OXAPAY',
          externalId: `inv_${purchase.id}_${Date.now().toString(36)}`,
          amountUsdt: priceUsd,
          purpose: 'purchase',
          status: 'CREATED',
        },
      })
      const linked = await tx.ceoPurchase.update({
        where: { id: purchase.id },
        data: { paymentIntentId: intent.id },
      })
      return serializePurchase(linked)
    })
  } catch (error) {
    // Concurrent identical request: reconcile to the persisted row.
    if (isUniqueViolation(error)) {
      const existing = await db.ceoPurchase.findUnique({ where: { idempotencyKey } })
      if (existing) return serializePurchase(existing)
    }
    throw error
  }
}

/** Marks a purchase paid after a verified payment. Guarded PENDING -> PAID. */
export async function markPurchasePaid(db: PrismaClient, purchaseId: number) {
  const target = nextPurchaseStatus('PENDING', 'pay')
  const guard = await db.ceoPurchase.updateMany({
    where: { id: purchaseId, status: 'PENDING' },
    data: { status: target!, paidAt: new Date() },
  })
  if (guard.count !== 1) throw new PurchaseError('invalid_state')
  const row = await db.ceoPurchase.findUniqueOrThrow({ where: { id: purchaseId } })
  return serializePurchase(row)
}

export interface DeliverResult {
  purchaseId: number
  ownedCeoId: number
  alreadyDelivered: boolean
}

/**
 * Delivers ownership exactly once. The PAID -> DELIVERED transition is guarded
 * and `ownedCeoId` is unique, so concurrent/duplicate deliveries cannot create a
 * second copy. Links the confirmed purchase to the referral purchase-event
 * system (commissions remain disabled).
 *
 * Only acts on PAID purchases, which are unreachable while payments are disabled
 * (creation is gated and webhooks are ignored), so this is inert until go-live.
 */
export async function deliverPurchase(db: PrismaClient, purchaseId: number): Promise<DeliverResult> {
  const result = await db.$transaction(async (tx) => {
    const purchase = await tx.ceoPurchase.findUnique({ where: { id: purchaseId }, include: { ceo: true } })
    if (!purchase) throw new PurchaseError('not_found')
    if (purchase.status === 'DELIVERED' && purchase.ownedCeoId) {
      return { purchaseId, ownedCeoId: purchase.ownedCeoId, alreadyDelivered: true, priceUsd: purchase.priceUsdSnap.toString(), userId: purchase.userId }
    }
    if (purchase.status !== 'PAID') throw new PurchaseError('invalid_state')

    try {
      await assertOwnershipCapacity(tx, purchase.userId, purchase.ceo)
    } catch (error) {
      if (error instanceof OwnershipLimitError) throw new PurchaseError('ownership_limit')
      throw error
    }

    const owned = await tx.ownedCeo.create({
      data: { userId: purchase.userId, templateId: purchase.ceoId, acquisitionType: 'PURCHASE', status: 'IDLE' },
      select: { id: true },
    })
    const guard = await tx.ceoPurchase.updateMany({
      where: { id: purchaseId, status: 'PAID' },
      data: { status: 'DELIVERED', ownedCeoId: owned.id, deliveredAt: new Date() },
    })
    if (guard.count !== 1) throw new PurchaseError('invalid_state')
    return { purchaseId, ownedCeoId: owned.id, alreadyDelivered: false, priceUsd: purchase.priceUsdSnap.toString(), userId: purchase.userId }
  })

  // Link to referral commission pipeline (idempotent; commissions remain disabled).
  try {
    await recordReferralPurchaseEvent(db, {
      purchaseRef: `purchase:${purchaseId}`,
      referredUserId: result.userId,
      valueSp: usdtToSp(result.priceUsd),
      status: 'SETTLED',
      occurredAt: new Date(),
      metadata: { purchaseId },
    })
  } catch {
    /* referral linkage must never block delivery */
  }

  return { purchaseId: result.purchaseId, ownedCeoId: result.ownedCeoId, alreadyDelivered: result.alreadyDelivered }
}

export async function listUserPurchases(db: PrismaClient, userId: number) {
  const rows = await db.ceoPurchase.findMany({
    where: { userId },
    orderBy: { id: 'desc' },
    take: 50,
    include: { ceo: { select: { name: true } } },
  })
  return rows.map((r) => serializePurchase(r, { ceoName: r.ceo.name }))
}

export async function listPurchasesAdmin(
  db: PrismaClient,
  filter: { status?: PurchaseStatusName } = {},
) {
  const rows = await db.ceoPurchase.findMany({
    where: filter.status ? { status: filter.status } : undefined,
    orderBy: { id: 'desc' },
    take: 200,
    include: { user: { select: { username: true } }, ceo: { select: { name: true } } },
  })
  return rows.map((r) => serializePurchase(r, { ceoName: r.ceo.name, username: r.user.username }))
}

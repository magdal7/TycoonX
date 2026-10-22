import type { PrismaClient } from '@prisma/client'
import { isUniqueViolation } from '../lib/idempotency'
import { PAYMENTS_ENABLED, nextPurchaseStatus, usdtToSp, type PurchaseStatusName } from '../lib/payments'
import { assertOwnershipCapacity, OwnershipLimitError } from './ownership'
import { recordReferralPurchaseEvent } from './referrals'
import { InsufficientSpError, spendSp } from './spLedger'

export type PurchaseErrorCode =
  | 'payments_disabled'
  | 'not_found'
  | 'not_for_sale'
  | 'invalid_price'
  | 'invalid_state'
  | 'ownership_limit'
  | 'insufficient_sp'

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
 * Purchases a CEO with SP (Bonus SP first, then Earned SP) at the owner-confirmed
 * conversion (1 USDT = 1,000 SP), atomically and idempotently on `idempotencyKey`.
 * Ownership capacity (maxOwned) is enforced server-side; a concurrent duplicate
 * request rolls back its SP spend via the unique idempotency key.
 */
export async function createPurchase(
  db: PrismaClient,
  userId: number,
  ceoId: number,
  idempotencyKey: string,
) {
  if (!PAYMENTS_ENABLED) throw new PurchaseError('payments_disabled')

  const result = await (async () => {
    try {
      return await db.$transaction(async (tx) => {
        const existing = await tx.ceoPurchase.findUnique({ where: { idempotencyKey } })
        if (existing) {
          return {
            row: existing,
            ceoName: undefined as string | undefined,
            priceSp: usdtToSp(existing.priceUsdSnap.toString()),
            already: true,
          }
        }

        const ceo = await tx.cEO.findUnique({ where: { id: ceoId } })
        if (!ceo) throw new PurchaseError('not_found')
        if (!ceo.isActive || !ceo.isForSale) throw new PurchaseError('not_for_sale')

        const priceUsd = ceo.priceUsd.toString()
        const priceSp = usdtToSp(priceUsd)
        if (priceSp <= 0n) throw new PurchaseError('invalid_price')

        try {
          await assertOwnershipCapacity(tx, userId, ceo)
        } catch (error) {
          if (error instanceof OwnershipLimitError) throw new PurchaseError('ownership_limit')
          throw error
        }

        try {
          await spendSp(tx, {
            userId,
            amountSp: priceSp,
            sourceType: 'CEO_PURCHASE',
            metadata: { ceoId, priceUsd, priceSp: priceSp.toString() },
          })
        } catch (error) {
          if (error instanceof InsufficientSpError) throw new PurchaseError('insufficient_sp')
          throw error
        }

        const owned = await tx.ownedCeo.create({
          data: { userId, templateId: ceoId, acquisitionType: 'PURCHASE', status: 'IDLE' },
          select: { id: true },
        })
        const now = new Date()
        const purchase = await tx.ceoPurchase.create({
          data: {
            userId,
            ceoId,
            priceUsdSnap: priceUsd,
            status: 'DELIVERED',
            ownedCeoId: owned.id,
            idempotencyKey,
            paidAt: now,
            deliveredAt: now,
          },
        })
        return { row: purchase, ceoName: ceo.name, priceSp, already: false }
      })
    } catch (error) {
      // Concurrent identical request: the loser rolls back and reconciles here.
      if (isUniqueViolation(error)) {
        const existing = await db.ceoPurchase.findUnique({ where: { idempotencyKey } })
        if (existing) {
          return {
            row: existing,
            ceoName: undefined as string | undefined,
            priceSp: usdtToSp(existing.priceUsdSnap.toString()),
            already: true,
          }
        }
      }
      throw error
    }
  })()

  if (!result.already) {
    try {
      await recordReferralPurchaseEvent(db, {
        purchaseRef: `purchase:${result.row.id}`,
        referredUserId: userId,
        valueSp: result.priceSp,
        status: 'SETTLED',
        occurredAt: new Date(),
        metadata: { purchaseId: result.row.id, ceoId },
      })
    } catch {
      /* referral linkage must never block a purchase */
    }
  }

  return serializePurchase(result.row, result.ceoName ? { ceoName: result.ceoName } : {})
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

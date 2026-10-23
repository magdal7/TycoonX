import type { Prisma, PrismaClient } from '@prisma/client'
import { getSpBalances } from './spLedger'
import { isPaymentsEnabled, isPayoutsEnabled, spToUsdtString, usdtToSp } from '../lib/payments'

const PENDING_WITHDRAWAL = ['REQUESTED', 'ON_HOLD', 'APPROVED'] as const

/**
 * Wallet summary. USDT balance reflects confirmed deposits minus paid-out
 * withdrawals; while payments are disabled it is always 0 (never simulated).
 */
export async function getWalletSummary(db: PrismaClient, userId: number) {
  const [balances, depositAgg, paidOutAgg, pendingAgg] = await Promise.all([
    getSpBalances(db as unknown as Prisma.TransactionClient, userId),
    db.paymentIntent.aggregate({
      _sum: { amountUsdt: true },
      where: { userId, purpose: 'deposit', status: 'CONFIRMED' },
    }),
    db.withdrawalRequest.aggregate({ _sum: { netUsdt: true }, where: { userId, status: 'PAID' } }),
    db.withdrawalRequest.aggregate({
      _sum: { grossSp: true },
      where: { userId, status: { in: PENDING_WITHDRAWAL as unknown as never } },
    }),
  ])

  const depositedUsdt = depositAgg._sum.amountUsdt?.toString() ?? '0'
  const paidOutUsdt = paidOutAgg._sum.netUsdt?.toString() ?? '0'
  const usdtBalanceSp = usdtToSp(depositedUsdt) - usdtToSp(paidOutUsdt)

  return {
    sp: {
      earnedSp: balances.earnedSp.toString(),
      bonusSp: balances.bonusSp.toString(),
      totalSp: (balances.earnedSp + balances.bonusSp).toString(),
      lifetimeEarnedSp: balances.lifetimeEarnedSp.toString(),
    },
    usdt: {
      balance: spToUsdtString(usdtBalanceSp, 2),
      deposited: depositedUsdt,
      paidOut: paidOutUsdt,
    },
    pendingWithdrawalSp: (pendingAgg._sum.grossSp ?? 0n).toString(),
    paymentsEnabled: isPaymentsEnabled(),
    payoutsEnabled: isPayoutsEnabled(),
  }
}

export interface WalletTransaction {
  id: string
  type: 'SP' | 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE'
  label: string
  amount: string
  bucket?: string
  status?: string
  createdAt: string
}

/** Merged, newest-first wallet transaction history (SP ledger + deposits + withdrawals + purchases). */
export async function getWalletTransactions(db: PrismaClient, userId: number): Promise<WalletTransaction[]> {
  const [ledger, deposits, withdrawals, purchases] = await Promise.all([
    db.spLedgerEntry.findMany({ where: { userId }, orderBy: { id: 'desc' }, take: 50 }),
    db.paymentIntent.findMany({ where: { userId, purpose: 'deposit' }, orderBy: { id: 'desc' }, take: 25 }),
    db.withdrawalRequest.findMany({ where: { userId }, orderBy: { id: 'desc' }, take: 25 }),
    db.ceoPurchase.findMany({ where: { userId }, orderBy: { id: 'desc' }, take: 25, include: { ceo: { select: { name: true } } } }),
  ])

  const rows: WalletTransaction[] = [
    ...ledger.map((e) => ({
      id: `sp:${e.id}`,
      type: 'SP' as const,
      label: e.sourceType.replace(/_/g, ' ').toLowerCase(),
      amount: e.amountSp.toString(),
      bucket: e.bucket,
      createdAt: e.createdAt.toISOString(),
    })),
    ...deposits.map((d) => ({
      id: `deposit:${d.id}`,
      type: 'DEPOSIT' as const,
      label: 'Deposit',
      amount: d.amountUsdt.toString(),
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    })),
    ...withdrawals.map((w) => ({
      id: `withdrawal:${w.id}`,
      type: 'WITHDRAWAL' as const,
      label: 'Withdrawal request',
      amount: w.grossSp.toString(),
      status: w.status,
      createdAt: w.createdAt.toISOString(),
    })),
    ...purchases.map((p) => ({
      id: `purchase:${p.id}`,
      type: 'PURCHASE' as const,
      label: `CEO purchase · ${p.ceo.name}`,
      amount: p.priceUsdSnap.toString(),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
  ]

  return rows
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, 60)
}

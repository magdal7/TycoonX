import type { Prisma, PrismaClient } from '@prisma/client'
import { claimIdempotencyKey, isUniqueViolation } from '../lib/idempotency'
import {
  EQUIPMENT,
  equipmentRank,
  cycleRewardSp,
  clampRewardToCap,
  type EquipmentTierName,
} from '../lib/gameMath'
import { creditSp, getSpBalances, spendSp } from './spLedger'
import { recordTaskEvent } from './tasks'

export type ProductionErrorCode =
  | 'not_found'
  | 'already_producing'
  | 'exhausted'
  | 'not_ready'
  | 'no_cycle'
  | 'template_rate_missing'
  | 'cap_missing'
  | 'invalid_equipment'

export class ProductionError extends Error {
  readonly code: ProductionErrorCode
  constructor(code: ProductionErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'ProductionError'
    this.code = code
  }
}

export interface CycleView {
  id: string
  ownedCeoId: number
  status: string
  startsAt: string
  endsAt: string
  equipment: string
  cycleHours: number
  rewardSp: string
}

export interface StartResult {
  cycle: CycleView
  replayed: boolean
}

export interface CollectResult {
  ownedCeoId: number
  cycleId: string
  rewardSp: string
  alreadyCollected: boolean
  balanceSp: string
  status: string
}

function hoursFor(tier: EquipmentTierName): number {
  return EQUIPMENT[tier].hours
}

function toCycleView(cycle: {
  id: bigint
  ownedCeoId: number
  status: string
  startsAt: Date
  endsAt: Date
  equipmentSnap: string
  cycleHoursSnap: number
  rewardSpSnap: bigint
}): CycleView {
  return {
    id: cycle.id.toString(),
    ownedCeoId: cycle.ownedCeoId,
    status: cycle.status,
    startsAt: cycle.startsAt.toISOString(),
    endsAt: cycle.endsAt.toISOString(),
    equipment: cycle.equipmentSnap,
    cycleHours: cycle.cycleHoursSnap,
    rewardSp: cycle.rewardSpSnap.toString(),
  }
}

const PRODUCING = 'PRODUCING'

/**
 * Starts a manual production cycle on one owned copy. Server-authoritative:
 * validates ownership, exhaustion, open-cycle exclusivity, and remaining lifetime
 * cap; freezes the reward inputs; sets the copy to PRODUCING. Idempotent per copy
 * via a stable idempotency key, with the open-cycle partial unique index as a
 * concurrency backstop.
 */
export async function startProduction(
  prisma: PrismaClient,
  userId: number,
  ownedCeoId: number,
): Promise<StartResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const owned = await tx.ownedCeo.findFirst({
        where: { id: ownedCeoId, userId },
        include: { template: true },
      })
      if (!owned) throw new ProductionError('not_found')

      if (owned.archivedAt || owned.status === 'EXHAUSTED') throw new ProductionError('exhausted')

      const open = await tx.productionCycle.findFirst({
        where: { ownedCeoId, status: PRODUCING },
      })
      if (open) throw new ProductionError('already_producing')

      const nominal = owned.template.nominalSpPer24h ?? (owned.template.baseSpPerCycle ?? 0) * 6
      if (nominal <= 0) throw new ProductionError('template_rate_missing')

      // A finite lifetime Earned-SP cap is mandatory (Master Spec §3). Without a
      // configured cap the copy cannot produce, so no unbacked SP is issued.
      if (owned.template.lifetimeCapSp == null) throw new ProductionError('cap_missing')

      const tier = owned.equipment as EquipmentTierName
      const hours = hoursFor(tier)
      const cap = Number(owned.template.lifetimeCapSp)
      const already = Number(owned.lifetimeEarnedSp)
      const rewardSp = clampRewardToCap(cycleRewardSp(nominal, hours), cap, already)
      if (rewardSp <= 0) throw new ProductionError('exhausted')

      const startsAt = new Date()
      const endsAt = new Date(startsAt.getTime() + hours * 60 * 60 * 1000)

      // Concurrency is guarded by the partial unique index
      // ProductionCycle_open_owned_key (one PRODUCING row per owned copy); a
      // duplicate start raises P2002 and is reconciled to a replay below. No
      // per-copy idempotency key is used here, so a copy can start again after
      // its previous cycle is collected.
      const cycle = await tx.productionCycle.create({
        data: {
          userId,
          ownedCeoId,
          status: PRODUCING,
          startsAt,
          endsAt,
          nominalSpPer24hSnap: nominal,
          equipmentSnap: owned.equipment,
          cycleHoursSnap: hours,
          rewardSpSnap: BigInt(rewardSp),
          lifetimeCapSnap: BigInt(cap),
        },
      })
      await tx.ownedCeo.update({ where: { id: ownedCeoId }, data: { status: 'PRODUCING' } })
      await recordTaskEvent(tx, userId, 'CYCLE_START')
      return { cycle: toCycleView(cycle), replayed: false }
    }, { maxWait: 15_000, timeout: 30_000 })
  } catch (error) {
    if (error instanceof ProductionError) throw error
    if (isUniqueViolation(error)) {
      // Either the per-copy start key or the open-cycle index already exists.
      const open = await prisma.productionCycle.findFirst({
        where: { ownedCeoId, status: PRODUCING },
      })
      if (open) return { cycle: toCycleView(open), replayed: true }
    }
    throw error
  }
}

/**
 * Collects a completed cycle exactly once. The atomic PRODUCING -> CLAIMED guard is
 * the single-winner check; the immutable ledger unique constraint is the final
 * anti-double-credit backstop. Advances the copy's lifetime Earned-SP counter and
 * archives it (EXHAUSTED) when the lifetime cap is reached.
 */
export async function collectProduction(
  prisma: PrismaClient,
  userId: number,
  ownedCeoId: number,
): Promise<CollectResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const cycle = await tx.productionCycle.findFirst({
        where: { ownedCeoId, userId, status: PRODUCING },
      })
      if (!cycle) {
        const claimed = await tx.productionCycle.findFirst({
          where: { ownedCeoId, userId, status: 'CLAIMED' },
          orderBy: { claimedAt: 'desc' },
        })
        if (claimed) {
          const balances = await getSpBalances(tx, userId)
          return {
            ownedCeoId,
            cycleId: claimed.id.toString(),
            rewardSp: claimed.rewardSpSnap.toString(),
            alreadyCollected: true,
            balanceSp: (balances.earnedSp + balances.bonusSp).toString(),
            status: 'CLAIMED',
          }
        }
        throw new ProductionError('no_cycle')
      }

      if (Date.now() < cycle.endsAt.getTime()) throw new ProductionError('not_ready')

      await claimIdempotencyKey(tx, userId, `cycle_collect:${ownedCeoId}`, cycle.id.toString())

      const guard = await tx.productionCycle.updateMany({
        where: { id: cycle.id, status: PRODUCING },
        data: { status: 'CLAIMED', claimedAt: new Date() },
      })
      if (guard.count !== 1) {
        const balances = await getSpBalances(tx, userId)
        return {
          ownedCeoId,
          cycleId: cycle.id.toString(),
          rewardSp: cycle.rewardSpSnap.toString(),
          alreadyCollected: true,
          balanceSp: (balances.earnedSp + balances.bonusSp).toString(),
          status: 'CLAIMED',
        }
      }

      const rewardSp = cycle.rewardSpSnap
      const balances = await creditSp(tx, {
        userId,
        bucket: 'EARNED',
        amountSp: rewardSp,
        sourceType: 'CYCLE_CLAIM',
        sourceId: cycle.id,
      })

      const owned = await tx.ownedCeo.findUniqueOrThrow({ where: { id: ownedCeoId } })
      const newLifetime = owned.lifetimeEarnedSp + rewardSp
      const exhausted = newLifetime >= cycle.lifetimeCapSnap
      await tx.ownedCeo.update({
        where: { id: ownedCeoId },
        data: {
          lifetimeEarnedSp: newLifetime,
          status: exhausted ? 'EXHAUSTED' : 'IDLE',
          archivedAt: exhausted ? new Date() : null,
        },
      })
      await recordTaskEvent(tx, userId, 'CYCLE_COLLECT')

      return {
        ownedCeoId,
        cycleId: cycle.id.toString(),
        rewardSp: rewardSp.toString(),
        alreadyCollected: false,
        balanceSp: (balances.earnedSp + balances.bonusSp).toString(),
        status: exhausted ? 'EXHAUSTED' : 'IDLE',
      }
    }, { maxWait: 15_000, timeout: 30_000 })
  } catch (error) {
    if (error instanceof ProductionError) throw error
    if (isUniqueViolation(error)) {
      const balances = await getSpBalances(prisma, userId)
      const cycle = await prisma.productionCycle.findFirst({
        where: { ownedCeoId, userId },
        orderBy: { id: 'desc' },
      })
      if (cycle && cycle.status === 'CLAIMED') {
        return {
          ownedCeoId,
          cycleId: cycle.id.toString(),
          rewardSp: cycle.rewardSpSnap.toString(),
          alreadyCollected: true,
          balanceSp: (balances.earnedSp + balances.bonusSp).toString(),
          status: 'CLAIMED',
        }
      }
    }
    throw error
  }
}

/** Upgrades a copy's equipment tier once (forward only) and charges the tier cost in SP (Bonus first). */
export async function upgradeEquipment(
  prisma: PrismaClient,
  userId: number,
  ownedCeoId: number,
  target: EquipmentTierName,
): Promise<{ equipment: string; earnedSp: string; bonusSp: string }> {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.ownedCeo.findFirst({ where: { id: ownedCeoId, userId } })
    if (!owned) throw new ProductionError('not_found')

    const from = owned.equipment as EquipmentTierName
    if (equipmentRank(target) <= equipmentRank(from)) {
      throw new ProductionError('invalid_equipment', 'equipment can only be upgraded forward')
    }
    const spec = EQUIPMENT[target]
    const progress = await tx.progressAccount.findUnique({ where: { userId } })
    if ((progress?.level ?? 1) < spec.requiredLevel) {
      throw new ProductionError('not_ready', `requires player level ${spec.requiredLevel}`)
    }

    const spent = await spendSp(tx, {
      userId,
      amountSp: BigInt(spec.costSp),
      sourceType: 'EQUIPMENT_PURCHASE',
      sourceId: BigInt(ownedCeoId),
      metadata: { target },
    })
    await tx.ownedCeo.update({ where: { id: ownedCeoId }, data: { equipment: target } })
    return { equipment: target, earnedSp: spent.earnedSp.toString(), bonusSp: spent.bonusSp.toString() }
  }, { maxWait: 15_000, timeout: 30_000 })
}

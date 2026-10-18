import type { Prisma, PrismaClient } from '@prisma/client'

export interface OwnedCeoView {
  id: number
  templateId: number
  templateSlug: string
  templateName: string
  rarity: string
  acquisitionType: string
  level: number
  status: string
  equipment: string
  cycleLimit: number | null
  completedRewardCycles: number
  baseSpPerCycle: number | null
  nominalSpPer24h: number | null
  lifetimeCapSp: string | null
  lifetimeEarnedSp: string
  archivedAt: string | null
  priceUsd: string
  cycleHours: number
  cycleEndsAt: string | null
  cycleRewardSp: string | null
  canStart: boolean
  canCollect: boolean
  acquiredAt: string
}

/** Read service for a user's owned CEO fleet. */
export async function listOwnedCeos(
  prisma: PrismaClient,
  userId: number,
): Promise<OwnedCeoView[]> {
  const rows = await prisma.ownedCeo.findMany({
    where: { userId },
    orderBy: { acquiredAt: 'asc' },
    select: {
      id: true,
      templateId: true,
      acquisitionType: true,
      level: true,
      status: true,
      equipment: true,
      cycleLimit: true,
      completedRewardCycles: true,
      lifetimeEarnedSp: true,
      archivedAt: true,
      acquiredAt: true,
      template: {
        select: {
          slug: true,
          name: true,
          rarity: true,
          baseSpPerCycle: true,
          nominalSpPer24h: true,
          lifetimeCapSp: true,
          priceUsd: true,
          cycleHours: true,
        },
      },
      cycles: {
        where: { status: 'PRODUCING' },
        orderBy: { id: 'desc' },
        take: 1,
        select: { endsAt: true, rewardSpSnap: true },
      },
    },
  })

  const now = Date.now()
  return rows.map((row) => {
    const open = row.cycles[0] ?? null
    const exhausted = row.archivedAt != null || row.status === 'EXHAUSTED'
    const producing = open != null && open.endsAt.getTime() > now
    const ready = open != null && open.endsAt.getTime() <= now
    return {
      id: row.id,
      templateId: row.templateId,
      templateSlug: row.template.slug,
      templateName: row.template.name,
      rarity: row.template.rarity,
      acquisitionType: row.acquisitionType,
      level: row.level,
      status: row.status,
      equipment: row.equipment,
      cycleLimit: row.cycleLimit,
      completedRewardCycles: row.completedRewardCycles,
      baseSpPerCycle: row.template.baseSpPerCycle,
      nominalSpPer24h: row.template.nominalSpPer24h,
      lifetimeCapSp: row.template.lifetimeCapSp?.toString() ?? null,
      lifetimeEarnedSp: row.lifetimeEarnedSp.toString(),
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
      priceUsd: row.template.priceUsd.toString(),
      cycleHours: row.template.cycleHours,
      cycleEndsAt: open ? open.endsAt.toISOString() : null,
      cycleRewardSp: open ? open.rewardSpSnap.toString() : null,
      canStart: !exhausted && !open,
      canCollect: ready,
      acquiredAt: row.acquiredAt.toISOString(),
    }
  })
}

/** Count of a user's copies of a template; used later to enforce maxOwned. */
export async function countOwnedByTemplate(
  prisma: PrismaClient,
  userId: number,
  templateId: number,
): Promise<number> {
  return prisma.ownedCeo.count({ where: { userId, templateId } })
}

/** Thrown when a user already holds the maximum allowed copies of a template. */
export class OwnershipLimitError extends Error {
  readonly templateId: number
  readonly maxOwned: number

  constructor(templateId: number, maxOwned: number) {
    super(`ownership limit reached for template ${templateId} (max ${maxOwned})`)
    this.name = 'OwnershipLimitError'
    this.templateId = templateId
    this.maxOwned = maxOwned
  }
}

type OwnedCeoCounter = Pick<Prisma.TransactionClient, 'ownedCeo'>

/**
 * Server-side capacity guard. Call inside the same transaction that creates the
 * OwnedCeo so the count and the insert cannot interleave with another writer.
 * The client-supplied state is never trusted; only the persisted count and the
 * template's own maxOwned are used.
 */
export async function assertOwnershipCapacity(
  tx: OwnedCeoCounter,
  userId: number,
  template: { id: number; maxOwned: number },
): Promise<void> {
  const owned = await tx.ownedCeo.count({ where: { userId, templateId: template.id } })
  if (owned >= template.maxOwned) {
    throw new OwnershipLimitError(template.id, template.maxOwned)
  }
}

import type { PrismaClient } from '@prisma/client'

export interface OwnedCeoView {
  id: number
  templateId: number
  templateSlug: string
  templateName: string
  rarity: string
  acquisitionType: string
  level: number
  status: string
  cycleLimit: number | null
  completedRewardCycles: number
  baseSpPerCycle: number | null
  energyCost: number
  cycleHours: number
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
      cycleLimit: true,
      completedRewardCycles: true,
      acquiredAt: true,
      template: {
        select: {
          slug: true,
          name: true,
          rarity: true,
          baseSpPerCycle: true,
          energyCost: true,
          cycleHours: true,
        },
      },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    templateId: row.templateId,
    templateSlug: row.template.slug,
    templateName: row.template.name,
    rarity: row.template.rarity,
    acquisitionType: row.acquisitionType,
    level: row.level,
    status: row.status,
    cycleLimit: row.cycleLimit,
    completedRewardCycles: row.completedRewardCycles,
    baseSpPerCycle: row.template.baseSpPerCycle,
    energyCost: row.template.energyCost,
    cycleHours: row.template.cycleHours,
    acquiredAt: row.acquiredAt.toISOString(),
  }))
}

/** Count of a user's copies of a template; used later to enforce maxOwned. */
export async function countOwnedByTemplate(
  prisma: PrismaClient,
  userId: number,
  templateId: number,
): Promise<number> {
  return prisma.ownedCeo.count({ where: { userId, templateId } })
}

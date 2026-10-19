import type { Prisma, PrismaClient } from '@prisma/client'
import {
  ALL_SITE_SETTING_KEYS,
  applySiteSettingsPatch,
  parseSiteSettings,
  serializeSiteSettings,
  type SiteSettings,
  type SiteSettingsPatch,
} from '../lib/siteSettings'

const CACHE_TTL_MS = 5_000
let cache: { at: number; value: SiteSettings } | null = null

async function readSettings(db: Pick<PrismaClient, 'appMeta'>): Promise<SiteSettings> {
  const rows = await db.appMeta.findMany({
    where: { key: { in: ALL_SITE_SETTING_KEYS } },
    select: { key: true, value: true },
  })
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value
  return parseSiteSettings(map)
}

/** Reads site settings (short-TTL cache) used by middleware and routes. */
export async function getSiteSettings(db: PrismaClient): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value
  const value = await readSettings(db)
  cache = { at: Date.now(), value }
  return value
}

export function invalidateSiteSettingsCache(): void {
  cache = null
}

/** Applies a validated settings patch and audits the change. Sensitive action. */
export async function updateSiteSettings(
  db: PrismaClient,
  actorId: number,
  patch: SiteSettingsPatch,
): Promise<SiteSettings> {
  const next = await db.$transaction(async (tx) => {
    const current = await readSettings(tx)
    const merged = applySiteSettingsPatch(current, patch)
    for (const { key, value } of serializeSiteSettings(merged)) {
      await tx.appMeta.upsert({ where: { key }, create: { key, value }, update: { value } })
    }
    await tx.adminAuditLog.create({
      data: {
        actorId,
        action: 'settings.update',
        targetType: 'SiteSettings',
        targetId: 'global',
        metadata: JSON.parse(JSON.stringify(patch)) as Prisma.InputJsonValue,
      },
    })
    return merged
  })
  invalidateSiteSettingsCache()
  return next
}

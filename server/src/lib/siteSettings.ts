export type AnnouncementLevel = 'info' | 'warning' | 'critical'

export interface AnnouncementSettings {
  enabled: boolean
  message: string
  level: AnnouncementLevel
}

export interface ReferralQualificationSettings {
  minLevel: number
  requireEmailVerification: boolean
  minCyclesCollected: number
}

export interface ReferralConfig {
  registrationBonusSp: number
  commissionBps: number
  /** Placeholder/unresolved: commission currency is not finalized (owner decision). */
  commissionCurrency: string
  qualification: ReferralQualificationSettings
}

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  registrationBonusSp: 10,
  commissionBps: 1000,
  commissionCurrency: 'BONUS_SP',
  qualification: { minLevel: 1, requireEmailVerification: false, minCyclesCollected: 0 },
}

export interface FeatureSettings {
  market: boolean
  collection: boolean
  tasks: boolean
  achievements: boolean
  leaderboard: boolean
  wallet: boolean
  specialTasks: boolean
}

export interface SiteSettings {
  registrationEnabled: boolean
  maintenance: { enabled: boolean; message: string }
  announcement: AnnouncementSettings
  features: FeatureSettings
  referral: ReferralConfig
}

export interface SiteSettingsPatch {
  registrationEnabled?: boolean
  maintenance?: Partial<{ enabled: boolean; message: string }>
  announcement?: Partial<AnnouncementSettings>
  features?: Partial<FeatureSettings>
  referral?: Partial<Omit<ReferralConfig, 'qualification'>> & {
    qualification?: Partial<ReferralQualificationSettings>
  }
}

export const SITE_SETTING_KEYS = {
  registrationEnabled: 'site.registrationEnabled',
  maintenance: 'site.maintenance',
  announcement: 'site.announcement',
  features: 'site.features',
  referral: 'site.referral',
} as const

export const ALL_SITE_SETTING_KEYS: string[] = Object.values(SITE_SETTING_KEYS)

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  registrationEnabled: true,
  maintenance: {
    enabled: false,
    message: 'TycoonX is undergoing scheduled maintenance. Please check back shortly.',
  },
  announcement: { enabled: false, message: '', level: 'info' },
  features: {
    market: true,
    collection: true,
    tasks: true,
    achievements: true,
    leaderboard: true,
    wallet: true,
    specialTasks: true,
  },
  referral: DEFAULT_REFERRAL_CONFIG,
}

const ANNOUNCEMENT_LEVELS: AnnouncementLevel[] = ['info', 'warning', 'critical']

function parseJson<T>(value: string | undefined): Partial<T> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as Partial<T>) : null
  } catch {
    return null
  }
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Merges stored overrides over the safe defaults; never throws on bad data. */
export function parseSiteSettings(entries: Record<string, string | undefined>): SiteSettings {
  const registrationRaw = entries[SITE_SETTING_KEYS.registrationEnabled]
  const maintenance = parseJson<SiteSettings['maintenance']>(entries[SITE_SETTING_KEYS.maintenance])
  const announcement = parseJson<AnnouncementSettings>(entries[SITE_SETTING_KEYS.announcement])
  const features = parseJson<FeatureSettings>(entries[SITE_SETTING_KEYS.features])
  const referral = parseJson<ReferralConfig>(entries[SITE_SETTING_KEYS.referral])

  const level = announcement?.level
  return {
    registrationEnabled: registrationRaw === undefined ? true : registrationRaw !== 'false',
    maintenance: {
      enabled: asBoolean(maintenance?.enabled, DEFAULT_SITE_SETTINGS.maintenance.enabled),
      message: asString(maintenance?.message, DEFAULT_SITE_SETTINGS.maintenance.message),
    },
    announcement: {
      enabled: asBoolean(announcement?.enabled, DEFAULT_SITE_SETTINGS.announcement.enabled),
      message: asString(announcement?.message, DEFAULT_SITE_SETTINGS.announcement.message),
      level: level && ANNOUNCEMENT_LEVELS.includes(level) ? level : DEFAULT_SITE_SETTINGS.announcement.level,
    },
    features: {
      market: asBoolean(features?.market, DEFAULT_SITE_SETTINGS.features.market),
      collection: asBoolean(features?.collection, DEFAULT_SITE_SETTINGS.features.collection),
      tasks: asBoolean(features?.tasks, DEFAULT_SITE_SETTINGS.features.tasks),
      achievements: asBoolean(features?.achievements, DEFAULT_SITE_SETTINGS.features.achievements),
      leaderboard: asBoolean(features?.leaderboard, DEFAULT_SITE_SETTINGS.features.leaderboard),
      wallet: asBoolean(features?.wallet, DEFAULT_SITE_SETTINGS.features.wallet),
      specialTasks: asBoolean(features?.specialTasks, DEFAULT_SITE_SETTINGS.features.specialTasks),
    },
    referral: {
      registrationBonusSp: asNumber(referral?.registrationBonusSp, DEFAULT_REFERRAL_CONFIG.registrationBonusSp),
      commissionBps: asNumber(referral?.commissionBps, DEFAULT_REFERRAL_CONFIG.commissionBps),
      commissionCurrency: asString(referral?.commissionCurrency, DEFAULT_REFERRAL_CONFIG.commissionCurrency),
      qualification: {
        minLevel: asNumber(referral?.qualification?.minLevel, DEFAULT_REFERRAL_CONFIG.qualification.minLevel),
        requireEmailVerification: asBoolean(
          referral?.qualification?.requireEmailVerification,
          DEFAULT_REFERRAL_CONFIG.qualification.requireEmailVerification,
        ),
        minCyclesCollected: asNumber(
          referral?.qualification?.minCyclesCollected,
          DEFAULT_REFERRAL_CONFIG.qualification.minCyclesCollected,
        ),
      },
    },
  }
}

/** Applies a validated patch on top of the current settings (shallow per section). */
export function applySiteSettingsPatch(current: SiteSettings, patch: SiteSettingsPatch): SiteSettings {
  return {
    registrationEnabled: patch.registrationEnabled ?? current.registrationEnabled,
    maintenance: { ...current.maintenance, ...(patch.maintenance ?? {}) },
    announcement: { ...current.announcement, ...(patch.announcement ?? {}) },
    features: { ...current.features, ...(patch.features ?? {}) },
    referral: {
      ...current.referral,
      ...(patch.referral ?? {}),
      qualification: {
        ...current.referral.qualification,
        ...(patch.referral?.qualification ?? {}),
      },
    },
  }
}

/** Serializes settings to the AppMeta key/value shape used for persistence. */
export function serializeSiteSettings(settings: SiteSettings): Array<{ key: string; value: string }> {
  return [
    { key: SITE_SETTING_KEYS.registrationEnabled, value: settings.registrationEnabled ? 'true' : 'false' },
    { key: SITE_SETTING_KEYS.maintenance, value: JSON.stringify(settings.maintenance) },
    { key: SITE_SETTING_KEYS.announcement, value: JSON.stringify(settings.announcement) },
    { key: SITE_SETTING_KEYS.features, value: JSON.stringify(settings.features) },
    { key: SITE_SETTING_KEYS.referral, value: JSON.stringify(settings.referral) },
  ]
}

/** Public-safe view (no internal/undocumented fields). */
export function toPublicSettings(settings: SiteSettings) {
  return {
    registrationEnabled: settings.registrationEnabled,
    maintenance: settings.maintenance,
    announcement: settings.announcement,
    features: settings.features,
  }
}

import { request } from './game'
import { useApi } from './useApi'

export interface FeatureSettings {
  market: boolean
  collection: boolean
  tasks: boolean
  achievements: boolean
  leaderboard: boolean
  wallet: boolean
  specialTasks: boolean
}

export interface AnnouncementSettings {
  enabled: boolean
  message: string
  level: 'info' | 'warning' | 'critical'
}

/** Server-authoritative runtime availability (booleans only; never secrets). */
export interface Capabilities {
  deposits: boolean
  payouts: boolean
  referralRewards: boolean
}

export interface PublicSiteSettings {
  registrationEnabled: boolean
  maintenance: { enabled: boolean; message: string }
  announcement: AnnouncementSettings
  features: FeatureSettings
  capabilities: Capabilities
}

/**
 * Honest three-state availability for a financial feature. `unknown` is used
 * only while the capability payload has not loaded (never as "enabled").
 */
export type Availability = 'available' | 'unavailable' | 'unknown'

export function availability(flag: boolean | undefined | null): Availability {
  if (flag === true) return 'available'
  if (flag === false) return 'unavailable'
  return 'unknown'
}

export const fetchPublicSettings = () => request<PublicSiteSettings>('/api/public/settings')

/** Shared public settings (announcement, feature visibility, capabilities). */
export const usePublicSettings = () => useApi(() => fetchPublicSettings(), [])

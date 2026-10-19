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

export interface PublicSiteSettings {
  registrationEnabled: boolean
  maintenance: { enabled: boolean; message: string }
  announcement: AnnouncementSettings
  features: FeatureSettings
}

export const fetchPublicSettings = () => request<PublicSiteSettings>('/api/public/settings')

/** Shared public settings (announcement, feature visibility, registration). */
export const usePublicSettings = () => useApi(() => fetchPublicSettings(), [])

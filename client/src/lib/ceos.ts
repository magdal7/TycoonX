import { apiUrl } from './api'

export interface Ceo {
  id: number
  name: string
  slug: string
  rarity: string
  priceUsd: number
  dailyRatePercent: number
  nominalSpPer24h: number | null
  lifetimeCapSp: number | null
  cycleHours: number
  energyCost: number
  imageUrl: string | null
  isActive: boolean
}

interface RawCeo {
  id: number
  name: string
  slug: string
  rarity: string
  priceUsd: string | number
  dailyRatePercent: string | number
  nominalSpPer24h: number | null
  lifetimeCapSp: string | number | null
  cycleHours: number
  energyCost: number
  imageUrl?: string | null
  isActive: boolean
}

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

export function dailyProjected(priceUsd: number, dailyRatePercent: number): number {
  return (priceUsd * dailyRatePercent) / 100
}

export interface PublicCeo {
  id: number
  name: string
  slug: string
  rarity: string
  priceUsd: number
  nominalSpPer24h: number | null
  lifetimeCapSp: number | null
  cycleHours: number
  imageUrl: string | null
  isForSale: boolean
}

/** Public, unauthenticated catalog preview (display fields only). */
export async function fetchPublicCeos(): Promise<PublicCeo[]> {
  const res = await fetch(apiUrl('/api/public/ceos'), { credentials: 'omit' })
  if (!res.ok) throw new Error(`Failed to load the catalog (status ${res.status}).`)
  const data = (await res.json()) as {
    ceos?: Array<{
      id: number
      name: string
      slug: string
      rarity: string
      priceUsd: string | number
      nominalSpPer24h: number | null
      lifetimeCapSp: string | number | null
      cycleHours: number
      imageUrl?: string | null
      isForSale: boolean
    }>
  }
  return (data.ceos ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    rarity: c.rarity,
    priceUsd: toNumber(c.priceUsd),
    nominalSpPer24h: c.nominalSpPer24h ?? null,
    lifetimeCapSp: c.lifetimeCapSp == null ? null : toNumber(c.lifetimeCapSp),
    cycleHours: c.cycleHours,
    imageUrl: c.imageUrl ?? null,
    isForSale: c.isForSale,
  }))
}

export async function fetchCeos(): Promise<Ceo[]> {
  const res = await fetch(apiUrl('/api/ceos?isActive=true'), { credentials: 'include' })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Please sign in to view the CEO market.')
    throw new Error(`Failed to load the CEO market (status ${res.status}).`)
  }
  const data = (await res.json()) as { ceos?: RawCeo[] }
  return (data.ceos ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    rarity: c.rarity,
    priceUsd: toNumber(c.priceUsd),
    dailyRatePercent: toNumber(c.dailyRatePercent),
    nominalSpPer24h: c.nominalSpPer24h ?? null,
    lifetimeCapSp: c.lifetimeCapSp === null || c.lifetimeCapSp === undefined ? null : toNumber(c.lifetimeCapSp),
    cycleHours: c.cycleHours,
    energyCost: c.energyCost,
    imageUrl: c.imageUrl ?? null,
    isActive: c.isActive,
  }))
}

interface RarityStyle {
  badge: string
  accent: string
  glow: string
}

export const RARITY_ORDER = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic']

export async function ensureOnboarding(): Promise<void> {
  await fetch(apiUrl('/api/game/onboarding'), { method: 'POST', credentials: 'include' })
}

const RARITY_STYLES: Record<string, RarityStyle> = {
  Common: {
    badge: 'border-gray-600/50 text-gray-300 bg-gray-700/30',
    accent: 'text-gray-300',
    glow: 'from-gray-500/10',
  },
  Rare: {
    badge: 'border-primary/40 text-primary bg-primary/10',
    accent: 'text-primary',
    glow: 'from-primary/15',
  },
  Epic: {
    badge: 'border-accent/40 text-accent bg-accent/10',
    accent: 'text-accent',
    glow: 'from-accent/15',
  },
  Legendary: {
    badge: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    accent: 'text-amber-400',
    glow: 'from-amber-500/15',
  },
  Mythic: {
    badge: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
    accent: 'text-rose-400',
    glow: 'from-rose-500/15',
  },
}

export function rarityStyle(rarity: string): RarityStyle {
  return RARITY_STYLES[rarity] ?? RARITY_STYLES.Common
}

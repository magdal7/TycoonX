/**
 * Canonical CEO portrait art.
 *
 * The eight owner-facing tiers map to optimized 512x768 JPEG portraits served
 * from `/assets/game/ceos`. Raw source art is archived (not served) under
 * `client/art-source/`. Unknown or as-yet-unmapped slugs intentionally resolve
 * to `undefined` so callers fall back to the hand-drawn SVG avatar.
 */
const BASE = '/assets/game/ceos'

const PORTRAIT_BY_SLUG: Record<string, string> = {
  'intern-ceo': 'intern',
  'junior-developer': 'junior-developer',
  'product-manager': 'product-manager',
  'marketing-director': 'marketing-director',
  'startup-founder': 'startup-founder',
  'ai-architect': 'ai-architect',
  'cloud-executive': 'cloud-executive',
  'tech-billionaire': 'tech-billionaire'
}

/** Marketing surfaces key some tiers by display name rather than slug. */
const PORTRAIT_BY_ALIAS: Record<string, string> = {
  intern: 'intern',
  'intern ceo': 'intern',
  'ceo 2': 'junior-developer',
  'ceo 3': 'product-manager',
  'ceo 4': 'marketing-director',
  'ceo 5': 'startup-founder',
  'ceo 6': 'ai-architect',
  'ceo 7': 'cloud-executive',
  'ceo 8': 'tech-billionaire'
}

/** Resolves a portrait URL for a catalog slug (or display-name alias). */
export function ceoPortraitUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined
  const normalized = key.trim().toLowerCase()
  const file = PORTRAIT_BY_SLUG[normalized] ?? PORTRAIT_BY_ALIAS[normalized]
  return file ? `${BASE}/${file}.jpg` : undefined
}

export function hasCeoPortrait(key: string | null | undefined): boolean {
  return ceoPortraitUrl(key) !== undefined
}

import data from './spriteManifest.json'

export type SpriteCategory = 'buildings' | 'terrain' | 'environment' | 'plots' | 'effects'
export type SpriteAnchor = 'bottom-center' | 'center'

export interface SpriteFootprint {
  w: number
  h: number
}

export interface SpriteVariant {
  id: string
  file: string
  width: number
  height: number
  footprint: SpriteFootprint
  level?: number
}

export interface SpriteEntry {
  id: string
  category: SpriteCategory
  file: string
  width: number
  height: number
  footprint: SpriteFootprint
  anchor: SpriteAnchor
  available: boolean
  variants?: SpriteVariant[]
}

export interface SpriteManifest {
  version: number
  grid: { tileW: number; tileH: number; scale: number }
  categories: SpriteCategory[]
  sprites: SpriteEntry[]
}

export const SPRITE_MANIFEST = data as unknown as SpriteManifest
export const SPRITES: SpriteEntry[] = SPRITE_MANIFEST.sprites
export const SPRITE_SCALE = SPRITE_MANIFEST.grid.scale

export function findSprite(id: string): SpriteEntry | undefined {
  return SPRITES.find((s) => s.id === id)
}

export function spriteSrc(category: SpriteCategory, file: string): string {
  return `/assets/game/${category}/${file}`
}

export function variantForLevel(entry: SpriteEntry, level: number): SpriteVariant | undefined {
  if (!entry.variants || entry.variants.length === 0) return undefined
  return entry.variants.find((v) => v.level === level) ?? entry.variants[0]
}

export function isRenderable(entry: SpriteEntry | undefined): entry is SpriteEntry {
  return !!entry && entry.available === true
}

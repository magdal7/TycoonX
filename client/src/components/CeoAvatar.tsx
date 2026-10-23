import type { ReactNode } from 'react'
import { rarityStyle } from '../lib/ceos'

const SKINS = ['#f1c9a5', '#e0ac82', '#c68642', '#8d5524', '#ffd9b3', '#a9744f']
const HAIR = ['#2b2b2b', '#5a3a22', '#0d1f1b', '#6b7280', '#3b2f2f', '#4b5563']
const SUITS = ['#0f2f27', '#12332b', '#0b2a33', '#1a2e2a', '#152b26']

export const RARITY_FRAME: Record<string, string> = {
  Common: 'border-line',
  Rare: 'border-primary/50',
  Epic: 'border-accent/55',
  Legendary: 'border-gold/60',
  Mythic: 'border-gold'
}

export const RARITY_GLOW: Record<string, string> = {
  Common: '',
  Rare: 'shadow-[0_0_22px_-10px_rgba(16,185,129,0.55)]',
  Epic: 'shadow-[0_0_24px_-8px_rgba(20,184,166,0.55)]',
  Legendary: 'shadow-[0_0_24px_-6px_rgba(212,175,101,0.60)]',
  Mythic: 'shadow-[0_0_30px_-6px_rgba(16,185,129,0.70)]'
}

function hashSlug(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

export function CeoAvatar({
  name,
  slug,
  rarity,
  size = 64,
  className = ''
}: {
  name: string
  slug: string
  rarity: string
  size?: number
  className?: string
}) {
  const style = rarityStyle(rarity)
  const h = hashSlug(slug || name)
  const skin = SKINS[h % SKINS.length]
  const hair = HAIR[(h >> 3) % HAIR.length]
  const suit = SUITS[(h >> 5) % SUITS.length]
  const frame = RARITY_FRAME[rarity] ?? RARITY_FRAME.Common

  let accessory: ReactNode = null
  if (rarity === 'Common') {
    accessory = (
      <g fill="none" stroke="currentColor" strokeWidth="2" className={style.accent} opacity="0.9">
        <rect x="44" y="52" width="13" height="10" rx="3" />
        <rect x="63" y="52" width="13" height="10" rx="3" />
        <path d="M57,57 L63,57" />
      </g>
    )
  } else if (rarity === 'Rare') {
    accessory = (
      <g className={style.accent}>
        <path d="M40,54 C40,30 80,30 80,54" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
        <rect x="35" y="52" width="8" height="14" rx="4" fill="currentColor" />
        <rect x="77" y="52" width="8" height="14" rx="4" fill="currentColor" />
      </g>
    )
  } else if (rarity === 'Epic') {
    accessory = (
      <rect x="40" y="49" width="40" height="14" rx="7" fill="currentColor" stroke="currentColor" strokeWidth="1.5" className={style.accent} opacity="0.4" />
    )
  } else if (rarity === 'Legendary' || rarity === 'Mythic') {
    accessory = (
      <g>
        <path d="M42,36 L48,26 L54,36 L60,24 L66,36 L72,26 L78,36 L76,44 L44,44 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
        {rarity === 'Mythic' && <ellipse cx="60" cy="18" rx="16" ry="4" fill="none" stroke="#f43f5e" strokeWidth="1.5" opacity="0.8" />}
      </g>
    )
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl border ${frame} bg-surface-2 ${className}`}
      style={{ width: size, height: size }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${style.glow} to-transparent`} />
      <svg viewBox="0 0 120 120" className="relative z-10 h-full w-full" role="img" aria-label={`${name} portrait`}>
        <ellipse cx="60" cy="58" rx="30" ry="30" fill="currentColor" className={style.accent} opacity="0.12" />
        <path d="M18,120 C18,92 42,84 60,84 C78,84 102,92 102,120 Z" fill={suit} />
        <path d="M60,84 L52,112 L68,112 Z" fill="#e5e7eb" opacity="0.85" />
        <path d="M60,86 L44,120 L58,120 Z" fill="currentColor" className={style.accent} opacity="0.45" />
        <path d="M60,86 L76,120 L62,120 Z" fill="currentColor" className={style.accent} opacity="0.45" />
        <rect x="52" y="72" width="16" height="16" rx="5" fill={skin} />
        <circle cx="38" cy="60" r="4.5" fill={skin} />
        <circle cx="82" cy="60" r="4.5" fill={skin} />
        <circle cx="60" cy="56" r="22" fill={skin} />
        <path d="M37,52 C37,30 83,30 83,52 C79,40 72,37 60,37 C48,37 41,40 37,52 Z" fill={hair} />
        <circle cx="51" cy="57" r="2.4" fill="#06201a" />
        <circle cx="69" cy="57" r="2.4" fill="#06201a" />
        <path d="M53,66 Q60,70 67,66" fill="none" stroke="#06201a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        {accessory}
      </svg>
    </div>
  )
}

import { useState, type ReactNode } from 'react'
import type { WorldState, Selected, BuildingDef, PlotDef, DecorDef } from '../engine/types'
import { toScreen, lerp, points, up, tilePoints, center, TILE_W, TILE_H, type Point, type Origin } from '../engine/iso'
import { FEATURE_FLAGS } from './featureFlags'
import { findSprite, isRenderable, spriteSrc, SPRITE_SCALE, variantForLevel } from './spriteManifest'

const ORIGIN: Origin = { x: 380, y: 168 }
const VIEW_BOX = '0 0 760 560'
const SPRITE_K = 1 / SPRITE_SCALE

const DECOR_SPRITE: Record<DecorDef['kind'], string> = {
  pine: 'env_tree_pine',
  round: 'env_tree_broad',
  bush: 'env_bush',
  lamp: 'env_lamp_modern',
  crate: 'env_crate'
}

function heightFor(b: BuildingDef): number {
  const base = b.type === 'hq' ? 98 : 50
  return base + (b.level - 1) * 9
}

function faceWindows(a: Point, b: Point, h: number, cols: number, rows: number): string[] {
  const out: string[] = []
  const pad = 0.1
  const usable = 1 - pad * 2
  const colW = usable / cols
  const winW = colW * 0.6
  const rowH = (h * 0.6) / rows
  const winH = rowH * 0.55
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u0 = pad + c * colW + (colW - winW) / 2
      const u1 = u0 + winW
      const p0 = lerp(a, b, u0)
      const p1 = lerp(a, b, u1)
      const base = h * 0.2 + r * (rowH + h * 0.06)
      out.push(
        points([
          { x: p0.x, y: p0.y - base },
          { x: p1.x, y: p1.y - base },
          { x: p1.x, y: p1.y - base - winH },
          { x: p0.x, y: p0.y - base - winH }
        ])
      )
    }
  }
  return out
}

function SpriteImage({
  href,
  x,
  y,
  width,
  height,
  fallback
}: {
  href: string
  x: number
  y: number
  width: number
  height: number
  fallback: ReactNode
}) {
  const [failed, setFailed] = useState(false)
  if (failed) return <>{fallback}</>
  return (
    <image
      href={href}
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMax meet"
      onError={() => setFailed(true)}
    />
  )
}

function IsoBuilding({
  b,
  selected,
  focused,
  onSelect,
  onFocus,
  onBlur
}: {
  b: BuildingDef
  selected: boolean
  focused: boolean
  onSelect: () => void
  onFocus: () => void
  onBlur: () => void
}) {
  const H = heightFor(b)
  const A = toScreen(b.gx, b.gy, ORIGIN)
  const B = toScreen(b.gx + b.footprint.w, b.gy, ORIGIN)
  const C = toScreen(b.gx + b.footprint.w, b.gy + b.footprint.h, ORIGIN)
  const D = toScreen(b.gx, b.gy + b.footprint.h, ORIGIN)
  const A2 = up(A, H)
  const B2 = up(B, H)
  const C2 = up(C, H)
  const D2 = up(D, H)
  const foot = points([A, B, C, D])
  const top = points([A2, B2, C2, D2])
  const front = points([D, C, C2, D2])
  const right = points([C, B, B2, C2])
  const ctr = center(A, B, C, D)
  const ctrTop = center(A2, B2, C2, D2)
  const inset = (p: Point): Point => ({
    x: p.x + (ctrTop.x - p.x) * 0.16,
    y: p.y + (ctrTop.y - p.y) * 0.16
  })
  const roof = points([inset(A2), inset(B2), inset(C2), inset(D2)])
  const cols = Math.max(2, b.footprint.w)
  const rows = H > 70 ? 3 : 2
  const frontWins = faceWindows(D, C, H, cols, rows)
  const rightWins = faceWindows(C, B, H, cols, rows)
  const ring = selected || focused
  const e0 = lerp(D, C, 0.36)
  const e1 = lerp(D, C, 0.64)
  const entrance = points([
    e0,
    e1,
    { x: e1.x, y: e1.y - H * 0.42 },
    { x: e0.x, y: e0.y - H * 0.42 }
  ])
  const antTop = { x: ctrTop.x, y: ctrTop.y - 30 }
  const shadowRx = (b.footprint.w + b.footprint.h) * TILE_W * 0.22
  const shadowRy = (b.footprint.w + b.footprint.h) * TILE_H * 0.24

  const entry = findSprite(`bld_${b.type}`)
  const variant = entry ? variantForLevel(entry, b.level) : undefined
  const fp = variant?.footprint ?? b.footprint
  const base = toScreen(b.gx + fp.w / 2, b.gy + fp.h / 2, ORIGIN)
  const imgW = variant ? variant.width * SPRITE_K : 0
  const imgH = variant ? variant.height * SPRITE_K : 0
  const useSprite = FEATURE_FLAGS.imageSprites && isRenderable(entry) && !!variant

  const vector = (
    <>
      <polygon
        points={front}
        fill={b.palette.left}
        stroke={ring ? b.accent : 'rgba(148,163,184,0.22)'}
        strokeWidth={ring ? 2 : 1}
      />
      <polygon
        points={right}
        fill={b.palette.right}
        stroke={ring ? b.accent : 'rgba(148,163,184,0.22)'}
        strokeWidth={ring ? 2 : 1}
      />
      {frontWins.map((p, i) => (
        <polygon key={`fw${i}`} points={p} fill="#a7f3d0" opacity="0.85" />
      ))}
      {rightWins.map((p, i) => (
        <polygon key={`rw${i}`} points={p} fill="#6ee7b7" opacity="0.55" />
      ))}
      <polygon points={entrance} fill="#06201a" opacity="0.92" />
      <polygon points={entrance} fill="none" stroke={b.palette.detail} strokeWidth="1.5" opacity="0.8" />
      <polygon points={top} fill={b.palette.top} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
      <polygon points={roof} fill={b.palette.detail} opacity="0.3" stroke={b.palette.top} strokeOpacity="0.5" strokeWidth="1" />
      <circle cx={ctrTop.x} cy={ctrTop.y} r="10" fill={b.palette.detail} opacity="0.35" />
      <circle cx={ctrTop.x} cy={ctrTop.y} r="4" fill="#d1fae5" opacity="0.9" />
      <line x1={ctrTop.x} y1={ctrTop.y} x2={antTop.x} y2={antTop.y} stroke={b.palette.top} strokeWidth="1.5" />
      <circle cx={antTop.x} cy={antTop.y} r="4" fill={b.accent} className="motion-safe:animate-pulse" />
    </>
  )

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${b.name}, level ${b.level} preview`}
      aria-pressed={selected}
      className="cursor-pointer outline-none"
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <ellipse cx={ctr.x} cy={ctr.y + 6} rx={shadowRx} ry={shadowRy} fill="#04060d" opacity="0.5" />
      {ring && (
        <>
          <polygon points={foot} fill={b.accent} opacity="0.12" />
          <polygon
            points={foot}
            fill="none"
            stroke={b.accent}
            strokeWidth={2}
            strokeDasharray={focused && !selected ? '7 5' : undefined}
            opacity="0.9"
          />
        </>
      )}
      {b.status === 'upgrading' && (
        <g className="motion-safe:animate-pulse">
          <polygon points={top} fill="none" stroke="#D4AF65" strokeWidth="2" strokeDasharray="5 4" opacity="0.9" />
          <circle cx={antTop.x} cy={antTop.y - 12} r="4" fill="#D4AF65" />
        </g>
      )}
      {Array.from({ length: b.maxLevel }, (_, i) => {
        const x = ctr.x + (i - (b.maxLevel - 1) / 2) * 8
        return (
          <circle
            key={`pip${i}`}
            cx={x}
            cy={D.y + 12}
            r="3"
            fill={i < b.level ? b.accent : 'rgba(148,163,184,0.28)'}
            stroke="#06201a"
            strokeWidth="1"
          />
        )
      })}
      {useSprite && variant ? (
        <SpriteImage
          href={spriteSrc('buildings', variant.file)}
          x={base.x - imgW / 2}
          y={base.y - imgH}
          width={imgW}
          height={imgH}
          fallback={vector}
        />
      ) : (
        vector
      )}
    </g>
  )
}

function IsoPlot({
  plot,
  selected,
  focused,
  onSelect,
  onFocus,
  onBlur
}: {
  plot: PlotDef
  selected: boolean
  focused: boolean
  onSelect: () => void
  onFocus: () => void
  onBlur: () => void
}) {
  const A = toScreen(plot.gx, plot.gy, ORIGIN)
  const B = toScreen(plot.gx + plot.footprint.w, plot.gy, ORIGIN)
  const C = toScreen(plot.gx + plot.footprint.w, plot.gy + plot.footprint.h, ORIGIN)
  const D = toScreen(plot.gx, plot.gy + plot.footprint.h, ORIGIN)
  const ctr = center(A, B, C, D)
  const locked = plot.status === 'locked'
  const color = locked ? '#E0A93B' : '#10B981'
  const ring = selected || focused
  const diamondPts = points([A, B, C, D])

  const entry = findSprite(locked ? 'plot_locked_overgrown' : 'plot_available_pad')
  const imgW = entry ? entry.width * SPRITE_K : 0
  const imgH = entry ? entry.height * SPRITE_K : 0
  const useSprite = FEATURE_FLAGS.imageSprites && isRenderable(entry)

  const vector = (
    <>
      <polygon points={diamondPts} fill={color} opacity={locked ? 0.05 : 0.08} />
      <polygon
        points={diamondPts}
        fill="none"
        stroke={color}
        strokeWidth={ring ? 2 : 1.5}
        strokeDasharray="6 5"
        opacity={locked ? 0.5 : 0.9}
      />
      {locked ? (
        <>
          <rect x={ctr.x - 5} y={ctr.y - 4} width="10" height="8" rx="1.5" fill="#E0A93B" opacity="0.85" />
          <path d={`M${ctr.x - 3},${ctr.y - 4} a3,3 0 0 1 6,0`} fill="none" stroke="#E0A93B" strokeWidth="1.5" opacity="0.85" />
        </>
      ) : (
        <>
          <line x1={ctr.x - 9} y1={ctr.y} x2={ctr.x + 9} y2={ctr.y} stroke={color} strokeWidth="2" />
          <line x1={ctr.x} y1={ctr.y - 9} x2={ctr.x} y2={ctr.y + 9} stroke={color} strokeWidth="2" />
        </>
      )}
      <text x={ctr.x} y={ctr.y + 24} textAnchor="middle" fontSize="9" fill={locked ? '#A7B9B0' : '#a7f3d0'} className="select-none">
        {locked ? 'Locked' : 'Available'}
      </text>
    </>
  )

  const body = useSprite && entry ? (
    <SpriteImage
      href={spriteSrc('plots', entry.file)}
      x={ctr.x - imgW / 2}
      y={ctr.y - imgH / 2}
      width={imgW}
      height={imgH}
      fallback={vector}
    />
  ) : (
    vector
  )

  if (locked) {
    return (
      <g aria-label={`${plot.name}, locked`} aria-disabled="true" style={{ cursor: 'default' }}>
        {body}
      </g>
    )
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${plot.name}, available plot preview`}
      aria-pressed={selected}
      className="cursor-pointer outline-none"
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {body}
    </g>
  )
}

function IsoDecor({ d }: { d: DecorDef }) {
  const c = toScreen(d.gx + 0.5, d.gy + 0.5, ORIGIN)
  const shadow = <ellipse cx={c.x} cy={c.y} rx="12" ry="6" fill="#04060d" opacity="0.4" />

  const vector: ReactNode =
    d.kind === 'lamp' ? (
      <>
        <rect x={c.x - 1.5} y={c.y - 26} width="3" height="26" fill="#1f3d35" />
        <circle cx={c.x} cy={c.y - 28} r="5" fill="#E0A93B" opacity="0.85" />
        <circle cx={c.x} cy={c.y - 28} r="9" fill="#E0A93B" opacity="0.18" className="motion-safe:animate-pulse" />
      </>
    ) : d.kind === 'bush' ? (
      <>
        <circle cx={c.x} cy={c.y - 6} r="8" fill="#16A879" />
        <circle cx={c.x + 6} cy={c.y - 3} r="6" fill="#0f6b4e" />
      </>
    ) : d.kind === 'crate' ? (
      <>
        <polygon points={points([{ x: c.x, y: c.y - 14 }, { x: c.x + 12, y: c.y - 8 }, { x: c.x, y: c.y - 2 }, { x: c.x - 12, y: c.y - 8 }])} fill="#8a5a2b" />
        <polygon points={points([{ x: c.x - 12, y: c.y - 8 }, { x: c.x, y: c.y - 2 }, { x: c.x, y: c.y + 8 }, { x: c.x - 12, y: c.y + 2 }])} fill="#6b4520" />
        <polygon points={points([{ x: c.x + 12, y: c.y - 8 }, { x: c.x, y: c.y - 2 }, { x: c.x, y: c.y + 8 }, { x: c.x + 12, y: c.y + 2 }])} fill="#7a4f26" />
      </>
    ) : d.kind === 'round' ? (
      <>
        <rect x={c.x - 2} y={c.y - 10} width="4" height="10" fill="#5a3a22" />
        <circle cx={c.x} cy={c.y - 16} r="10" fill="#15803d" />
        <circle cx={c.x - 3} cy={c.y - 19} r="4" fill="#22c55e" opacity="0.7" />
      </>
    ) : (
      <>
        <rect x={c.x - 2} y={c.y - 8} width="4" height="8" fill="#5a3a22" />
        <polygon points={points([{ x: c.x, y: c.y - 34 }, { x: c.x + 11, y: c.y - 14 }, { x: c.x - 11, y: c.y - 14 }])} fill="#15803d" />
        <polygon points={points([{ x: c.x, y: c.y - 26 }, { x: c.x + 9, y: c.y - 10 }, { x: c.x - 9, y: c.y - 10 }])} fill="#166534" />
        <polygon points={points([{ x: c.x, y: c.y - 18 }, { x: c.x + 7, y: c.y - 6 }, { x: c.x - 7, y: c.y - 6 }])} fill="#14532d" />
      </>
    )

  const entry = findSprite(DECOR_SPRITE[d.kind])
  const imgW = entry ? entry.width * SPRITE_K : 0
  const imgH = entry ? entry.height * SPRITE_K : 0
  const useSprite = FEATURE_FLAGS.imageSprites && isRenderable(entry)

  return (
    <g>
      {shadow}
      {useSprite && entry ? (
        <SpriteImage
          href={spriteSrc('environment', entry.file)}
          x={c.x - imgW / 2}
          y={c.y - imgH}
          width={imgW}
          height={imgH}
          fallback={vector}
        />
      ) : (
        vector
      )}
    </g>
  )
}

export default function GameCanvas({
  world,
  selected,
  onSelect
}: {
  world: WorldState
  selected: Selected
  onSelect: (next: Selected) => void
}) {
  const [focused, setFocused] = useState<string | null>(null)

  const tiles: ReactNode[] = []
  for (let gy = 0; gy < world.size; gy++) {
    for (let gx = 0; gx < world.size; gx++) {
      const c = toScreen(gx + 0.5, gy + 0.5, ORIGIN)
      const dark = (gx + gy) % 2 === 0
      tiles.push(
        <polygon
          key={`t${gx}-${gy}`}
          points={tilePoints(c)}
          fill={dark ? '#0b1f1b' : '#091916'}
          stroke="#1f3d35"
          strokeWidth="1"
        />
      )
    }
  }

  const items: { depth: number; node: ReactNode }[] = []

  world.plots.forEach((p) => {
    items.push({
      depth: p.gx + p.gy + (p.footprint.w + p.footprint.h) * 0.001,
      node: (
        <IsoPlot
          key={p.id}
          plot={p}
          selected={selected?.kind === 'plot' && selected.id === p.id}
          focused={focused === p.id}
          onSelect={() => onSelect({ kind: 'plot', id: p.id })}
          onFocus={() => setFocused(p.id)}
          onBlur={() => setFocused((f) => (f === p.id ? null : f))}
        />
      )
    })
  })

  world.decor.forEach((d) => {
    items.push({ depth: d.gx + d.gy + 0.002, node: <IsoDecor key={d.id} d={d} /> })
  })

  world.buildings.forEach((b) => {
    items.push({
      depth: b.gx + b.gy + (b.footprint.w + b.footprint.h) * 0.001,
      node: (
        <IsoBuilding
          key={b.id}
          b={b}
          selected={selected?.kind === 'building' && selected.id === b.id}
          focused={focused === b.id}
          onSelect={() => onSelect({ kind: 'building', id: b.id })}
          onFocus={() => setFocused(b.id)}
          onBlur={() => setFocused((f) => (f === b.id ? null : f))}
        />
      )
    })
  })

  items.sort((a, b) => a.depth - b.depth)

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-[#0a201b] to-bg">
      <svg
        viewBox={VIEW_BOX}
        className="h-auto w-full"
        role="group"
        aria-label="Isometric technology campus (preview)"
        onClick={() => onSelect(null)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onSelect(null)
        }}
      >
        <defs>
          <radialGradient id="groundGlow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </radialGradient>
        </defs>
        {tiles}
        {world.paths.map((p) => {
          const c = toScreen(p.gx + 0.5, p.gy + 0.5, ORIGIN)
          return <polygon key={`path${p.gx}-${p.gy}`} points={tilePoints(c)} fill="#14332b" stroke="#245043" strokeWidth="1" />
        })}
        <ellipse cx="380" cy="232" rx="300" ry="150" fill="url(#groundGlow)" />
        {items.map((it) => it.node)}
      </svg>
      <div className="flex flex-wrap items-center gap-3 px-3 pb-3 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#10B981]" /> HQ</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#16A879]" /> Data</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#14B8A6]" /> Labs</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#D4AF65]" /> Tower</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#E0A93B]" /> Locked plot</span>
        <span className="ml-auto">PREVIEW — tap a building to inspect. No purchases or production logic.</span>
      </div>
    </div>
  )
}

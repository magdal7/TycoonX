import React from 'react'

type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'gold'

const TONE_BAR: Record<Tone, string> = {
  primary: 'from-primary to-accent',
  accent: 'from-accent to-primary',
  success: 'from-success to-emerald-400',
  warning: 'from-warning to-amber-400',
  gold: 'from-gold to-amber-400'
}

export function Progress({
  value,
  max = 100,
  tone = 'primary',
  className = '',
  label
}: {
  value: number
  max?: number
  tone?: Tone
  className?: string
  label?: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className={className}>
      {label && <div className="mb-1 flex items-center justify-between text-[11px] text-muted"><span>{label}</span><span>{Math.round(pct)}%</span></div>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full bg-gradient-to-r ${TONE_BAR[tone]} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  Icon,
  tone = 'text-ink'
}: {
  label: string
  value: React.ReactNode
  hint?: string
  Icon?: React.ComponentType<{ className?: string }>
  tone?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/70 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold ${tone}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted">{hint}</div>}
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  right
}: {
  eyebrow?: string
  title: string
  description?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        {eyebrow && <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</div>}
        <h1 className="mt-0.5 text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {right}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className = ''
}: {
  tabs: { id: T; label: string; badge?: React.ReactNode }[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div className={`no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2/70 p-1 ${className}`} role="tablist">
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              active ? 'bg-primary text-white shadow-glow' : 'text-muted hover:bg-white/5 hover:text-white'
            }`}
          >
            {t.label}
            {t.badge}
          </button>
        )
      })}
    </div>
  )
}

export function EmptyState({
  Icon,
  title,
  description,
  action
}: {
  Icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface-2/40 px-6 py-12 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-muted" />}
      <p className="text-sm font-semibold text-white">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface/60 p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="mt-4 h-2 w-full" />
      <Skeleton className="mt-3 h-9 w-full" />
    </div>
  )
}

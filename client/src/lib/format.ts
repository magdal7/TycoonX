/**
 * Locale-aware formatting helpers.
 *
 * The i18n provider calls `setFormatLocale(locale)` whenever the language
 * changes, so every existing `formatNumber` call becomes locale-aware without
 * touching call sites. Values are never mutated — only their presentation.
 */
let currentLocale = 'en'

export function setFormatLocale(locale: string): void {
  currentLocale = locale || 'en'
}

export function getFormatLocale(): string {
  return currentLocale
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  try {
    return new Intl.NumberFormat(currentLocale).format(Math.round(value))
  } catch {
    return Math.round(value).toLocaleString('en-US')
  }
}

export function formatSp(value: number): string {
  return `${formatNumber(value)} SP`
}

export function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

export function compact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`
  return formatNumber(value)
}

export function percent(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

/** Locale-aware date (no time). */
export function formatDate(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(currentLocale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
  } catch {
    return date.toLocaleDateString()
  }
}

/** Locale-aware date + time. */
export function formatDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(currentLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch {
    return date.toLocaleString()
  }
}

export function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ready'
  const totalMinutes = Math.floor(diff / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

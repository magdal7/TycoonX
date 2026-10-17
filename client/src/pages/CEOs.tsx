import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Clock,
  Zap,
  TrendingUp,
  Inbox,
  Loader2,
  Sparkles,
  Users,
  Lock,
  X
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { dailyProjected, fetchCeos, rarityStyle, RARITY_ORDER, type Ceo } from '../lib/ceos'

type SortKey = 'featured' | 'price-asc' | 'price-desc'

const SKINS = ['#f1c9a5', '#e0ac82', '#c68642', '#8d5524', '#ffd9b3', '#a9744f']
const HAIR = ['#2b2b2b', '#5a3a22', '#111827', '#6b7280', '#3b2f2f', '#4b5563']
const SUITS = ['#1f2a44', '#22304f', '#2a2440', '#203a3a', '#2b2b3a']

const RARITY_FRAME: Record<string, string> = {
  Common: 'border-gray-700/60',
  Rare: 'border-primary/40',
  Epic: 'border-accent/50',
  Legendary: 'border-amber-500/50',
  Mythic: 'border-rose-500/50'
}

const RARITY_GLOW: Record<string, string> = {
  Common: '',
  Rare: 'shadow-[0_0_22px_-10px_rgba(52,120,255,0.55)]',
  Epic: 'shadow-[0_0_24px_-8px_rgba(139,92,246,0.55)]',
  Legendary: 'shadow-[0_0_24px_-6px_rgba(245,158,11,0.55)]',
  Mythic: 'shadow-[0_0_28px_-6px_rgba(244,63,94,0.6)]'
}

function hashSlug(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

function CeoAvatar({ ceo }: { ceo: Ceo }) {
  const style = rarityStyle(ceo.rarity)
  const h = hashSlug(ceo.slug || String(ceo.id))
  const skin = SKINS[h % SKINS.length]
  const hair = HAIR[(h >> 3) % HAIR.length]
  const suit = SUITS[(h >> 5) % SUITS.length]
  const frame = RARITY_FRAME[ceo.rarity] ?? 'border-gray-700/60'

  let accessory: React.ReactNode = null
  if (ceo.rarity === 'Common') {
    accessory = (
      <g fill="none" stroke="currentColor" strokeWidth="2" className={style.accent} opacity="0.9">
        <rect x="44" y="52" width="13" height="10" rx="3" />
        <rect x="63" y="52" width="13" height="10" rx="3" />
        <path d="M57,57 L63,57" />
      </g>
    )
  } else if (ceo.rarity === 'Rare') {
    accessory = (
      <g className={style.accent}>
        <path d="M40,54 C40,30 80,30 80,54" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
        <rect x="35" y="52" width="8" height="14" rx="4" fill="currentColor" />
        <rect x="77" y="52" width="8" height="14" rx="4" fill="currentColor" />
      </g>
    )
  } else if (ceo.rarity === 'Epic') {
    accessory = (
      <rect
        x="40"
        y="49"
        width="40"
        height="14"
        rx="7"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        className={style.accent}
        opacity="0.4"
      />
    )
  } else if (ceo.rarity === 'Legendary' || ceo.rarity === 'Mythic') {
    accessory = (
      <g>
        <path d="M42,36 L48,26 L54,36 L60,24 L66,36 L72,26 L78,36 L76,44 L44,44 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
        {ceo.rarity === 'Mythic' && (
          <ellipse cx="60" cy="18" rx="16" ry="4" fill="none" stroke="#f43f5e" strokeWidth="1.5" opacity="0.8" />
        )}
      </g>
    )
  }

  return (
    <div className={`relative h-16 w-16 shrink-0 rounded-xl border ${frame} bg-gray-900/50 overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${style.glow} to-transparent`} />
      <svg viewBox="0 0 120 120" className="relative z-10 h-full w-full" role="img" aria-label={`${ceo.name} portrait`}>
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
        <circle cx="51" cy="57" r="2.4" fill="#0b1020" />
        <circle cx="69" cy="57" r="2.4" fill="#0b1020" />
        <path d="M53,66 Q60,70 67,66" fill="none" stroke="#0b1020" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        {accessory}
      </svg>
    </div>
  )
}

function Stat({
  Icon,
  label,
  value,
  accent
}: {
  Icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-2 text-center">
      <Icon className="h-3.5 w-3.5 mx-auto text-gray-500" />
      <div className={`mt-0.5 text-xs font-bold ${accent ?? 'text-white'}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  )
}

function CeoCard({ ceo }: { ceo: Ceo }) {
  const style = rarityStyle(ceo.rarity)
  const frame = RARITY_FRAME[ceo.rarity] ?? 'border-gray-700/60'
  const glow = RARITY_GLOW[ceo.rarity] ?? ''

  return (
    <Card hover padding="none" className={`relative overflow-hidden border ${frame} ${glow} flex flex-col`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${style.glow} to-transparent`} />
      <div className="relative z-10 p-4 flex flex-col flex-1">
        <div className="flex items-start gap-3 mb-3">
          <CeoAvatar ceo={ceo} />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-white leading-tight truncate">{ceo.name}</h3>
            <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}>
              {ceo.rarity}
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[10px] text-gray-500">Market price</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">{formatUsd(ceo.priceUsd)}</span>
              <span className="text-xs text-gray-500">USD</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500">Projected / day</p>
            <div className="text-sm font-bold text-success">
              {formatUsd(dailyProjected(ceo.priceUsd, ceo.dailyRatePercent))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat Icon={TrendingUp} label="Rate" value={`${ceo.dailyRatePercent}%`} accent={style.accent} />
          <Stat Icon={Clock} label="Cycle" value={`${ceo.cycleHours}h`} />
          <Stat Icon={Zap} label="Energy" value={String(ceo.energyCost)} />
        </div>

        <p className="text-[10px] text-gray-500 mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-success shrink-0" /> Simulation only — non-withdrawable
        </p>

        <Button variant="outline" size="sm" disabled aria-disabled="true" className="mt-auto w-full">
          <Lock className="h-3.5 w-3.5 mr-2" /> Buy — Coming Soon
        </Button>
      </div>
    </Card>
  )
}

export default function CEOs() {
  const [ceos, setCeos] = useState<Ceo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('All')
  const [sort, setSort] = useState<SortKey>('featured')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetchCeos()
      .then((data) => {
        if (active) setCeos(data)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load the CEO market.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const rarities = useMemo(() => {
    const present = Array.from(new Set(ceos.map((c) => c.rarity)))
    const known = RARITY_ORDER.filter((r) => present.includes(r))
    const unknown = present.filter((r) => !RARITY_ORDER.includes(r))
    return ['All', ...known, ...unknown]
  }, [ceos])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = ceos
      .filter((c) => rarity === 'All' || c.rarity === rarity)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
    if (sort === 'price-asc') list.sort((a, b) => a.priceUsd - b.priceUsd)
    else if (sort === 'price-desc') list.sort((a, b) => b.priceUsd - a.priceUsd)
    return list
  }, [ceos, rarity, search, sort])

  const prices = ceos.map((c) => c.priceUsd)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const rarityCount = new Set(ceos.map((c) => c.rarity)).size
  const filtersActive = search.trim() !== '' || rarity !== 'All' || sort !== 'featured'

  function clearFilters() {
    setSearch('')
    setRarity('All')
    setSort('featured')
  }

  const showSummary = !loading && !error && ceos.length > 0

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary font-semibold">
              <Sparkles className="h-3 w-3" /> Marketplace
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">CEO Market</h1>
            <p className="text-sm text-gray-400">Recruit elite executives to power your tech empire.</p>
          </div>
          <Badge variant="demo">SIMULATION DATA</Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <Users className="h-3.5 w-3.5" /> Market
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800/60 bg-gray-900/30 px-3 py-1.5 text-xs font-medium text-gray-500 cursor-not-allowed"
            aria-disabled="true"
            title="Ownership is not implemented yet"
          >
            <Lock className="h-3.5 w-3.5" /> My CEOs <Badge variant="warning">Soon</Badge>
          </span>
        </div>
      </header>

      <Card padding="sm" className="border border-success/30 bg-success/5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-success mt-0.5 shrink-0" />
          <p className="text-xs text-success/90">
            All figures are simulations. Purchases are not enabled, and nothing here is real,
            withdrawable, or convertible to currency.
          </p>
        </div>
      </Card>

      {showSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Card padding="sm" className="border border-gray-800/60">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Executives</p>
            <p className="text-lg font-bold text-white">{ceos.length}</p>
          </Card>
          <Card padding="sm" className="border border-gray-800/60">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Rarities</p>
            <p className="text-lg font-bold text-accent">{rarityCount}</p>
          </Card>
          <Card padding="sm" className="border border-gray-800/60 col-span-2 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Price range</p>
            <p className="text-lg font-bold text-white">
              {formatUsd(minPrice)}–{formatUsd(maxPrice)}
            </p>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search executives..."
              aria-label="Search CEOs"
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
              aria-label="Filter by rarity"
              className="flex-1 sm:flex-none bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-primary outline-none"
            >
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {r === 'All' ? 'All rarities' : r}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort by price"
              className="flex-1 sm:flex-none bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-primary outline-none"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {!loading && !error && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing {visible.length} of {ceos.length} executives
            </span>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} padding="none" className="border border-gray-800/60 animate-pulse">
              <div className="p-4">
                <div className="flex gap-3 mb-4">
                  <div className="h-16 w-16 rounded-xl bg-gray-800/60" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 bg-gray-800/60 rounded" />
                    <div className="h-3 w-1/3 bg-gray-800/50 rounded" />
                  </div>
                </div>
                <div className="h-6 w-1/3 bg-gray-800/60 rounded mb-4" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-12 bg-gray-800/40 rounded" />
                  <div className="h-12 bg-gray-800/40 rounded" />
                  <div className="h-12 bg-gray-800/40 rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border border-red-500/30 bg-red-900/10 text-center py-10">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-300 mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="border border-gray-800/60 text-center py-10">
          <Inbox className="h-8 w-8 text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-300 mb-1">
            {ceos.length === 0 ? 'No CEOs available yet.' : 'No CEOs match your filters.'}
          </p>
          <p className="text-xs text-gray-500">
            {ceos.length === 0 ? 'Check back soon.' : 'Try a different search, rarity, or sort.'}
          </p>
          {ceos.length > 0 && filtersActive && (
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((ceo) => (
            <CeoCard key={ceo.id} ceo={ceo} />
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading CEO market...
        </div>
      )}
    </div>
  )
}

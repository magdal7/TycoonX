import { useMemo, useState } from 'react'
import { Search, RefreshCw, AlertCircle, ShieldCheck, Clock, TrendingUp, Inbox, ShoppingCart, Sparkles, X } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { SectionHeading, EmptyState, CardSkeleton } from '../components/ui/kit'
import { CeoAvatar, RARITY_FRAME, RARITY_GLOW, ceoRole } from '../components/CeoAvatar'
import { rarityStyle, RARITY_ORDER, type Ceo } from '../lib/ceos'
import { useApi } from '../lib/useApi'
import { fetchCeos } from '../lib/ceos'
import { createPurchase } from '../lib/game'
import { notifyResourcesChanged } from '../lib/resources'
import { formatNumber, formatUsd } from '../lib/format'

type SortKey = 'featured' | 'price-asc' | 'price-desc'

function MarketCard({ ceo }: { ceo: Ceo }) {
  const style = rarityStyle(ceo.rarity)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function buy() {
    setBusy(true)
    setNotice('')
    try {
      await createPurchase(ceo.id, `${ceo.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      notifyResourcesChanged()
      setNotice('Purchased — the CEO was added to your collection.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Purchase failed'
      setNotice(
        msg === 'insufficient_sp'
          ? 'Not enough SP. Deposit USDT or earn SP first.'
          : msg === 'ownership_limit'
            ? 'You already own the maximum copies of this CEO.'
            : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card padding="none" hover className={`relative flex flex-col overflow-hidden border ${RARITY_FRAME[ceo.rarity] ?? 'border-line'} ${RARITY_GLOW[ceo.rarity] ?? ''}`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${style.glow} to-transparent`} />
      <div className="relative z-10 flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-start gap-3">
          <CeoAvatar name={ceo.name} slug={ceo.slug} rarity={ceo.rarity} size={60} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold leading-tight text-white">{ceo.name}</h3>
            <p className="text-[11px] text-muted">{ceoRole(ceo.rarity)}</p>
            <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>{ceo.rarity}</span>
          </div>
        </div>

        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] text-muted">Price</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">{ceo.priceUsd === 0 ? 'Free' : formatUsd(ceo.priceUsd)}</span>
              {ceo.priceUsd > 0 && <span className="text-xs text-muted">USDT</span>}
            </div>
            {ceo.priceUsd > 0 && (
              <p className="mt-0.5 text-[10px] text-accent">≈ {formatNumber(Math.round(ceo.priceUsd * 1000))} SP</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted">Lifetime cap</p>
            <div className="text-sm font-bold text-gold">{ceo.lifetimeCapSp != null ? `${formatNumber(ceo.lifetimeCapSp)} SP` : '—'}</div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line bg-surface-2/60 p-2 text-center">
            <TrendingUp className="mx-auto h-3.5 w-3.5 text-muted" />
            <div className="mt-0.5 text-xs font-bold text-white">{ceo.nominalSpPer24h != null ? `${formatNumber(ceo.nominalSpPer24h)}` : '—'}</div>
            <div className="text-[9px] uppercase tracking-wide text-muted">SP / 24h</div>
          </div>
          <div className="rounded-lg border border-line bg-surface-2/60 p-2 text-center">
            <Clock className="mx-auto h-3.5 w-3.5 text-muted" />
            <div className="mt-0.5 text-xs font-bold text-white">{ceo.cycleHours}h</div>
            <div className="text-[9px] uppercase tracking-wide text-muted">Base cycle</div>
          </div>
        </div>

        <p className="mb-3 flex items-center gap-1.5 text-[10px] text-muted">
          <ShieldCheck className="h-3 w-3 shrink-0 text-success" /> Finite lifetime cap per copy · not an investment
        </p>

        {notice && <p className="mb-2 text-[10px] text-amber-300">{notice}</p>}
        <Button variant="primary" size="sm" className="mt-auto w-full" isLoading={busy} disabled={ceo.priceUsd <= 0} onClick={buy}>
          <ShoppingCart className="h-3.5 w-3.5 mr-2" /> {ceo.priceUsd <= 0 ? 'Included free' : 'Buy with SP'}
        </Button>
      </div>
    </Card>
  )
}

export default function Market() {
  const { data, loading, error, reload } = useApi(() => fetchCeos(), [])
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('All')
  const [sort, setSort] = useState<SortKey>('featured')

  const ceos = data ?? []
  const rarities = useMemo(() => {
    const present = Array.from(new Set(ceos.map((c) => c.rarity)))
    return ['All', ...RARITY_ORDER.filter((r) => present.includes(r)), ...present.filter((r) => !RARITY_ORDER.includes(r))]
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

  const filtersActive = search.trim() !== '' || rarity !== 'All' || sort !== 'featured'

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Marketplace"
        title="CEO Market"
        description="Recruit executives with defined production mechanics and finite lifetime caps."
        right={<Badge variant="default">SP MARKET</Badge>}
      />

      <Card padding="sm" className="border border-success/25 bg-success/5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <p className="text-xs text-success/90">
            Buy CEOs with SP (Bonus SP first, then Earned SP) at 1 USDT = 1,000 SP. Deposits credit Bonus SP;
            only Earned SP is potentially withdrawable, and payouts require admin approval.
          </p>
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search executives..."
            aria-label="Search CEOs"
            className="w-full rounded-xl border border-line bg-surface-2/60 py-2.5 pl-9 pr-3 text-sm text-white placeholder-muted outline-none transition-colors focus:border-primary"
          />
        </div>
        <div className="flex gap-3">
          <select value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Filter by rarity" className="flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm text-white outline-none focus:border-primary sm:flex-none">
            {rarities.map((r) => <option key={r} value={r}>{r === 'All' ? 'All rarities' : r}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort" className="flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm text-white outline-none focus:border-primary sm:flex-none">
            <option value="featured">Sort: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {!loading && !error && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Showing {visible.length} of {ceos.length} executives</span>
          {filtersActive && (
            <button type="button" onClick={() => { setSearch(''); setRarity('All'); setSort('featured') }} className="inline-flex items-center gap-1 text-primary hover:underline">
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <EmptyState Icon={AlertCircle} title="Could not load the market" description={error} action={<Button size="sm" variant="outline" onClick={reload}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />
      ) : visible.length === 0 ? (
        <EmptyState Icon={Inbox} title={ceos.length === 0 ? 'No executives available yet' : 'No matches'} description={ceos.length === 0 ? 'Check back soon.' : 'Try a different search or filter.'} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((ceo) => <MarketCard key={ceo.id} ceo={ceo} />)}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <Sparkles className="h-3.5 w-3.5" /> New tiers and special editions arrive over time.
      </p>
    </div>
  )
}

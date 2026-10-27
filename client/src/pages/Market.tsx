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
import { notifyResourcesChanged, useResources } from '../lib/resources'
import { formatNumber, formatUsd } from '../lib/format'
import { useT, type TranslationKey } from '../i18n'

type SortKey = 'featured' | 'price-asc' | 'price-desc'

function MarketCard({ ceo, spTotal }: { ceo: Ceo; spTotal: number }) {
  const t = useT()
  const style = rarityStyle(ceo.rarity)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const priceSp = ceo.priceUsd <= 0 ? 0 : Math.round(ceo.priceUsd * 1000)
  const affordable = priceSp === 0 || spTotal >= priceSp
  const shortfall = priceSp > 0 ? Math.max(0, priceSp - spTotal) : 0

  async function buy() {
    setBusy(true)
    setNotice('')
    try {
      await createPurchase(ceo.id, `${ceo.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      notifyResourcesChanged()
      setNotice(t('market.purchased'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('market.purchaseFailed')
      setNotice(
        msg === 'insufficient_sp'
          ? t('market.insufficient')
          : msg === 'ownership_limit'
            ? t('market.ownershipLimit')
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
          <CeoAvatar name={ceo.name} slug={ceo.slug} rarity={ceo.rarity} size={60} imageUrl={ceo.imageUrl} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold leading-tight text-white">{ceo.name}</h3>
            <p className="text-[11px] text-muted">{ceoRole(ceo.rarity)}</p>
            <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>{t(`rarity.${ceo.rarity}` as TranslationKey)}</span>
          </div>
        </div>

        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] text-muted">{t('market.price')}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">{ceo.priceUsd === 0 ? t('common.free') : formatUsd(ceo.priceUsd)}</span>
              {ceo.priceUsd > 0 && <span className="text-xs text-muted">USDT</span>}
            </div>
            {ceo.priceUsd > 0 && (
              <p className="mt-0.5 text-[10px] text-accent">≈ {formatNumber(priceSp)} SP</p>
            )}
          </div>
          <div className="text-end">
            <p className="text-[10px] text-muted">{t('market.lifetimeCap')}</p>
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
            <div className="text-[9px] uppercase tracking-wide text-muted">{t('market.baseCycle')}</div>
          </div>
        </div>

        <p className="mb-3 flex items-center gap-1.5 text-[10px] text-muted">
          <ShieldCheck className="h-3 w-3 shrink-0 text-success" /> {t('market.notInvestment')}
        </p>

        {notice && <p className="mb-2 text-[10px] text-amber-300">{notice}</p>}
        {priceSp > 0 && (
          <p className={`mb-2 text-[10px] ${affordable ? 'text-muted' : 'text-amber-300'}`}>
            {affordable
              ? t('market.balanceFirst', { sp: formatNumber(spTotal) })
              : t('market.needMore', { sp: formatNumber(shortfall), balance: formatNumber(spTotal) })}
          </p>
        )}
        <Button variant="primary" size="sm" className="mt-auto w-full" isLoading={busy} disabled={ceo.priceUsd <= 0 || !affordable} onClick={buy}>
          <ShoppingCart className="h-3.5 w-3.5 me-2" /> {ceo.priceUsd <= 0 ? t('market.includedFree') : affordable ? t('market.buyWithSp') : t('market.notEnough')}
        </Button>
      </div>
    </Card>
  )
}

export default function Market() {
  const t = useT()
  const { data, loading, error, reload } = useApi(() => fetchCeos(), [])
  const resources = useResources()
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('All')
  const [sort, setSort] = useState<SortKey>('featured')

  const spTotal = Number(resources.data?.sp.totalSp ?? 0)
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
        eyebrow={t('market.eyebrow')}
        title={t('market.title')}
        description={t('market.description')}
        right={<Badge variant="default">{spTotal > 0 ? t('common.balance') + ' ' + formatNumber(spTotal) + ' SP' : t('market.spMarket')}</Badge>}
      />

      <Card padding="sm" className="border border-success/25 bg-success/5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <p className="text-xs text-success/90">{t('market.notice')}</p>
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('market.searchPlaceholder')}
            aria-label={t('market.searchLabel')}
            className="w-full rounded-xl border border-line bg-surface-2/60 py-2.5 ps-9 pe-3 text-sm text-white placeholder-muted outline-none transition-colors focus:border-primary"
          />
        </div>
        <div className="flex gap-3">
          <select value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label={t('market.filterLabel')} className="flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm text-white outline-none focus:border-primary sm:flex-none">
            {rarities.map((r) => <option key={r} value={r}>{r === 'All' ? t('market.allRarities') : t(`rarity.${r}` as TranslationKey)}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label={t('market.sortLabel')} className="flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm text-white outline-none focus:border-primary sm:flex-none">
            <option value="featured">{t('market.sort.featured')}</option>
            <option value="price-asc">{t('market.sort.priceAsc')}</option>
            <option value="price-desc">{t('market.sort.priceDesc')}</option>
          </select>
        </div>
      </div>

      {!loading && !error && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{t('market.showing', { shown: visible.length, total: ceos.length })}</span>
          {filtersActive && (
            <button type="button" onClick={() => { setSearch(''); setRarity('All'); setSort('featured') }} className="inline-flex items-center gap-1 text-primary hover:underline">
              <X className="h-3 w-3" /> {t('market.clearFilters')}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <EmptyState Icon={AlertCircle} title={t('market.error')} description={error} action={<Button size="sm" variant="outline" onClick={reload}><RefreshCw className="me-2 h-4 w-4" />{t('common.retry')}</Button>} />
      ) : visible.length === 0 ? (
        <EmptyState Icon={Inbox} title={ceos.length === 0 ? t('market.none.title') : t('market.noMatch.title')} description={ceos.length === 0 ? t('market.none.body') : t('market.noMatch.body')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((ceo) => <MarketCard key={ceo.id} ceo={ceo} spTotal={spTotal} />)}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <Sparkles className="h-3.5 w-3.5" /> {t('market.footer')}
      </p>
    </div>
  )
}

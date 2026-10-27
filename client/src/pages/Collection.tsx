import { Cpu, AlertTriangle, Coins, Clock, Gem } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress, SectionHeading, EmptyState, CardSkeleton } from '../components/ui/kit'
import { CeoAvatar, RARITY_FRAME, RARITY_GLOW, ceoRole } from '../components/CeoAvatar'
import { rarityStyle } from '../lib/ceos'
import { useApi } from '../lib/useApi'
import { fetchOwnedCeos } from '../lib/game'
import { formatNumber, formatDate } from '../lib/format'
import { useT, type TranslationKey } from '../i18n'

export default function Collection() {
  const t = useT()
  const { data, loading, error, reload } = useApi(() => fetchOwnedCeos(), [])
  const owned = data ?? []
  const active = owned.filter((c) => !c.archivedAt && c.status !== 'EXHAUSTED')
  const archived = owned.length - active.length

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow={t('collection.eyebrow')}
        title={t('collection.title')}
        description={t('collection.description')}
        right={<Badge>{t('stat.owned', { count: owned.length })}</Badge>}
      />

      {!loading && !error && owned.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Card padding="sm" className="text-center"><p className="text-[10px] uppercase tracking-wide text-muted">{t('stat.active')}</p><p className="text-lg font-bold text-success">{active.length}</p></Card>
          <Card padding="sm" className="text-center"><p className="text-[10px] uppercase tracking-wide text-muted">{t('stat.archived')}</p><p className="text-lg font-bold text-muted">{archived}</p></Card>
          <Card padding="sm" className="text-center"><p className="text-[10px] uppercase tracking-wide text-muted">{t('stat.rarities')}</p><p className="text-lg font-bold text-accent">{new Set(owned.map((c) => c.rarity)).size}</p></Card>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : error ? (
        <EmptyState Icon={AlertTriangle} title={t('collection.error')} description={error} action={<Button size="sm" variant="outline" onClick={reload}>{t('common.retry')}</Button>} />
      ) : owned.length === 0 ? (
        <EmptyState Icon={Cpu} title={t('collection.empty.title')} description={t('collection.empty.body')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {owned.map((ceo) => {
            const style = rarityStyle(ceo.rarity)
            const cap = ceo.lifetimeCapSp ?? 0
            const archivedCeo = !!ceo.archivedAt || ceo.status === 'EXHAUSTED'
            return (
              <Card key={ceo.id} padding="md" className={`border ${RARITY_FRAME[ceo.rarity] ?? 'border-line'} ${RARITY_GLOW[ceo.rarity] ?? ''}`}>
                <div className="flex items-center gap-3">
                  <CeoAvatar name={ceo.templateName} slug={ceo.templateSlug} rarity={ceo.rarity} size={64} state={archivedCeo ? 'exhausted' : ceo.canCollect ? 'ready' : ceo.cycleEndsAt ? 'producing' : 'idle'} imageUrl={ceo.templateImageUrl} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-white">{ceo.templateName}</h3>
                    <p className={`text-[11px] font-semibold ${style.accent}`}>{ceoRole(ceo.rarity)} · {t(`rarity.${ceo.rarity}` as TranslationKey)}</p>
                    <p className="text-[10px] text-muted">{t(`equip.${ceo.equipment}` as TranslationKey)}</p>
                    <p className="text-[10px] text-muted">{t('collection.acquired', { date: formatDate(ceo.acquiredAt) })}</p>
                  </div>
                  {archivedCeo ? <Badge variant="warning">{t('common.archived')}</Badge> : <Badge variant="success">{t('common.active')}</Badge>}
                </div>

                <div className="mt-3">
                  <Progress value={ceo.lifetimeEarnedSp} max={cap || 1} tone="gold" label={t('collection.produced', { earned: formatNumber(ceo.lifetimeEarnedSp), cap: formatNumber(cap) })} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-line bg-surface-2/60 py-1.5">
                    <Coins className="mx-auto h-3.5 w-3.5 text-gold" />
                    <div className="text-[11px] font-bold text-white">{ceo.nominalSpPer24h != null ? formatNumber(ceo.nominalSpPer24h) : '—'}</div>
                    <div className="text-[9px] uppercase text-muted">{t('collection.sp24h')}</div>
                  </div>
                  <div className="rounded-lg border border-line bg-surface-2/60 py-1.5">
                    <Clock className="mx-auto h-3.5 w-3.5 text-muted" />
                    <div className="text-[11px] font-bold text-white">{ceo.cycleHours}h</div>
                    <div className="text-[9px] uppercase text-muted">{t('collection.base')}</div>
                  </div>
                  <div className="rounded-lg border border-line bg-surface-2/60 py-1.5">
                    <Gem className="mx-auto h-3.5 w-3.5 text-accent" />
                    <div className="truncate text-[11px] font-bold text-white">{t(`acquisition.${ceo.acquisitionType}` as TranslationKey)}</div>
                    <div className="text-[9px] uppercase text-muted">{t('collection.origin')}</div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

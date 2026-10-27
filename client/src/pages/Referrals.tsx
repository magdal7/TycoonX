import { useState } from 'react'
import { AlertTriangle, Check, Copy, Gift, RefreshCw, Users } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { EmptyState, SectionHeading, Skeleton, Stat } from '../components/ui/kit'
import { useApi } from '../lib/useApi'
import { fetchReferrals, type ReferralState } from '../lib/game'
import { formatDate } from '../lib/format'
import { useT } from '../i18n'

const STATE_VARIANT: Record<ReferralState, 'default' | 'demo' | 'success' | 'warning'> = {
  PENDING: 'warning',
  QUALIFIED: 'success',
  REJECTED: 'default',
  REVOKED: 'default',
}

export default function Referrals() {
  const t = useT()
  const { data, loading, error, reload } = useApi(() => fetchReferrals(), [])
  const [copied, setCopied] = useState(false)

  const link = data?.link ? `${window.location.origin}${data.link}` : ''
  const commissionHistory = (data?.history ?? []).flatMap((h) =>
    h.rewards
      .filter((r) => r.kind === 'PURCHASE_COMMISSION')
      .map((r) => ({ ...r, referredUsername: h.referredUsername, createdAt: h.createdAt })),
  )

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow={t('referrals.eyebrow')}
        title={t('referrals.title')}
        description={
          data?.rewardsEnabled
            ? t('referrals.descriptionOn', { bonus: data.registrationBonusSp, percent: data.commissionPercent })
            : t('referrals.descriptionOff')
        }
        right={<Button size="sm" variant="ghost" onClick={reload} iconLeft={<RefreshCw className="h-4 w-4" />}>{t('common.refresh')}</Button>}
      />

      {loading ? (
        <Skeleton className="h-48" />
      ) : error || !data ? (
        <EmptyState Icon={AlertTriangle} title={t('referrals.error')} description={error} action={<Button size="sm" variant="outline" onClick={reload}>{t('common.retry')}</Button>} />
      ) : (
        <>
          <Card padding="md" hover={false}>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-white">{t('referrals.codeTitle')}</h2>
              {data.rewardsEnabled ? (
                <Badge variant="success" className="ms-auto">{t('referrals.rewardsActive')}</Badge>
              ) : (
                <Badge variant="warning" className="ms-auto">{t('referrals.rewardsDisabled')}</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              {t('referrals.shareBody', { bonus: data.registrationBonusSp, percent: data.commissionPercent, currency: data.commissionCurrency })}
              {!data.rewardsEnabled && (
                <span className="font-semibold text-ink">{t('referrals.rewardsDisabledInline')}</span>
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={link} className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted" aria-label={t('referrals.linkLabel')} dir="ltr" />
              <Button size="sm" variant="outline" onClick={copy} iconLeft={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{copied ? t('common.copied') : t('common.copy')}</Button>
            </div>
            <p className="mt-2 text-[11px] text-muted">{t('referrals.code')} <b className="text-white">{data.code ?? '—'}</b></p>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t('referrals.total')} value={String(data.total)} Icon={Users} />
            <Stat label={t('referrals.qualified')} value={String(data.qualified)} Icon={Check} tone="text-success" />
            <Stat label={t('referrals.pending')} value={data.pendingRewardsSp} Icon={Gift} tone="text-gold" />
            <Stat label={t('referrals.earned')} value={data.paidRewardsSp} Icon={Gift} tone="text-primary" />
          </div>

          <Card padding="md" hover={false}>
            <h2 className="text-sm font-bold text-white">{t('referrals.rulesTitle')}</h2>
            <ul className="mt-1 list-disc space-y-1 ps-4 text-xs text-muted">
              <li>{t('referrals.rule1')}</li>
              <li>{t('referrals.rule2')}</li>
              <li>{t('referrals.rule3')}</li>
              <li>{t('referrals.rule4')}</li>
              <li>{t('referrals.rule5')}</li>
              <li>{t('referrals.rule6')}</li>
            </ul>
          </Card>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-white">{t('referrals.commissionHistory')}</h2>
            {commissionHistory.length === 0 ? (
              <EmptyState Icon={Gift} title={t('referrals.commissionEmpty.title')} description={t('referrals.commissionEmpty.body')} />
            ) : (
              <Card padding="none" className="overflow-hidden border-line">
                {commissionHistory.map((c, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2.5 ${i !== 0 ? 'border-t border-line' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-white">{c.referredUsername}</p>
                      <p className="truncate text-[10px] text-muted">{c.purchaseRef ?? '—'} · {formatDate(c.createdAt)}</p>
                    </div>
                    <span className="text-xs font-semibold text-gold">{c.amountSp} SP</span>
                    <Badge variant={c.status === 'PAID' ? 'success' : c.status === 'REVERSED' ? 'default' : 'warning'}>{c.status.toLowerCase()}</Badge>
                  </div>
                ))}
              </Card>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-white">{t('referrals.historyTitle')}</h2>
            {data.history.length === 0 ? (
              <EmptyState Icon={Users} title={t('referrals.historyEmpty.title')} description={t('referrals.historyEmpty.body')} />
            ) : (
              data.history.map((h) => (
                <Card key={h.id} padding="md" hover={false}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{h.referredUsername}</span>
                    <Badge variant={STATE_VARIANT[h.status]}>{h.status}</Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    {t('referrals.joined', { date: formatDate(h.createdAt) })}
                    {h.qualifiedAt ? t('referrals.qualifiedAt', { date: formatDate(h.qualifiedAt) }) : ''}
                  </p>
                  {h.rewards.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {h.rewards.map((r, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 text-[11px] text-muted">
                          <span>{r.kind === 'REGISTRATION_BONUS' ? t('referrals.registrationBonus') : t('referrals.purchaseCommission')}</span>
                          <span className="text-end">
                            {r.amountSp} {r.currency}
                            <span className={r.status === 'REVERSED' ? 'text-red-300' : r.status === 'PAID' ? 'text-success' : 'text-amber-300'}>
                              {' '}· {r.status.toLowerCase()}
                            </span>
                            {r.heldSp && Number(r.heldSp) > 0 ? ` · ${t('referrals.held', { sp: r.heldSp })}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))
            )}
          </section>
        </>
      )}
    </div>
  )
}

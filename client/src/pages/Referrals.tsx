import { useState } from 'react'
import { AlertTriangle, Check, Copy, Gift, RefreshCw, Users } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { EmptyState, SectionHeading, Skeleton, Stat } from '../components/ui/kit'
import { useApi } from '../lib/useApi'
import { fetchReferrals, type ReferralState } from '../lib/game'

const STATE_VARIANT: Record<ReferralState, 'default' | 'demo' | 'success' | 'warning'> = {
  PENDING: 'warning',
  QUALIFIED: 'success',
  REJECTED: 'default',
  REVOKED: 'default',
}

export default function Referrals() {
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
        eyebrow="Growth"
        title="Referrals"
        description={
          data?.rewardsEnabled
            ? "Invite friends. A referred user's first confirmed deposit-funded CEO purchase qualifies them — earning you 10 Bonus SP plus 10% recurring commission on their deposit-funded purchases."
            : "Invite friends. Referral rewards are currently disabled while the economics are finalized; qualified referrals are recorded and will not be credited until rewards are enabled."
        }
        right={<Button size="sm" variant="ghost" onClick={reload} iconLeft={<RefreshCw className="h-4 w-4" />}>Refresh</Button>}
      />

      {loading ? (
        <Skeleton className="h-48" />
      ) : error || !data ? (
        <EmptyState Icon={AlertTriangle} title="Could not load referrals" description={error} action={<Button size="sm" variant="outline" onClick={reload}>Retry</Button>} />
      ) : (
        <>
          <Card padding="md" hover={false}>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-white">Your referral code</h2>
              {data.rewardsEnabled ? (
                <Badge variant="success" className="ml-auto">Rewards active</Badge>
              ) : (
                <Badge variant="warning" className="ml-auto">Rewards disabled</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              Share your link. A referred user's <b className="text-ink">first confirmed deposit-funded CEO purchase</b> qualifies them:
              you earn <b className="text-ink">{data.registrationBonusSp} Bonus SP</b> once, plus a recurring{' '}
              <b className="text-ink">{data.commissionPercent}%</b> commission in {data.commissionCurrency} on the deposit-funded portion of
              their later eligible purchases. Commissions are non-withdrawable; free, promotional and referral bonuses never earn commission.
              {!data.rewardsEnabled && (
                <> <b className="text-ink">Rewards are currently disabled</b> — qualified activity is recorded but nothing is credited until they are enabled.</>
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={link} className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted" aria-label="Referral link" />
              <Button size="sm" variant="outline" onClick={copy} iconLeft={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{copied ? 'Copied' : 'Copy'}</Button>
            </div>
            <p className="mt-2 text-[11px] text-muted">Code: <b className="text-white">{data.code ?? '—'}</b></p>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total referrals" value={String(data.total)} Icon={Users} />
            <Stat label="Qualified" value={String(data.qualified)} Icon={Check} tone="text-success" />
            <Stat label="Pending reward SP" value={data.pendingRewardsSp} Icon={Gift} tone="text-gold" />
            <Stat label="Bonus SP earned" value={data.paidRewardsSp} Icon={Gift} tone="text-primary" />
          </div>

          <Card padding="md" hover={false}>
            <h2 className="text-sm font-bold text-white">Eligibility &amp; rules</h2>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted">
              <li>Single-level only; attribution to your inviter is permanent.</li>
              <li>Registration alone earns nothing — a first confirmed deposit-funded CEO purchase qualifies the referral.</li>
              <li>10 Bonus SP once per qualified referral, plus a recurring 10% commission in non-withdrawable Bonus SP.</li>
              <li>Commission applies only to the portion of a purchase funded by confirmed real deposits.</li>
              <li>Refunded, cancelled or charged-back purchases reverse the associated rewards.</li>
              <li>Self-referrals, duplicates and suspicious referrals are rejected or held for admin review.</li>
            </ul>
          </Card>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-white">Commission history</h2>
            {commissionHistory.length === 0 ? (
              <EmptyState Icon={Gift} title="No commissions yet" description="Commissions appear after a referred user's deposit-funded CEO purchases." />
            ) : (
              <Card padding="none" className="overflow-hidden border-line">
                {commissionHistory.map((c, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2.5 ${i !== 0 ? 'border-t border-line' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-white">{c.referredUsername}</p>
                      <p className="truncate text-[10px] text-muted">{c.purchaseRef ?? '—'} · {new Date(c.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs font-semibold text-gold">{c.amountSp} SP</span>
                    <Badge variant={c.status === 'PAID' ? 'success' : c.status === 'REVERSED' ? 'default' : 'warning'}>{c.status.toLowerCase()}</Badge>
                  </div>
                ))}
              </Card>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-white">Referral history</h2>
            {data.history.length === 0 ? (
              <EmptyState Icon={Users} title="No referrals yet" description="Share your link to get started." />
            ) : (
              data.history.map((h) => (
                <Card key={h.id} padding="md" hover={false}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{h.referredUsername}</span>
                    <Badge variant={STATE_VARIANT[h.status]}>{h.status}</Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    joined {new Date(h.createdAt).toLocaleDateString()}
                    {h.qualifiedAt ? ` · qualified ${new Date(h.qualifiedAt).toLocaleDateString()}` : ''}
                  </p>
                  {h.rewards.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {h.rewards.map((r, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 text-[11px] text-muted">
                          <span>{r.kind === 'REGISTRATION_BONUS' ? 'Qualification bonus' : 'Purchase commission'}</span>
                          <span className="text-right">
                            {r.amountSp} {r.currency}
                            <span className={r.status === 'REVERSED' ? 'text-red-300' : r.status === 'PAID' ? 'text-success' : 'text-amber-300'}>
                              {' '}· {r.status.toLowerCase()}
                            </span>
                            {r.heldSp && Number(r.heldSp) > 0 ? ` · ${r.heldSp} held` : ''}
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

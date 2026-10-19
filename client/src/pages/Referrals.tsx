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
        description="Invite friends and track qualification. Rewards stay disabled until the owner approves the economics."
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
              <Badge variant="warning" className="ml-auto">Rewards pending approval</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              Share your link. Qualified referrals may earn {data.registrationBonusSp} Bonus SP and {data.commissionPercent}% recurring
              commission ({data.commissionCurrency}) once qualification is approved — not active yet.
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
            <Stat label="Paid reward SP" value={data.paidRewardsSp} Icon={Gift} tone="text-primary" />
          </div>

          <Card padding="md" hover={false}>
            <h2 className="text-sm font-bold text-white">Qualification criteria (not finalized)</h2>
            <p className="mt-1 text-xs text-muted">
              Minimum level {data.qualification.minLevel} · minimum cycles collected {data.qualification.minCyclesCollected} ·
              email verification {data.qualification.requireEmailVerification ? 'required' : 'not required'}
            </p>
          </Card>

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
                        <li key={i} className="flex items-center justify-between text-[11px] text-muted">
                          <span>{r.kind === 'REGISTRATION_BONUS' ? 'Referral bonus' : 'Purchase commission'}</span>
                          <span>{r.amountSp} {r.currency} · {r.status}</span>
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

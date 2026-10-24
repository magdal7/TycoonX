import { useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Search, ShieldAlert, XCircle } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { SectionHeading, EmptyState, Skeleton, Tabs } from '../../components/ui/kit'
import { useApi } from '../../lib/useApi'
import {
  fetchAdminReferralRewards,
  fetchAdminReferrals,
  reviewAdminReferral,
  type AdminReferral,
  type AdminReferralState,
} from '../../lib/admin'

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'QUALIFIED', label: 'Qualified' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'REVOKED', label: 'Revoked' },
] as const

const STATUS_VARIANT: Record<AdminReferralState, 'default' | 'demo' | 'success' | 'warning'> = {
  PENDING: 'warning',
  QUALIFIED: 'success',
  REJECTED: 'default',
  REVOKED: 'default',
}

const REWARD_VARIANT: Record<string, 'default' | 'success' | 'warning'> = {
  PENDING: 'warning',
  PAID: 'success',
  REVERSED: 'default',
}

export default function AdminReferrals() {
  const [filter, setFilter] = useState<'ALL' | AdminReferralState>('ALL')
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')

  const referrals = useApi(
    () => fetchAdminReferrals({ ...(filter !== 'ALL' ? { status: filter } : {}), ...(query ? { q: query } : {}) }),
    [filter, query],
  )
  const rewards = useApi(() => fetchAdminReferralRewards(), [])

  async function review(r: AdminReferral, decision: 'QUALIFY' | 'REJECT' | 'REVOKE') {
    const verb = decision === 'QUALIFY' ? 'Qualify' : decision === 'REJECT' ? 'Reject' : 'Revoke'
    if (!window.confirm(`${verb} referral of ${r.referredUsername} by ${r.referrerUsername}?`)) return
    setBusyId(r.id)
    setNotice('')
    try {
      await reviewAdminReferral(r.id, decision, notes[r.id]?.trim() || undefined, true)
      setNotes((n) => ({ ...n, [r.id]: '' }))
      setNotice(`${verb} — ${r.referredUsername}`)
      referrals.reload()
      rewards.reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Review failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Admin"
        title="Referrals"
        description={referrals.data?.rewardsEnabled ? 'Qualification review, commission records and abuse flags. Rewards are ACTIVE.' : 'Qualification review, commission records and abuse flags. Rewards remain disabled.'}
        right={<Button size="sm" variant="ghost" onClick={referrals.reload} iconLeft={<RefreshCw className="h-4 w-4" />}>Refresh</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Tabs tabs={FILTERS.map((f) => ({ id: f.id, label: f.label }))} value={filter} onChange={setFilter} className="flex-1" />
        <form onSubmit={(e) => { e.preventDefault(); setQuery(term.trim()) }} className="flex gap-1.5">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search username" className="text-xs" />
          <Button type="submit" size="sm" variant="outline" iconLeft={<Search className="h-3.5 w-3.5" />}>Go</Button>
        </form>
      </div>

      {notice && <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">{notice}</div>}

      {referrals.loading ? (
        <Skeleton className="h-40" />
      ) : referrals.error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load referrals" description={referrals.error} action={<Button size="sm" variant="outline" onClick={referrals.reload}>Retry</Button>} />
      ) : !referrals.data?.referrals?.length ? (
        <EmptyState Icon={CheckCircle2} title="No referrals" description="No referral attributions in this view." />
      ) : (
        <div className="space-y-2">
          {referrals.data.referrals.map((r) => (
            <Card key={r.id} padding="md" hover={false}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                    <span className="text-sm font-semibold">{r.referrerUsername} <span className="text-muted">→</span> {r.referredUsername}</span>
                    {r.suspiciousSharedIp && <Badge variant="warning"><ShieldAlert className="mr-1 h-3 w-3" />shared IP</Badge>}
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    code {r.code} · joined {new Date(r.createdAt).toLocaleDateString()}
                    {r.qualifiedAt ? ` · qualified ${new Date(r.qualifiedAt).toLocaleDateString()}` : ''}
                    {r.purchaseEvents > 0 ? ` · ${r.purchaseEvents} purchase event(s)` : ''}
                  </p>
                  {r.rewards.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {r.rewards.map((rw, i) => (
                        <li key={i} className="text-[11px] text-muted">{rw.kind}: {rw.amountSp} SP ({rw.status})</li>
                      ))}
                    </ul>
                  )}
                  {['PENDING', 'QUALIFIED'].includes(r.status) && (
                    <Input value={notes[r.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} placeholder="Review note (optional)" className="mt-2 text-xs" />
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.status !== 'QUALIFIED' && (
                    <Button size="sm" variant="success" disabled={busyId === r.id} onClick={() => review(r, 'QUALIFY')} iconLeft={<CheckCircle2 className="h-3.5 w-3.5" />}>Qualify</Button>
                  )}
                  {r.status === 'PENDING' && (
                    <Button size="sm" variant="danger" disabled={busyId === r.id} onClick={() => review(r, 'REJECT')} iconLeft={<XCircle className="h-3.5 w-3.5" />}>Reject</Button>
                  )}
                  {r.status === 'QUALIFIED' && (
                    <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => review(r, 'REVOKE')}>Revoke</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold">Commission & reward records</h2>
        {rewards.loading ? (
          <Skeleton className="h-20" />
        ) : !rewards.data?.length ? (
          <p className="text-xs text-muted">No reward records yet.</p>
        ) : (
          rewards.data.map((rw) => (
            <Card key={rw.id} padding="sm" hover={false}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-2">
                  <Badge variant={REWARD_VARIANT[rw.status] ?? 'default'}>{rw.status}</Badge>
                  <span>{rw.kind === 'REGISTRATION_BONUS' ? 'Referral bonus' : 'Purchase commission'}</span>
                  <span className="text-muted">{rw.referrerUsername}</span>
                </span>
                <span className="text-muted">
                  {rw.amountSp} {rw.currency}
                  {Number(rw.heldSp) > 0 ? ` · ${rw.heldSp} held` : ''}
                  {rw.purchaseRef ? ` · ${rw.purchaseRef}` : ''}
                </span>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  )
}

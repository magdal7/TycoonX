import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Send, XCircle } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { SectionHeading, EmptyState, Skeleton, Tabs } from '../../components/ui/kit'
import { useApi } from '../../lib/useApi'
import {
  fetchAdminWithdrawals,
  reconcileAdminWithdrawalPayout,
  resolveAdminWithdrawalPayout,
  reviewAdminWithdrawal,
  submitAdminWithdrawalPayout,
  type AdminWithdrawal,
} from '../../lib/admin'

const FILTERS = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'ALL', label: 'All' },
] as const

const STATUS_VARIANT: Record<string, 'default' | 'demo' | 'success' | 'warning'> = {
  REQUESTED: 'demo',
  ON_HOLD: 'warning',
  APPROVED: 'success',
  REJECTED: 'default',
  CANCELLED: 'default',
  PAID: 'success',
}

const REVIEWABLE = ['REQUESTED', 'ON_HOLD', 'APPROVED']

export default function AdminWithdrawals() {
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const { data, loading, error, reload } = useApi(() => fetchAdminWithdrawals(), [])

  const withdrawals = data?.withdrawals ?? []
  const payoutsEnabled = data?.payoutsEnabled ?? false
  const rows = withdrawals.filter((w) => filter === 'ALL' || REVIEWABLE.includes(w.status))

  async function run(id: number, fn: () => Promise<unknown>, ok: string) {
    setBusyId(id)
    setNotice('')
    try {
      await fn()
      setNotice(ok)
      reload()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  function review(w: AdminWithdrawal, decision: 'APPROVED' | 'REJECTED' | 'ON_HOLD') {
    const verb = decision === 'APPROVED' ? 'Approve' : decision === 'REJECTED' ? 'Reject' : 'Hold'
    if (!window.confirm(`${verb} withdrawal #${w.id} for ${w.username}? No crypto is transferred.`)) return
    void run(
      w.id,
      () => reviewAdminWithdrawal(w.id, decision, notes[w.id]?.trim() || undefined),
      `Withdrawal #${w.id} ${decision.toLowerCase()}.`,
    )
  }

  function submitPayout(w: AdminWithdrawal) {
    if (
      !window.confirm(
        `Submit withdrawal #${w.id} for ${w.username} to the provider?\n\n${w.netUsdt} USDT (USDT/BEP20) to ${w.address}\n\nThis sends REAL crypto and cannot be undone.`,
      )
    )
      return
    void run(w.id, () => submitAdminWithdrawalPayout(w.id), `Payout submitted for #${w.id}.`)
  }

  function reconcilePayout(w: AdminWithdrawal) {
    void run(w.id, () => reconcileAdminWithdrawalPayout(w.id), `Reconciled #${w.id} from the provider.`)
  }

  function resolvePayout(w: AdminWithdrawal, resolution: 'not_submitted' | 'attach_track_id') {
    let trackId: string | undefined
    if (resolution === 'attach_track_id') {
      trackId = window.prompt(`Enter the OxaPay payout track id for withdrawal #${w.id}:`)?.trim() || undefined
      if (!trackId) return
    } else if (
      !window.confirm(
        `Confirm OxaPay shows NO payout was created for withdrawal #${w.id}.\n\nThis clears the submission lock so you can retry.`,
      )
    )
      return
    void run(w.id, () => resolveAdminWithdrawalPayout(w.id, resolution, trackId), `Withdrawal #${w.id} resolved.`)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Admin"
        title="Withdrawals"
        description={
          payoutsEnabled
            ? 'Approve, then submit to OxaPay. Payouts are real and irreversible — verify the address first.'
            : 'Internal review only. Payouts are disabled and no crypto is transferred.'
        }
        right={<Button size="sm" variant="ghost" onClick={reload} iconLeft={<RefreshCw className="h-4 w-4" />}>Refresh</Button>}
      />
      <Tabs tabs={FILTERS.map((f) => ({ id: f.id, label: f.label }))} value={filter} onChange={setFilter} />

      {notice && (
        <div className="rounded-xl border border-line bg-surface-2/50 px-3 py-2 text-xs text-ink">{notice}</div>
      )}

      {loading ? (
        <Skeleton className="h-40" />
      ) : error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load withdrawals" description={error} action={<Button size="sm" variant="outline" onClick={reload}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState Icon={CheckCircle2} title="Nothing to review" description="No withdrawal requests in this view." />
      ) : (
        <div className="space-y-2">
          {rows.map((w) => {
            const reviewing = REVIEWABLE.includes(w.status)
            const canSubmit = payoutsEnabled && w.status === 'APPROVED' && !w.payoutSubmitted && !w.payoutUncertain
            const canReconcile = payoutsEnabled && w.payoutSubmitted
            const rejectBlocked = w.payoutSubmitted || w.payoutUncertain
            return (
              <Card key={w.id} padding="md" hover={false}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[w.status] ?? 'default'}>{w.status}</Badge>
                      <span className="text-sm font-semibold">{w.username}</span>
                      <span className="text-[10px] text-muted">#{w.id} · {new Date(w.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      gross {w.grossSp} SP · fee {w.feeUsdt} · net <b className="text-ink">{w.netUsdt} USDT</b> · {w.network}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-muted">{w.address}</p>
                    {w.payoutIntentTrackId && (
                      <p className="mt-0.5 text-[10px] text-muted">Track: {w.payoutIntentTrackId}</p>
                    )}
                    {w.paidAt && (
                      <p className="mt-0.5 text-[10px] text-success">Paid {new Date(w.paidAt).toLocaleString()}{w.payoutTrackId ? ` · ${w.payoutTrackId}` : ''}</p>
                    )}
                    {w.note && <p className="mt-1 text-[10px] text-amber-400">Note: {w.note}</p>}
                    {w.payoutUncertain && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Submission outcome unknown. Check OxaPay before retrying — do not resubmit blindly.
                      </div>
                    )}
                    {reviewing && (
                      <Input
                        value={notes[w.id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))}
                        placeholder="Review note (optional)"
                        className="mt-2 text-xs"
                      />
                    )}
                  </div>
                  <div className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:justify-end">
                    {reviewing && (
                      <>
                        <Button size="sm" variant="success" isLoading={busyId === w.id} onClick={() => review(w, 'APPROVED')} iconLeft={<CheckCircle2 className="h-3.5 w-3.5" />}>Approve</Button>
                        <Button size="sm" variant="outline" disabled={busyId === w.id} onClick={() => review(w, 'ON_HOLD')} iconLeft={<Clock className="h-3.5 w-3.5" />}>Hold</Button>
                        <Button size="sm" variant="danger" disabled={busyId === w.id || rejectBlocked} onClick={() => review(w, 'REJECTED')} iconLeft={<XCircle className="h-3.5 w-3.5" />}>Reject</Button>
                      </>
                    )}
                    {canSubmit && (
                      <Button size="sm" variant="primary" isLoading={busyId === w.id} onClick={() => submitPayout(w)} iconLeft={<Send className="h-3.5 w-3.5" />}>Submit payout</Button>
                    )}
                    {canReconcile && (
                      <Button size="sm" variant="outline" isLoading={busyId === w.id} onClick={() => reconcilePayout(w)} iconLeft={<RefreshCw className="h-3.5 w-3.5" />}>Reconcile</Button>
                    )}
                    {w.payoutUncertain && (
                      <>
                        <Button size="sm" variant="outline" disabled={busyId === w.id} onClick={() => resolvePayout(w, 'attach_track_id')}>Attach track id</Button>
                        <Button size="sm" variant="outline" disabled={busyId === w.id} onClick={() => resolvePayout(w, 'not_submitted')}>Mark not submitted</Button>
                      </>
                    )}
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

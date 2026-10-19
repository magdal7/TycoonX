import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { SectionHeading, EmptyState, Skeleton, Tabs } from '../../components/ui/kit'
import { useApi } from '../../lib/useApi'
import { fetchAdminWithdrawals, reviewAdminWithdrawal, type AdminWithdrawal } from '../../lib/admin'

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

export default function AdminWithdrawals() {
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)
  const { data, loading, error, reload } = useApi(() => fetchAdminWithdrawals(), [])

  const rows = (data ?? []).filter((w) => filter === 'ALL' || ['REQUESTED', 'ON_HOLD', 'APPROVED'].includes(w.status))

  async function review(w: AdminWithdrawal, decision: 'APPROVED' | 'REJECTED' | 'ON_HOLD') {
    const verb = decision === 'APPROVED' ? 'Approve' : decision === 'REJECTED' ? 'Reject' : 'Hold'
    if (!window.confirm(`${verb} withdrawal #${w.id} for ${w.username}? No crypto is transferred.`)) return
    setBusyId(w.id)
    try {
      await reviewAdminWithdrawal(w.id, decision, notes[w.id]?.trim() || undefined)
      setNotes((n) => ({ ...n, [w.id]: '' }))
      reload()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Admin"
        title="Withdrawals"
        description="Internal review only. Payouts are disabled and no crypto is transferred."
        right={<Button size="sm" variant="ghost" onClick={reload} iconLeft={<RefreshCw className="h-4 w-4" />}>Refresh</Button>}
      />
      <Tabs tabs={FILTERS.map((f) => ({ id: f.id, label: f.label }))} value={filter} onChange={setFilter} />

      {loading ? (
        <Skeleton className="h-40" />
      ) : error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load withdrawals" description={error} action={<Button size="sm" variant="outline" onClick={reload}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState Icon={CheckCircle2} title="Nothing to review" description="No withdrawal requests in this view." />
      ) : (
        <div className="space-y-2">
          {rows.map((w) => (
            <Card key={w.id} padding="md" hover={false}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[w.status] ?? 'default'}>{w.status}</Badge>
                    <span className="text-sm font-semibold">{w.username}</span>
                    <span className="text-[10px] text-muted">#{w.id} · {new Date(w.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{w.grossSp} SP → {w.netUsdt} USDT (fee {w.feeUsdt}) · {w.network}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted">{w.address}</p>
                  {w.note && <p className="mt-1 text-[10px] text-amber-400">Note: {w.note}</p>}
                  {['REQUESTED', 'ON_HOLD', 'APPROVED'].includes(w.status) && (
                    <Input
                      value={notes[w.id] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))}
                      placeholder="Review note (optional)"
                      className="mt-2 text-xs"
                    />
                  )}
                </div>
                {['REQUESTED', 'ON_HOLD', 'APPROVED'].includes(w.status) && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="success" isLoading={busyId === w.id} onClick={() => review(w, 'APPROVED')} iconLeft={<CheckCircle2 className="h-3.5 w-3.5" />}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={busyId === w.id} onClick={() => review(w, 'ON_HOLD')} iconLeft={<Clock className="h-3.5 w-3.5" />}>Hold</Button>
                    <Button size="sm" variant="danger" disabled={busyId === w.id} onClick={() => review(w, 'REJECTED')} iconLeft={<XCircle className="h-3.5 w-3.5" />}>Reject</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

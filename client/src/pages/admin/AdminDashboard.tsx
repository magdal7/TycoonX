import { AlertTriangle, RefreshCw, Users, ClipboardList, Clock, CheckCircle2, XCircle, Gift } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Stat, SectionHeading, EmptyState, Skeleton } from '../../components/ui/kit'
import { useApi } from '../../lib/useApi'
import { fetchAdminDashboard } from '../../lib/admin'

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi(() => fetchAdminDashboard(), [])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <EmptyState
        Icon={AlertTriangle}
        title="Could not load dashboard"
        description={error}
        action={<Button size="sm" variant="outline" onClick={reload}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>}
      />
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading eyebrow="Admin" title="Dashboard" description="Operational overview of campaigns and player submissions." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Users" value={data.users} Icon={Users} tone="text-white" />
        <Stat label="Published" value={data.tasks.published} Icon={ClipboardList} tone="text-success" />
        <Stat label="Pending reviews" value={data.submissions.pending} Icon={Clock} tone="text-gold" />
        <Stat label="Claimed rewards" value={data.submissions.claimed} Icon={Gift} tone="text-primary" />
        <Stat label="Draft" value={data.tasks.draft} tone="text-muted" />
        <Stat label="Paused" value={data.tasks.paused} tone="text-warning" />
        <Stat label="Expired" value={data.tasks.expired} tone="text-muted" />
        <Stat label="Archived" value={data.tasks.archived} tone="text-muted" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card padding="md" hover={false}>
          <div className="flex items-center gap-2 text-success"><CheckCircle2 className="h-4 w-4" /><span className="text-sm font-semibold">Approved (awaiting claim)</span></div>
          <p className="mt-1 text-2xl font-bold">{data.submissions.approved}</p>
        </Card>
        <Card padding="md" hover={false}>
          <div className="flex items-center gap-2 text-red-300"><XCircle className="h-4 w-4" /><span className="text-sm font-semibold">Rejected</span></div>
          <p className="mt-1 text-2xl font-bold">{data.submissions.rejected}</p>
        </Card>
        <Card padding="md" hover={false}>
          <div className="flex items-center gap-2 text-muted"><ClipboardList className="h-4 w-4" /><span className="text-sm font-semibold">Total campaigns</span></div>
          <p className="mt-1 text-2xl font-bold">{data.tasks.total}</p>
        </Card>
      </div>

      <Card padding="md" hover={false}>
        <h2 className="text-sm font-bold">Recent admin activity</h2>
        {data.recentAudit.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No admin actions recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {data.recentAudit.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                <span className="flex items-center gap-2">
                  <Badge>{a.action}</Badge>
                  <span className="text-muted">{a.targetType} #{a.targetId}</span>
                </span>
                <span className="text-muted">{new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

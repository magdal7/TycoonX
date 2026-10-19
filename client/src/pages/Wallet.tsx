import { useState } from 'react'
import { Coins, Gem, ArrowDownToLine, AlertTriangle, ShieldCheck, RefreshCw, Wallet as WalletIcon, History, X } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Stat, SectionHeading, EmptyState, Skeleton } from '../components/ui/kit'
import { useApi } from '../lib/useApi'
import { useResources } from '../lib/resources'
import {
  cancelWithdrawal,
  createWithdrawal,
  fetchLedger,
  fetchWithdrawals
} from '../lib/game'
import { formatNumber } from '../lib/format'

const MIN_SP = 3000

const STATUS_TONE: Record<string, 'warning' | 'success' | 'demo' | 'default'> = {
  REQUESTED: 'demo',
  ON_HOLD: 'warning',
  APPROVED: 'success',
  REJECTED: 'default',
  CANCELLED: 'default',
  PAID: 'success'
}

export default function Wallet() {
  const resources = useResources()
  const withdrawals = useApi(() => fetchWithdrawals(), [])
  const ledger = useApi(() => fetchLedger(), [])
  const [gross, setGross] = useState('')
  const [address, setAddress] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const sp = resources.data?.sp
  const earned = sp?.earnedSp ?? 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setNotice('')
    try {
      await createWithdrawal(Number(gross), address)
      setGross('')
      setAddress('')
      withdrawals.reload()
      resources.reload()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  async function cancel(id: number) {
    setBusy(true)
    try {
      await cancelWithdrawal(id)
      withdrawals.reload()
      resources.reload()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const requests = withdrawals.data?.withdrawals ?? []
  const pending = requests.find((r) => ['REQUESTED', 'ON_HOLD', 'APPROVED'].includes(r.status))

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading eyebrow="Balance" title="Wallet" description="Track Earned SP, Bonus SP, and withdrawal requests." right={<Badge variant="warning">Payouts disabled</Badge>} />

      <Card padding="lg" className="border-line">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Earned SP" value={formatNumber(sp?.earnedSp ?? 0)} Icon={Coins} tone="text-gold" hint="potentially withdrawable" />
          <Stat label="Bonus SP" value={formatNumber(sp?.bonusSp ?? 0)} Icon={Gem} tone="text-accent" hint="non-withdrawable" />
          <Stat label="Total SP" value={formatNumber(sp?.totalSp ?? 0)} />
          <Stat label="Lifetime earned" value={formatNumber(sp?.lifetimeEarnedSp ?? 0)} />
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Conversion: 1 USDT = 1,000 SP · Minimum withdrawal 3,000 SP (3 USDT) · Flat fee 0.30 USDT.
        </p>
      </Card>

      {/* Withdrawal request */}
      <Card padding="md" className="border-line">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-white">Request withdrawal</h3>
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Withdrawals are disabled for the MVP. Requests are recorded and reviewed, but no crypto is transferred.
        </div>

        {pending ? (
          <div className="mt-3 rounded-xl border border-line bg-surface-2/50 p-3">
            <p className="text-xs text-muted">You already have a pending request.</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={STATUS_TONE[pending.status] ?? 'default'}>{pending.status}</Badge>
              <span className="text-xs text-white">{formatNumber(pending.grossSp)} SP → {pending.netUsdt} USDT</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => cancel(pending.id)} disabled={busy} iconLeft={<X className="h-3.5 w-3.5" />}>Cancel</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-muted">
                Gross amount (SP)
                <input
                  inputMode="numeric"
                  value={gross}
                  onChange={(e) => setGross(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={String(MIN_SP)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                />
              </label>
              <label className="block text-xs text-muted">
                USDT BEP20 address
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x…"
                  className="mt-1 w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                />
              </label>
            </div>
            {gross && Number(gross) >= MIN_SP && (
              <p className="text-[11px] text-muted">Net after 0.30 USDT fee: <b className="text-white">{(Number(gross) / 1000 - 0.3).toFixed(2)} USDT</b></p>
            )}
            {notice && <p className="text-[11px] text-red-300">{notice}</p>}
            <Button type="submit" disabled={busy || Number(gross) < MIN_SP || earned < Number(gross) || !address} isLoading={busy}>
              Submit request
            </Button>
          </form>
        )}
      </Card>

      {/* Request history */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><WalletIcon className="h-4 w-4 text-muted" /> Withdrawal requests</h3>
        {withdrawals.loading ? <Skeleton className="h-14" /> : requests.length === 0 ? (
          <EmptyState Icon={ShieldCheck} title="No withdrawal requests" description="Requests will appear here once submitted." />
        ) : (
          <Card padding="none" className="overflow-hidden border-line">
            {requests.map((r, i) => (
              <div key={r.id} className={`flex items-center gap-3 px-3 py-3 ${i !== 0 ? 'border-t border-line' : ''}`}>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{formatNumber(r.grossSp)} SP → {r.netUsdt} USDT</p>
                  <p className="text-[10px] text-muted">{r.network} · {r.address.slice(0, 10)}…{r.address.slice(-6)}</p>
                </div>
                <Badge variant={STATUS_TONE[r.status] ?? 'default'}>{r.status}</Badge>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Ledger */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><History className="h-4 w-4 text-muted" /> SP activity</h3>
        {ledger.loading ? <Skeleton className="h-14" /> : (ledger.data ?? []).length === 0 ? (
          <EmptyState Icon={History} title="No SP activity yet" description="Collect a production cycle to see entries here." action={<Button size="sm" variant="outline" onClick={ledger.reload}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>} />
        ) : (
          <Card padding="none" className="overflow-hidden border-line">
            {(ledger.data ?? []).slice(0, 20).map((e, i) => (
              <div key={e.id} className={`flex items-center gap-3 px-3 py-2.5 ${i !== 0 ? 'border-t border-line' : ''}`}>
                <span className={`w-16 shrink-0 text-sm font-bold ${e.amountSp >= 0 ? 'text-success' : 'text-red-300'}`}>
                  {e.amountSp >= 0 ? '+' : ''}{formatNumber(e.amountSp)}
                </span>
                <span className="flex-1 truncate text-xs text-muted">{e.sourceType.replace(/_/g, ' ').toLowerCase()}</span>
                <Badge>{e.bucket}</Badge>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}

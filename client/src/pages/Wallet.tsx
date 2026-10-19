import { useState } from 'react'
import { Coins, Gem, DollarSign, ArrowDownToLine, AlertTriangle, ShieldCheck, RefreshCw, Wallet as WalletIcon, History, X, ShoppingCart } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Stat, SectionHeading, EmptyState, Skeleton } from '../components/ui/kit'
import { useApi } from '../lib/useApi'
import {
  cancelWithdrawal,
  createDeposit,
  createWithdrawal,
  fetchDeposits,
  fetchPurchases,
  fetchWallet,
  fetchWalletTransactions,
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
  PAID: 'success',
  CREATED: 'demo',
  CONFIRMED: 'success',
  PENDING: 'warning',
  DELIVERED: 'success',
  FAILED: 'default'
}

const TYPE_TONE: Record<string, 'warning' | 'success' | 'demo' | 'default'> = {
  SP: 'demo',
  DEPOSIT: 'success',
  WITHDRAWAL: 'warning',
  PURCHASE: 'default'
}

export default function Wallet() {
  const wallet = useApi(() => fetchWallet(), [])
  const withdrawals = useApi(() => fetchWithdrawals(), [])
  const deposits = useApi(() => fetchDeposits(), [])
  const purchases = useApi(() => fetchPurchases(), [])
  const transactions = useApi(() => fetchWalletTransactions(), [])
  const [gross, setGross] = useState('')
  const [address, setAddress] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const sp = wallet.data?.sp
  const usdt = wallet.data?.usdt
  const earned = Number(sp?.earnedSp ?? 0)

  function reloadAll() {
    wallet.reload()
    withdrawals.reload()
    deposits.reload()
    purchases.reload()
    transactions.reload()
  }

  async function submitWithdrawal(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setNotice('')
    try {
      await createWithdrawal(Number(gross), address)
      setGross('')
      setAddress('')
      reloadAll()
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
      reloadAll()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  async function submitDeposit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setNotice('')
    try {
      await createDeposit(depositAmount)
      setDepositAmount('')
      reloadAll()
    } catch (err) {
      setNotice(err instanceof Error && err.message === 'payments_disabled' ? 'Deposits are disabled until payments are activated.' : err instanceof Error ? err.message : 'Deposit failed')
    } finally {
      setBusy(false)
    }
  }

  const requests = withdrawals.data?.withdrawals ?? []
  const pending = requests.find((r) => ['REQUESTED', 'ON_HOLD', 'APPROVED'].includes(r.status))

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading eyebrow="Balance" title="Wallet" description="Earned SP, Bonus SP, USDT, and transaction history." right={<Badge variant="warning">Payments disabled</Badge>} />

      {wallet.loading ? (
        <Skeleton className="h-28" />
      ) : wallet.error || !wallet.data ? (
        <EmptyState Icon={AlertTriangle} title="Could not load wallet" description={wallet.error} action={<Button size="sm" variant="outline" onClick={wallet.reload}>Retry</Button>} />
      ) : (
        <Card padding="lg" className="border-line">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Earned SP" value={formatNumber(Number(sp?.earnedSp ?? 0))} Icon={Coins} tone="text-gold" hint="potentially withdrawable" />
            <Stat label="Bonus SP" value={formatNumber(Number(sp?.bonusSp ?? 0))} Icon={Gem} tone="text-accent" hint="non-withdrawable" />
            <Stat label="USDT" value={usdt?.balance ?? '0.00'} Icon={DollarSign} tone="text-success" hint="confirmed deposits" />
            <Stat label="Pending withdrawal" value={`${formatNumber(Number(wallet.data.pendingWithdrawalSp))} SP`} hint="locked" />
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Conversion: 1 USDT = 1,000 SP · Minimum withdrawal 3,000 SP (3 USDT) · Flat fee 0.30 USDT.
            Deposits/payouts are disabled; USDT reflects confirmed deposits only (never simulated funds).
          </p>
        </Card>
      )}

      {notice && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{notice}</div>
      )}

      {/* Deposit */}
      <Card padding="md" className="border-line">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-success" />
          <h3 className="text-sm font-bold text-white">Deposit USDT</h3>
          <Badge variant="warning" className="ml-auto">Not activated</Badge>
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Deposits require OxaPay integration and owner approval. No invoice can be created yet.
        </div>
        <form onSubmit={submitDeposit} className="mt-3 flex gap-2">
          <input
            inputMode="decimal"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="Amount in USDT"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm text-white outline-none focus:border-primary"
          />
          <Button type="submit" disabled={busy || !depositAmount}>Create invoice</Button>
        </form>
        {(deposits.data?.deposits ?? []).length > 0 && (
          <Card padding="none" className="mt-3 overflow-hidden border-line">
            {(deposits.data?.deposits ?? []).map((d, i) => (
              <div key={d.id} className={`flex items-center gap-3 px-3 py-2.5 ${i !== 0 ? 'border-t border-line' : ''}`}>
                <span className="flex-1 text-xs text-white">{d.amountUsdt} USDT<span className="text-muted"> · {d.externalId.slice(0, 14)}…</span></span>
                <Badge variant={STATUS_TONE[d.status] ?? 'default'}>{d.status}</Badge>
              </div>
            ))}
          </Card>
        )}
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
          <form onSubmit={submitWithdrawal} className="mt-3 space-y-3">
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
            <Button type="submit" disabled={busy || Number(gross) < MIN_SP || earned < Number(gross) || !address} isLoading={busy}>
              Submit request
            </Button>
          </form>
        )}
      </Card>

      {/* Withdrawal history */}
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

      {/* Purchases */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><ShoppingCart className="h-4 w-4 text-muted" /> CEO purchases</h3>
        {(purchases.data?.purchases ?? []).length === 0 ? (
          <EmptyState Icon={ShoppingCart} title="No purchases yet" description="Purchases are disabled until payments are activated." />
        ) : (
          <Card padding="none" className="overflow-hidden border-line">
            {(purchases.data?.purchases ?? []).map((p, i) => (
              <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 ${i !== 0 ? 'border-t border-line' : ''}`}>
                <span className="flex-1 text-sm text-white">{p.ceoName ?? `CEO #${p.ceoId}`}</span>
                <span className="text-xs text-muted">{p.priceUsd} USDT</span>
                <Badge variant={STATUS_TONE[p.status] ?? 'default'}>{p.status}</Badge>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Transaction history */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><History className="h-4 w-4 text-muted" /> Transaction history</h3>
        {transactions.loading ? <Skeleton className="h-14" /> : (transactions.data ?? []).length === 0 ? (
          <EmptyState Icon={History} title="No activity yet" description="Collect a production cycle to see entries here." action={<Button size="sm" variant="outline" onClick={reloadAll}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>} />
        ) : (
          <Card padding="none" className="overflow-hidden border-line">
            {(transactions.data ?? []).map((t, i) => (
              <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 ${i !== 0 ? 'border-t border-line' : ''}`}>
                <Badge variant={TYPE_TONE[t.type] ?? 'default'}>{t.type}</Badge>
                <span className="flex-1 truncate text-xs text-muted">{t.label}</span>
                <span className={`text-sm font-semibold ${t.type === 'SP' && t.amount.startsWith('-') ? 'text-red-300' : 'text-white'}`}>
                  {t.type === 'SP' && !t.amount.startsWith('-') ? '+' : ''}{formatNumber(Number(t.amount))}{t.type === 'SP' ? '' : t.type === 'DEPOSIT' || t.type === 'PURCHASE' ? ' USDT' : ''}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}

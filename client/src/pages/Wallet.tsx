import { useEffect, useMemo, useState } from 'react'
import { Coins, Gem, DollarSign, ArrowDownToLine, AlertTriangle, ShieldCheck, RefreshCw, Wallet as WalletIcon, History, X, ShoppingCart, Save } from 'lucide-react'
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
  fetchWithdrawals,
  saveWithdrawalWallet
} from '../lib/game'
import { formatNumber, formatDateTime } from '../lib/format'
import { useI18n, type TranslationKey } from '../i18n'

/**
 * Fallback asset/network list. The server sends the authoritative verified
 * allowlist (`deposits.assets`); this is only used while it loads or if the
 * request fails, so the UI never assumes a route the provider may not support.
 */
const FALLBACK_PAIRS: { asset: string; network: string; label: string }[] = [
  { asset: 'USDT', network: 'BSC', label: 'USDT · BNB Smart Chain (BEP20)' },
  { asset: 'USDT', network: 'Tron', label: 'USDT · Tron (TRC20)' },
  { asset: 'USDT', network: 'Ethereum', label: 'USDT · Ethereum (ERC20)' },
  { asset: 'USDT', network: 'Polygon', label: 'USDT · Polygon' },
  { asset: 'USDT', network: 'Solana', label: 'USDT · Solana' },
  { asset: 'USDC', network: 'BSC', label: 'USDC · BNB Smart Chain (BEP20)' },
  { asset: 'USDC', network: 'Ethereum', label: 'USDC · Ethereum (ERC20)' },
  { asset: 'USDC', network: 'Polygon', label: 'USDC · Polygon' },
  { asset: 'USDC', network: 'Solana', label: 'USDC · Solana' },
  { asset: 'BTC', network: 'Bitcoin', label: 'BTC · Bitcoin' },
  { asset: 'ETH', network: 'Ethereum', label: 'ETH · Ethereum' },
  { asset: 'BNB', network: 'BSC', label: 'BNB · BNB Smart Chain' },
  { asset: 'POL', network: 'Polygon', label: 'POL · Polygon' },
  { asset: 'SOL', network: 'Solana', label: 'SOL · Solana' },
  { asset: 'TRX', network: 'Tron', label: 'TRX · Tron' },
  { asset: 'LTC', network: 'Litecoin', label: 'LTC · Litecoin' },
  { asset: 'DOGE', network: 'Dogecoin', label: 'DOGE · Dogecoin' },
  { asset: 'BCH', network: 'BitcoinCash', label: 'BCH · Bitcoin Cash' },
  { asset: 'XRP', network: 'xrpl', label: 'XRP · XRP Ledger' },
  { asset: 'GRAM', network: 'The Open Network', label: 'GRAM · TON' }
]

const PAIR_LABEL = new Map(FALLBACK_PAIRS.map((p) => [`${p.asset}/${p.network}`, p.label]))

/** Provider invoice states mapped to translation keys (never "credited"). */
const PROVIDER_STATUS_KEY: Record<string, TranslationKey> = {
  new: 'wallet.deposit.awaiting',
  waiting: 'wallet.deposit.awaiting',
  paying: 'wallet.deposit.detected',
  confirmed: 'wallet.deposit.confirming',
  paid: 'wallet.deposit.paid',
  manual_accept: 'wallet.deposit.manualReview',
  underpaid: 'wallet.deposit.underpaid',
  expired: 'wallet.deposit.expired',
  refunding: 'wallet.deposit.refunding',
  refunded: 'wallet.deposit.refunded'
}

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
  const { t } = useI18n()
  const wallet = useApi(() => fetchWallet(), [])
  const withdrawals = useApi(() => fetchWithdrawals(), [])
  const deposits = useApi(() => fetchDeposits(), [])
  const purchases = useApi(() => fetchPurchases(), [])
  const transactions = useApi(() => fetchWalletTransactions(), [])
  const [gross, setGross] = useState('')
  const [address, setAddress] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [pairIndex, setPairIndex] = useState(0)
  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [walletInput, setWalletInput] = useState('')
  const [walletBusy, setWalletBusy] = useState(false)
  const [walletNotice, setWalletNotice] = useState('')

  const sp = wallet.data?.sp
  const usdt = wallet.data?.usdt
  const earned = Number(sp?.earnedSp ?? 0)
  const savedWallet = withdrawals.data?.wallet
  const payoutsEnabled = withdrawals.data?.payoutsEnabled ?? false

  // Server-authoritative policy (never hardcode fee/minimum in the client).
  const policy = withdrawals.data?.policy
  const minGross = Number(policy?.minGrossSp ?? 1000)
  const feeUsdt = Number(policy?.feeUsdt ?? 0.25)
  const providerFeeUsdt = policy?.providerFeeUsdt ?? '0.25'
  const minDepositUsdt = deposits.data?.minDepositUsdt ?? '0.01'
  const depositAccess = deposits.data?.depositAccess ?? 'disabled'

  const pairs = useMemo<{ asset: string; network: string; label: string }[]>(() => {
    const assets = deposits.data?.assets ?? []
    if (assets.length === 0) return FALLBACK_PAIRS
    return assets.map((a) => ({
      asset: a.asset,
      network: a.network,
      label: PAIR_LABEL.get(`${a.asset}/${a.network}`) ?? `${a.asset} · ${a.networkName}`,
    }))
  }, [deposits.data?.assets])
  const activePair = pairs[Math.min(pairIndex, pairs.length - 1)] ?? pairs[0]

  useEffect(() => {
    if (savedWallet?.address) setAddress((a) => a || savedWallet.address!)
  }, [savedWallet?.address])

  async function submitWallet(e: React.FormEvent) {
    e.preventDefault()
    setWalletBusy(true)
    setWalletNotice('')
    try {
      await saveWithdrawalWallet(walletInput.trim())
      setWalletNotice(t('wallet.wallet.savedNotice'))
      setWalletInput('')
      reloadAll()
    } catch (err) {
      setWalletNotice(err instanceof Error ? err.message : t('wallet.wallet.saveFailed'))
    } finally {
      setWalletBusy(false)
    }
  }

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
      const msg = err instanceof Error ? err.message : t('wallet.withdraw.requestFailed')
      setNotice(
        msg === 'withdrawals_unavailable' || msg === 'payments_disabled'
          ? t('wallet.withdraw.notOpenNotice')
          : msg === 'payout_fee_semantics_unverified'
            ? t('wallet.withdraw.feeUnverified')
            : msg,
      )
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
    setInvoiceUrl('')
    try {
      const pair = activePair
      const dep = await createDeposit({ amountUsdt: depositAmount, asset: pair.asset, network: pair.network })
      setDepositAmount('')
      if (dep.payUrl) {
        setInvoiceUrl(dep.payUrl)
        window.open(dep.payUrl, '_blank', 'noopener,noreferrer')
      }
      const expiry = dep.expiresAt ? t('wallet.deposit.expires', { date: formatDateTime(dep.expiresAt) }) : ''
      setNotice(t('wallet.deposit.ready', { amount: dep.amountUsdt, expiry }))
      reloadAll()
    } catch (err) {
      setNotice(
        err instanceof Error && err.message === 'asset_not_accepted'
          ? t('wallet.deposit.unsupportedAsset')
          : err instanceof Error && err.message === 'unsupported_pair'
            ? t('wallet.deposit.unsupportedPair')
            : err instanceof Error && err.message === 'payments_disabled'
              ? t('wallet.deposit.notOpen')
              : err instanceof Error
                ? err.message
                : t('wallet.deposit.failed'),
      )
    } finally {
      setBusy(false)
    }
  }

  const requests = withdrawals.data?.withdrawals ?? []
  const pending = requests.find((r) => ['REQUESTED', 'ON_HOLD', 'APPROVED'].includes(r.status))

  const providerStatusLabel = (code: string | null | undefined): string | undefined =>
    code ? t(PROVIDER_STATUS_KEY[code] ?? 'wallet.deposit.awaiting') : undefined

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading eyebrow={t('wallet.eyebrow')} title={t('wallet.title')} description={t('wallet.description')} right={<Badge variant={wallet.data?.paymentsEnabled ? 'success' : 'warning'}>{wallet.data?.paymentsEnabled ? t('wallet.depositsLive') : t('wallet.paymentsUnavailable')}</Badge>} />

      {wallet.loading ? (
        <Skeleton className="h-28" />
      ) : wallet.error || !wallet.data ? (
        <EmptyState Icon={AlertTriangle} title={t('wallet.error')} description={wallet.error} action={<Button size="sm" variant="outline" onClick={wallet.reload}>{t('common.retry')}</Button>} />
      ) : (
        <Card padding="lg" className="border-line">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={t('dashboard.earnedSp')} value={formatNumber(Number(sp?.earnedSp ?? 0))} Icon={Coins} tone="text-gold" hint={t('stat.potentiallyWithdrawable')} />
            <Stat label={t('dashboard.bonusSp')} value={formatNumber(Number(sp?.bonusSp ?? 0))} Icon={Gem} tone="text-accent" hint={t('stat.nonWithdrawable')} />
            <Stat label={t('wallet.usdt')} value={usdt?.balance ?? '0.00'} Icon={DollarSign} tone="text-success" hint={t('stat.confirmedDeposits')} />
            <Stat label={t('stat.pendingWithdrawal')} value={`${formatNumber(Number(wallet.data.pendingWithdrawalSp))} SP`} hint={t('stat.locked')} />
          </div>
          <p className="mt-3 text-[11px] text-muted">
            {t('wallet.conversion')}
            {withdrawals.data?.payoutsEnabled ? t('wallet.withdrawalsReviewed') : t('wallet.withdrawalsDisabled')}
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
          <h3 className="text-sm font-bold text-white">{t('wallet.deposit.title')}</h3>
          <Badge variant={wallet.data?.paymentsEnabled ? 'success' : 'warning'} className="ms-auto">
            {wallet.data?.paymentsEnabled ? t('wallet.deposit.live') : t('wallet.deposit.unavailable')}
          </Badge>
        </div>
        <p className="mt-2 text-[11px] text-muted">{t('wallet.deposit.body')}</p>
        {!wallet.data?.paymentsEnabled || depositAccess === 'disabled' ? (
          <div className="mt-3 rounded-xl border border-line bg-surface-2/50 p-3 text-[11px] text-muted">
            <p className="font-semibold text-white">{t('wallet.deposit.notAvailableTitle')}</p>
            <p className="mt-1">{t('wallet.deposit.notAvailableBody')}</p>
          </div>
        ) : (
          <>
            <form onSubmit={submitDeposit} className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-muted">
                  {t('wallet.deposit.amount')}
                  <input
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder={t('wallet.deposit.amountPlaceholder')}
                    className="mt-1 w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                  />
                  <span className="mt-1 block text-[10px] text-muted">{t('wallet.deposit.minimum', { min: minDepositUsdt })}</span>
                </label>
                <label className="block text-xs text-muted">
                  {t('wallet.deposit.assetNetwork')}
                  <select
                    value={pairIndex}
                    onChange={(e) => setPairIndex(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                  >
                    {pairs.map((p, i) => (
                      <option key={`${p.asset}-${p.network}`} value={i}>{p.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Button type="submit" disabled={busy || !depositAmount} isLoading={busy}>{t('wallet.deposit.continue')}</Button>
            </form>
            {invoiceUrl && (
              <a href={invoiceUrl} target="_blank" rel="noreferrer" className="mt-3 block truncate rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-xs text-success underline">
                {t('wallet.deposit.openInvoice')}
              </a>
            )}
          </>
        )}
        {(deposits.data?.deposits ?? []).length > 0 && (
          <Card padding="none" className="mt-3 overflow-hidden border-line">
            {(deposits.data?.deposits ?? []).map((d, i) => {
              const providerLabel = providerStatusLabel(d.lastProviderStatus)
              return (
                <div key={d.id} className={`flex items-center gap-3 px-3 py-2.5 ${i !== 0 ? 'border-t border-line' : ''}`}>
                  <span className="min-w-0 flex-1 text-xs text-white">
                    <span className="block">
                      {d.amountUsdt} USDT
                      {d.expectedAsset ? (
                        <span className="text-muted"> · {d.expectedAsset}{d.expectedNetwork ? `/${d.expectedNetwork}` : ''}</span>
                      ) : null}
                    </span>
                    {(providerLabel || (d.status === 'CREATED' && d.expiresAt)) && (
                      <span className="block text-[10px] text-muted">
                        {providerLabel}
                        {providerLabel && d.status === 'CREATED' && d.expiresAt ? ' · ' : ''}
                        {d.status === 'CREATED' && d.expiresAt ? t('wallet.deposit.expiresLabel', { date: formatDateTime(d.expiresAt) }) : ''}
                      </span>
                    )}
                  </span>
                  <Badge variant={STATUS_TONE[d.status] ?? 'default'}>{t((`status.${d.status}`) as TranslationKey)}</Badge>
                </div>
              )
            })}
          </Card>
        )}
      </Card>

      {/* Withdrawal wallet */}
      <Card padding="md" className="border-line">
        <div className="flex items-center gap-2">
          <WalletIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-ink">{t('wallet.wallet.title')}</h3>
          {savedWallet?.holdActive ? (
            <Badge variant="warning" className="ms-auto">{t('wallet.wallet.securityHold')}</Badge>
          ) : savedWallet?.address ? (
            <Badge variant="success" className="ms-auto">{t('wallet.wallet.saved')}</Badge>
          ) : (
            <Badge variant="default" className="ms-auto">{t('wallet.wallet.notSet')}</Badge>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          {savedWallet?.address ? (
            <>{t('wallet.wallet.savedAddress')} <span className="font-mono text-ink" dir="ltr">{savedWallet.address}</span></>
          ) : (
            t('wallet.wallet.savePrompt')
          )}
          {savedWallet?.holdActive && savedWallet.holdUntil
            ? t('wallet.wallet.holdUntil', { date: formatDateTime(savedWallet.holdUntil) })
            : ''}
        </p>
        <form onSubmit={submitWallet} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            placeholder={t('wallet.wallet.placeholder')}
            aria-label={t('wallet.wallet.addressLabel')}
            dir="ltr"
            className="flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 font-mono text-xs text-ink placeholder-muted outline-none focus:border-primary"
          />
          <Button type="submit" size="sm" disabled={walletBusy || !walletInput.trim()} isLoading={walletBusy} iconLeft={<Save className="h-4 w-4" />}>
            {savedWallet?.address ? t('wallet.wallet.change') : t('wallet.wallet.save')}
          </Button>
        </form>
        {walletNotice && <p className="mt-2 text-[11px] text-amber-300">{walletNotice}</p>}
      </Card>

      {/* Withdrawal request */}
      <Card padding="md" className="border-line">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-white">{t('wallet.withdraw.title')}</h3>
          {payoutsEnabled ? (
            <Badge variant="success" className="ms-auto">{t('wallet.withdraw.open')}</Badge>
          ) : (
            <Badge variant="warning" className="ms-auto">{t('wallet.withdraw.openingSoon')}</Badge>
          )}
        </div>
        {payoutsEnabled && !pending && (
          <p className="mt-2 text-[11px] text-muted">{t('wallet.withdraw.reviewNote')}</p>
        )}

        {pending ? (
          <div className="mt-3 rounded-xl border border-line bg-surface-2/50 p-3">
            <p className="text-xs text-muted">{t('wallet.withdraw.pendingExists')}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={STATUS_TONE[pending.status] ?? 'default'}>{t((`status.${pending.status}`) as TranslationKey)}</Badge>
              <span className="text-xs text-white">{formatNumber(pending.grossSp)} SP → {pending.netUsdt} USDT</span>
              <Button size="sm" variant="ghost" className="ms-auto" onClick={() => cancel(pending.id)} disabled={busy} iconLeft={<X className="h-3.5 w-3.5" />}>{t('common.cancel')}</Button>
            </div>
          </div>
        ) : payoutsEnabled ? (
          <form onSubmit={submitWithdrawal} className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-muted">
                {t('wallet.withdraw.gross')}
                <input
                  inputMode="numeric"
                  value={gross}
                  onChange={(e) => setGross(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={String(minGross)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                />
              </label>
              <label className="block text-xs text-muted">
                {t('wallet.withdraw.addressLabel')}
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x…"
                  dir="ltr"
                  className="mt-1 w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                />
              </label>
            </div>
            {gross && Number(gross) >= minGross && (
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-surface-2/40 p-2 text-center text-[11px]">
                <div>
                  <div className="text-muted">{t('wallet.withdraw.grossLabel')}</div>
                  <div className="font-semibold text-white">{(Number(gross) / 1000).toFixed(2)} USDT</div>
                </div>
                <div>
                  <div className="text-muted">{t('wallet.withdraw.feeLabel')}</div>
                  <div className="font-semibold text-white">{feeUsdt.toFixed(2)} USDT</div>
                </div>
                <div>
                  <div className="text-muted">{t('wallet.withdraw.receiveLabel')}</div>
                  <div className="font-semibold text-success">{(Number(gross) / 1000 - feeUsdt).toFixed(2)} USDT</div>
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted">
              {t('wallet.withdraw.rules', { min: formatNumber(minGross), minUsdt: (minGross / 1000).toFixed(2), fee: feeUsdt.toFixed(2), providerFee: providerFeeUsdt })}
            </p>
            <Button type="submit" disabled={busy || Number(gross) < minGross || earned < Number(gross) || !address} isLoading={busy}>
              {t('wallet.withdraw.submit')}
            </Button>
          </form>
        ) : (
          <div className="mt-3 rounded-xl border border-line bg-surface-2/50 p-3 text-[11px] text-muted">
            <p className="font-semibold text-white">{t('wallet.withdraw.notOpenTitle')}</p>
            <p className="mt-1">{t('wallet.withdraw.notOpenBody')}</p>
          </div>
        )}
      </Card>

      {/* Withdrawal history */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><WalletIcon className="h-4 w-4 text-muted" /> {t('wallet.withdraw.historyTitle')}</h3>
        {withdrawals.loading ? <Skeleton className="h-14" /> : requests.length === 0 ? (
          <EmptyState Icon={ShieldCheck} title={t('wallet.withdraw.empty.title')} description={t('wallet.withdraw.empty.body')} />
        ) : (
          <Card padding="none" className="overflow-hidden border-line">
            {requests.map((r, i) => (
              <div key={r.id} className={`flex items-center gap-3 px-3 py-3 ${i !== 0 ? 'border-t border-line' : ''}`}>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{formatNumber(r.grossSp)} SP → {r.netUsdt} USDT</p>
                  <p className="text-[10px] text-muted" dir="ltr">{r.network} · {r.address.slice(0, 10)}…{r.address.slice(-6)}</p>
                  {r.paidAt && (
                    <p className="text-[10px] text-success">
                      {t('wallet.withdraw.paidAt', { date: formatDateTime(r.paidAt) })}{r.payoutTrackId ? ` · ${r.payoutTrackId}` : ''}
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_TONE[r.status] ?? 'default'}>{t((`status.${r.status}`) as TranslationKey)}</Badge>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Purchases */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><ShoppingCart className="h-4 w-4 text-muted" /> {t('wallet.purchases.title')}</h3>
        {(purchases.data?.purchases ?? []).length === 0 ? (
          <EmptyState Icon={ShoppingCart} title={t('wallet.purchases.empty.title')} description={t('wallet.purchases.empty.body')} />
        ) : (
          <Card padding="none" className="overflow-hidden border-line">
            {(purchases.data?.purchases ?? []).map((p, i) => (
              <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 ${i !== 0 ? 'border-t border-line' : ''}`}>
                <span className="flex-1 text-sm text-white">{p.ceoName ?? `CEO #${p.ceoId}`}</span>
                <span className="text-xs text-muted">{p.priceUsd} USDT</span>
                <Badge variant={STATUS_TONE[p.status] ?? 'default'}>{t((`status.${p.status}`) as TranslationKey)}</Badge>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Transaction history */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><History className="h-4 w-4 text-muted" /> {t('wallet.tx.title')}</h3>
        {transactions.loading ? <Skeleton className="h-14" /> : (transactions.data ?? []).length === 0 ? (
          <EmptyState Icon={History} title={t('wallet.tx.empty.title')} description={t('wallet.tx.empty.body')} action={<Button size="sm" variant="outline" onClick={reloadAll}><RefreshCw className="me-2 h-4 w-4" />{t('common.refresh')}</Button>} />
        ) : (
          <Card padding="none" className="overflow-hidden border-line">
            {(transactions.data ?? []).map((tx, i) => (
              <div key={tx.id} className={`flex items-center gap-3 px-3 py-2.5 ${i !== 0 ? 'border-t border-line' : ''}`}>
                <Badge variant={TYPE_TONE[tx.type] ?? 'default'}>{t((`status.${tx.type}`) as TranslationKey)}</Badge>
                <span className="flex-1 truncate text-xs text-muted">{tx.label}</span>
                <span className={`text-sm font-semibold ${tx.type === 'SP' && tx.amount.startsWith('-') ? 'text-red-300' : 'text-white'}`}>
                  {tx.type === 'SP' && !tx.amount.startsWith('-') ? '+' : ''}{formatNumber(Number(tx.amount))}{tx.type === 'SP' ? '' : tx.type === 'DEPOSIT' || tx.type === 'PURCHASE' ? ' USDT' : ''}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}

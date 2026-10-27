import { useState } from 'react'
import { LogOut, Coins, Gem, Star, Trophy, Wallet as WalletIcon, Copy, Check, Users, AlertTriangle } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress, Stat, SectionHeading } from '../components/ui/kit'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../lib/useApi'
import { useResources } from '../lib/resources'
import { fetchReferrals } from '../lib/game'
import { formatNumber } from '../lib/format'
import { Link } from '../components/router'
import LanguageSelector from '../components/LanguageSelector'
import { useT } from '../i18n'

export default function Profile() {
  const { user, logout } = useAuth()
  const t = useT()
  const resources = useResources()
  const referrals = useApi(() => fetchReferrals(), [])
  const [copied, setCopied] = useState(false)

  const sp = resources.data?.sp
  const progress = resources.data?.progress
  const refLink = user ? `${window.location.origin}/?ref=${user.username}` : ''

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(refLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading eyebrow={t('profile.eyebrow')} title={t('profile.title')} description={t('profile.description')} />

      {/* Account + progression */}
      <Card padding="lg" className="border-line">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xl font-black">
            {(user?.username ?? 'TX').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-white">{user?.username}</h2>
            <p className="truncate text-xs text-muted">{user?.email}</p>
            <div className="mt-1 flex gap-1.5">
              <Badge variant="demo">{user?.role}</Badge>
              <Badge>{progress?.rank ?? t('profile.rarity')}</Badge>
            </div>
          </div>
        </div>

        {progress && (
          <div className="mt-4">
            <Progress value={progress.intoLevel} max={progress.toNext || 1} label={t('profile.levelProgress', { level: progress.level, current: formatNumber(progress.intoLevel), total: formatNumber(progress.toNext) })} />
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label={t('dashboard.earnedSp')} value={sp ? formatNumber(sp.earnedSp) : '—'} Icon={Coins} tone="text-gold" />
          <Stat label={t('dashboard.bonusSp')} value={sp ? formatNumber(sp.bonusSp) : '—'} Icon={Gem} tone="text-accent" />
          <Stat label={t('dashboard.lifetimeXp')} value={progress ? formatNumber(progress.xp) : '—'} Icon={Star} tone="text-primary" />
        </div>
      </Card>

      {/* Language */}
      <Card padding="md" className="border-line">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white">{t('profile.language.title')}</h3>
            <p className="text-[11px] text-muted">{t('profile.language.description')}</p>
          </div>
          <div className="w-44 shrink-0">
            <LanguageSelector />
          </div>
        </div>
      </Card>

      {/* Referrals */}
      <Card padding="md" className="border-line">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-white">{t('profile.referrals.title')}</h3>
          <Badge variant="warning" className="ms-auto">{t('profile.referrals.pendingActivation')}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          {t('profile.referrals.body', {
            bonus: referrals.data?.registrationBonusSp ?? '10',
            percent: referrals.data?.commissionPercent ?? '10'
          })}
        </p>
        <div className="mt-3 flex gap-2">
          <input readOnly value={refLink} className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted" aria-label={t('profile.referrals.linkLabel')} />
          <Button size="sm" variant="outline" onClick={copyLink} iconLeft={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{copied ? t('common.copied') : t('common.copy')}</Button>
        </div>
        <div className="mt-2 flex gap-4 text-[11px] text-muted">
          <span>{t('profile.referrals.invited')} <b className="text-white">{referrals.data?.total ?? 0}</b></span>
          <span>{t('profile.referrals.qualified')} <b className="text-white">{referrals.data?.qualified ?? 0}</b></span>
        </div>
      </Card>

      {/* Community */}
      <Card padding="md" className="flex items-center gap-3 border-line">
        <Users className="h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{t('profile.community.title')}</p>
          <p className="text-[11px] text-muted">{t('profile.community.body')}</p>
        </div>
        <a
          href="https://t.me/tycoonX_official"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-primary/50"
        >
          {t('profile.community.join')}
        </a>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link to="/dashboard/wallet" className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-3 text-sm font-semibold text-white transition-colors hover:border-primary/50">
          <WalletIcon className="h-4 w-4" /> {t('profile.action.wallet')}
        </Link>
        <Link to="/dashboard/leaderboard" className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-3 text-sm font-semibold text-white transition-colors hover:border-primary/50">
          <Trophy className="h-4 w-4" /> {t('profile.action.leaderboard')}
        </Link>
      </div>

      <Card padding="md" className="flex items-center gap-3 border-line">
        <AlertTriangle className="h-4 w-4 text-muted" />
        <p className="flex-1 text-[11px] text-muted">{t('profile.emailNote')}</p>
      </Card>

      <Button variant="danger" className="w-full" onClick={() => { logout(); window.history.pushState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')) }} iconLeft={<LogOut className="h-4 w-4 rtl:rotate-180" />}>
        {t('profile.signOut')}
      </Button>
    </div>
  )
}

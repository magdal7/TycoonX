import { useEffect, useMemo, useState } from 'react'
import { LogOut, Coins, Gem, Star, Trophy, Wallet as WalletIcon, Copy, Check, Award, Users, AlertTriangle } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress, Stat, SectionHeading } from '../components/ui/kit'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../lib/useApi'
import { fetchAchievements, fetchReferrals, fetchResources, setFeaturedBadges } from '../lib/game'
import { formatNumber } from '../lib/format'
import { Link } from '../components/router'

export default function Profile() {
  const { user, logout } = useAuth()
  const resources = useApi(() => fetchResources(), [])
  const referrals = useApi(() => fetchReferrals(), [])
  const achievements = useApi(() => fetchAchievements(), [])
  const [featured, setFeatured] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!achievements.data) return
    const achieved = achievements.data.flatMap((t) =>
      t.stages.filter((s) => s.achieved).map((s) => `${t.key}:${s.stage}`)
    )
    setFeatured((prev) => (prev.length ? prev : achieved.slice(0, 3)))
  }, [achievements.data])

  const sp = resources.data?.sp
  const progress = resources.data?.progress
  const refLink = user ? `${window.location.origin}/?ref=${user.username}` : ''

  const badgeLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of achievements.data ?? []) for (const s of t.stages) map.set(`${t.key}:${s.stage}`, `${t.title} · ${s.stage}`)
    return map
  }, [achievements.data])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(refLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  async function saveFeatured() {
    setSaving(true)
    try {
      await setFeaturedBadges(featured)
    } finally {
      setSaving(false)
    }
  }

  function toggleBadge(key: string) {
    setFeatured((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : prev.length >= 3 ? prev : [...prev, key]))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading eyebrow="Account" title="Profile" description="Your empire, progression, and referral link." />

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
              <Badge>{progress?.rank ?? 'Rookie'}</Badge>
            </div>
          </div>
        </div>

        {progress && (
          <div className="mt-4">
            <Progress value={progress.intoLevel} max={progress.toNext || 1} label={`Level ${progress.level} · ${formatNumber(progress.intoLevel)} / ${formatNumber(progress.toNext)} XP`} />
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Earned SP" value={sp ? formatNumber(sp.earnedSp) : '—'} Icon={Coins} tone="text-gold" />
          <Stat label="Bonus SP" value={sp ? formatNumber(sp.bonusSp) : '—'} Icon={Gem} tone="text-accent" />
          <Stat label="Lifetime XP" value={progress ? formatNumber(progress.xp) : '—'} Icon={Star} tone="text-primary" />
        </div>
      </Card>

      {/* Referrals */}
      <Card padding="md" className="border-line">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-white">Referrals</h3>
          <Badge variant="warning" className="ml-auto">Rewards pending approval</Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          Invite friends. Qualified referrals may earn {referrals.data?.registrationBonusSp ?? '10'} Bonus SP and
          {' '}{referrals.data?.commissionPercent ?? '10'}% commission once qualification is approved — rewards are not active yet.
        </p>
        <div className="mt-3 flex gap-2">
          <input readOnly value={refLink} className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted" aria-label="Referral link" />
          <Button size="sm" variant="outline" onClick={copyLink} iconLeft={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{copied ? 'Copied' : 'Copy'}</Button>
        </div>
        <div className="mt-2 flex gap-4 text-[11px] text-muted">
          <span>Invited: <b className="text-white">{referrals.data?.total ?? 0}</b></span>
          <span>Qualified: <b className="text-white">{referrals.data?.qualified ?? 0}</b></span>
        </div>
      </Card>

      {/* Featured badges */}
      <Card padding="md" className="border-line">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-gold" />
          <h3 className="text-sm font-bold text-white">Featured badges</h3>
          <span className="ml-auto text-[10px] text-muted">{featured.length}/3</span>
        </div>
        {(achievements.data ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-muted">Earn achievements to feature badges on your public profile.</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(achievements.data ?? []).flatMap((t) =>
                t.stages.filter((s) => s.achieved).map((s) => {
                  const key = `${t.key}:${s.stage}`
                  const active = featured.includes(key)
                  return (
                    <button key={key} type="button" onClick={() => toggleBadge(key)} className={`chip transition-colors ${active ? 'border-gold/50 text-gold' : 'hover:text-white'}`}>
                      <Award className="h-3 w-3" /> {s.stage}
                    </button>
                  )
                })
              )}
            </div>
            {badgeLabels.size === 0 && <p className="mt-2 text-xs text-muted">No achieved stages yet.</p>}
            <Button size="sm" className="mt-3" onClick={saveFeatured} isLoading={saving}>Save featured badges</Button>
          </>
        )}
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link to="/dashboard/wallet" className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-3 text-sm font-semibold text-white transition-colors hover:border-primary/50">
          <WalletIcon className="h-4 w-4" /> Wallet
        </Link>
        <Link to="/dashboard/leaderboard" className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-3 text-sm font-semibold text-white transition-colors hover:border-primary/50">
          <Trophy className="h-4 w-4" /> Leaderboard
        </Link>
      </div>

      <Card padding="md" className="flex items-center gap-3 border-line">
        <AlertTriangle className="h-4 w-4 text-muted" />
        <p className="flex-1 text-[11px] text-muted">Email verification and password recovery are deferred for the MVP.</p>
      </Card>

      <Button variant="danger" className="w-full" onClick={() => { logout(); window.history.pushState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')) }} iconLeft={<LogOut className="h-4 w-4" />}>
        Sign out
      </Button>
    </div>
  )
}

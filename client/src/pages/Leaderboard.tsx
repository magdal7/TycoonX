import { useState } from 'react'
import { Trophy, Medal, AlertTriangle, RefreshCw, X, Award } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { SectionHeading, EmptyState, Skeleton } from '../components/ui/kit'
import { useApi } from '../lib/useApi'
import { fetchLeaderboard, fetchMyRank, fetchPublicProfile, type LeaderboardEntry, type PublicProfile } from '../lib/game'
import { formatNumber } from '../lib/format'

function rankMedal(rank: number) {
  if (rank === 1) return 'text-gold'
  if (rank === 2) return 'text-slate-300'
  if (rank === 3) return 'text-amber-600'
  return 'text-muted'
}

export default function Leaderboard() {
  const board = useApi(() => fetchLeaderboard(), [])
  const me = useApi(() => fetchMyRank(), [])
  const [selected, setSelected] = useState<PublicProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  async function openProfile(username: string) {
    setLoadingProfile(true)
    try {
      setSelected(await fetchPublicProfile(username))
    } catch {
      /* ignore */
    } finally {
      setLoadingProfile(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Hall of Fame"
        title="Global Leaderboard"
        description="Ranked by lifetime XP. One permanent board — no resets."
        right={me.data?.rank ? <Badge variant="demo">Your rank #{me.data.rank}</Badge> : undefined}
      />

      {board.loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : board.error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load the leaderboard" description={board.error} action={<Button size="sm" variant="outline" onClick={board.reload}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>} />
      ) : (board.data ?? []).length === 0 ? (
        <EmptyState Icon={Trophy} title="No rankings yet" description="Be the first to earn XP and claim the top spot." />
      ) : (
        <Card padding="none" className="overflow-hidden border-line">
          {(board.data ?? []).map((e: LeaderboardEntry, i) => (
            <button
              key={e.userId}
              type="button"
              onClick={() => openProfile(e.username)}
              className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/5 ${i !== 0 ? 'border-t border-line' : ''} ${e.rank === 1 ? 'bg-gold/5' : e.rank <= 3 ? 'bg-primary/5' : ''}`}
            >
              <span className={`w-7 shrink-0 text-center text-sm font-black ${rankMedal(e.rank)}`}>{e.rank}</span>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-xs font-bold">
                {e.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{e.username}</p>
                <p className="text-[11px] text-muted">{e.rankName} · Level {e.level}{e.primaryBadge ? ` · ${e.primaryBadge}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">{formatNumber(e.xp)}</p>
                <p className="text-[10px] uppercase text-muted">XP</p>
              </div>
              {e.rank <= 3 && <Medal className={`h-4 w-4 ${rankMedal(e.rank)}`} />}
            </button>
          ))}
        </Card>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={() => setSelected(null)}>
          <Card className="w-full max-w-sm animate-slide-up border-line" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-muted">Public profile</span>
              <button type="button" onClick={() => setSelected(null)} className="text-muted hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-lg font-black">
                {selected.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{selected.username}</h3>
                <p className="text-xs text-muted">{selected.rankName} · Level {selected.level}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3 text-center">
              <p className="text-2xl font-black text-primary">{formatNumber(selected.xp)}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted">Lifetime XP</p>
            </div>
            {selected.featured.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selected.featured.map((b) => (
                  <span key={b} className="chip border-gold/40 text-gold"><Award className="h-3 w-3" /> {b}</span>
                ))}
              </div>
            )}
            <p className="mt-4 text-[10px] text-muted">No email, balances, deposits, withdrawals, or referral data are shown publicly.</p>
          </Card>
        </div>
      )}

      {loadingProfile && <p className="text-center text-xs text-muted">Loading profile…</p>}
    </div>
  )
}

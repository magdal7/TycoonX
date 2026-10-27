import { useEffect, useMemo, useState } from 'react'
import {
  Rocket,
  Coins,
  Trophy,
  ShieldCheck,
  ChevronRight,
  Play,
  Download,
  Clock,
  Sparkles,
  Star,
  Users,
  Building2,
  Zap,
  Lock,
  Cpu,
  Send,
  Compass,
  Gauge
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Logo } from '../components/Logo'
import { CeoAvatar } from '../components/CeoAvatar'
import { formatNumber, formatUsd } from '../lib/format'
import { fetchPublicCeos, type PublicCeo } from '../lib/ceos'
import { usePublicSettings, type Capabilities } from '../lib/siteSettings'

type Props = { navigate: (p: string) => void; authed: boolean }

const STEPS = [
  { Icon: Users, title: 'Recruit a CEO', text: 'Start free with an Intern CEO, then build a collection of technology leaders.' },
  { Icon: Play, title: 'Start production', text: 'Run manual production cycles with 4h, 6h or 8h equipment.' },
  { Icon: Download, title: 'Collect SP', text: 'Return to collect Earned SP before each copy’s finite lifetime cap runs out.' },
  { Icon: Trophy, title: 'Level up', text: 'Earn XP from missions and achievements and climb the global leaderboard.' }
]

const EARNING_PATHS = [
  {
    Icon: Cpu,
    title: 'CEO Production',
    text: 'Recruit or purchase CEOs, manually start production cycles (4h · 6h · 8h), then collect Earned SP. Every copy has a finite lifetime production cap and archives once exhausted; ownership is retained.'
  },
  {
    Icon: Zap,
    title: 'Missions & Campaigns',
    text: 'Complete daily and weekly missions plus special campaigns. Rewards are the configured XP and Bonus SP; some special submissions may require Admin review.'
  },
  {
    Icon: Users,
    title: 'Referrals',
    text: 'Invite friends. When a referred player qualifies through their first eligible CEO purchase you can earn a registration bonus plus a recurring commission on eligible deposit-funded purchases, subject to the approved rules.'
  }
]

const COMMUNITY_URL = 'https://t.me/tycoonX_official'

function capabilityLine(caps: Capabilities | undefined): string {
  if (!caps) return 'Feature availability is shown after you sign in.'
  const out: string[] = []
  out.push(caps.deposits ? 'Deposits are available.' : 'Deposits are not currently available.')
  out.push(caps.payouts ? 'Eligible Earned SP withdrawals are available with Admin approval.' : 'Withdrawals are not currently available.')
  out.push(caps.referralRewards ? 'Referral rewards are active.' : 'Referral rewards are not active yet.')
  return out.join(' ')
}

export default function Landing({ navigate, authed }: Props) {
  const go = () => navigate(authed ? '/dashboard' : '/register')
  const ref = useMemo(() => new URLSearchParams(window.location.search).get('ref'), [])
  const startHref = ref ? `/register?ref=${encodeURIComponent(ref)}` : '/register'

  const caps = usePublicSettings().data?.capabilities

  const [catalog, setCatalog] = useState<PublicCeo[]>([])
  const [catalogError, setCatalogError] = useState(false)
  useEffect(() => {
    let alive = true
    fetchPublicCeos()
      .then((rows) => {
        if (alive) setCatalog(rows.filter((r) => r.isForSale))
      })
      .catch(() => {
        if (alive) setCatalogError(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const faqs = [
    {
      q: 'What is TycoonX?',
      a: 'TycoonX is a mobile-first technology-empire tycoon game. You collect CEOs, run manual production cycles, complete missions and climb the ranks. It is a game, not a financial product, and it is free to start.'
    },
    {
      q: 'How do I start playing?',
      a: 'Create a free account. A starter Intern CEO is provisioned automatically the first time you sign in — start a production cycle in one tap and collect when it completes.'
    },
    { q: 'What do CEOs do?', a: 'Every CEO copy can run manual production cycles (4h, 6h or 8h with equipment). Start a cycle, wait for it to finish, then collect Earned SP. Each copy has a finite lifetime production cap and archives when exhausted; you keep ownership. Nothing restarts automatically.' },
    { q: 'What is the difference between Earned SP and Bonus SP?', a: 'Earned SP is produced by your CEOs and is the only balance that can ever be withdrawn. Bonus SP comes from bonuses such as missions, referrals and confirmed deposits; it is spent first on eligible purchases but is never withdrawable.' },
    { q: 'How do missions and achievements work?', a: 'Daily and weekly missions reset on UTC boundaries and award XP when you claim them. Achievements are permanent, cumulative tracks that award XP per stage. Special campaigns can award XP and/or Bonus SP and may require Admin approval of your proof. Unclaimed rewards persist until you claim them.' },
    { q: 'How does My Empire work?', a: 'My Empire is a visualisation of the CEO copies you actually own — each unit is backed by real ownership and its real production state. Selecting a unit opens its details and the same Start/Collect actions used everywhere else.' },
    {
      q: 'How do referrals work?',
      a: `Share your referral link. A referred player qualifies through their first eligible CEO purchase. ${caps?.referralRewards === true ? 'Referral rewards are currently active.' : caps?.referralRewards === false ? 'Referral rewards are not currently active; qualified activity may be recorded without credit.' : 'Referral reward availability is shown in the app.'}`
    },
    {
      q: 'How do deposits and withdrawals work?',
      a: `You can deposit supported cryptocurrencies through our payment provider when deposits are available; confirmed deposits are credited as Bonus SP at 1 USDT = 1,000 SP. ${capabilityLine(caps)} The minimum withdrawal is 1,000 Earned SP (1 USDT) with a 0.25 USDT player fee, for USDT on BSC/BEP20, subject to Admin approval. No purchase should be made expecting profit.`
    },
    { q: 'Is TycoonX affiliated with any real technology CEOs?', a: 'No. All CEOs are original fictional characters created for gameplay. They are not real people, and nothing here implies endorsement, affiliation or investment by any public figure.' },
    { q: 'Are SP rates guaranteed earnings?', a: 'No. Production is a game mechanic. Nominal SP rates are not investment returns, guaranteed income, or guaranteed payouts.' }
  ]

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-2" aria-label="TycoonX home">
            <Logo size={32} />
          </button>
          <nav className="ml-6 hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#how" className="transition-colors hover:text-ink">How it works</a>
            <a href="#ceos" className="transition-colors hover:text-ink">CEOs</a>
            <a href="#empire" className="transition-colors hover:text-ink">My Empire</a>
            <a href="#economy" className="transition-colors hover:text-ink">Economy</a>
            <a href="#faq" className="transition-colors hover:text-ink">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {authed ? (
              <button onClick={go} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-primary/90">Open Empire</button>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="hidden rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink sm:block">Sign in</button>
                <button onClick={() => navigate(startHref)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-primary/90">Start free</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-gold/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
          <div className="animate-slide-up">
            <span className="chip border-primary/40 text-primary"><Sparkles className="h-3.5 w-3.5" /> Premium technology-empire tycoon</span>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Your Technology Empire <span className="text-gradient">Starts With One Intern.</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-muted">
              Collect CEOs. Power production. Expand your empire. Complete missions, climb the ranks and grow a
              technology company of your own — free to start, no deposit required.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={() => navigate(startHref)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 text-sm font-bold text-bg shadow-glow transition-transform hover:scale-[1.02]">
                <Rocket className="h-4 w-4" /> Start Free — Claim Your Intern
              </button>
              <a href="#how" className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white/5">
                See how it works <ChevronRight className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> Free to start</span>
              <span className="inline-flex items-center gap-1.5"><Coins className="h-4 w-4 text-gold" /> Transparent mechanics</span>
              <span className="inline-flex items-center gap-1.5"><Trophy className="h-4 w-4 text-primary" /> Global XP leaderboard</span>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative animate-fade-in">
            <div className="rounded-3xl border border-line bg-surface/70 p-4 shadow-card backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">Empire overview</span>
                <Badge variant="demo">Illustrative</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(catalog.length ? catalog.slice(0, 3) : []).map((t) => (
                  <div key={t.slug} className="flex flex-col items-center rounded-xl border border-line bg-surface-2/60 p-3">
                    <CeoAvatar name={t.name} slug={t.slug} rarity={t.rarity} size={48} imageUrl={t.imageUrl} />
                    <span className="mt-2 max-w-full truncate text-[11px] font-semibold">{t.name}</span>
                    <span className="text-[10px] text-muted">{t.nominalSpPer24h != null ? `${formatNumber(t.nominalSpPer24h)} SP/24h` : t.rarity}</span>
                  </div>
                ))}
                {catalog.length === 0 &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center rounded-xl border border-line bg-surface-2/40 p-3">
                      <div className="h-12 w-12 rounded-full bg-white/5" />
                      <span className="mt-2 text-[10px] text-muted">Catalog</span>
                    </div>
                  ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-muted">
                <div className="rounded-xl border border-line bg-surface-2/60 p-2"><Play className="mx-auto h-3.5 w-3.5 text-primary" /><div className="mt-1 font-semibold text-ink">Start</div></div>
                <div className="rounded-xl border border-line bg-surface-2/60 p-2"><Clock className="mx-auto h-3.5 w-3.5 text-gold" /><div className="mt-1 font-semibold text-ink">Wait</div></div>
                <div className="rounded-xl border border-line bg-surface-2/60 p-2"><Download className="mx-auto h-3.5 w-3.5 text-success" /><div className="mt-1 font-semibold text-ink">Collect</div></div>
              </div>
              <p className="mt-2 text-[10px] text-muted">Manual cycles — nothing auto-restarts. Illustrative preview.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-line bg-surface-2/30">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">How it works</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted">A simple loop that rewards showing up.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-line bg-surface/60 p-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><s.Icon className="h-5 w-5" /></div>
                <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted">Step {i + 1}</div>
                <h3 className="mt-1 font-bold text-ink">{s.title}</h3>
                <p className="mt-1 text-xs text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earning paths */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">Three ways to earn SP</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted">
            Earned SP comes from CEO production; Bonus SP comes from missions, campaigns and referrals. Bonus SP is
            spendable but never withdrawable.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {EARNING_PATHS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-line bg-surface/60 p-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary"><p.Icon className="h-5 w-5" /></div>
                <h3 className="mt-3 text-lg font-bold text-ink">{p.title}</h3>
                <p className="mt-1 text-sm text-muted">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CEOs */}
      <section id="ceos" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Collectible CEOs</h2>
              <p className="mt-2 max-w-lg text-sm text-muted">
                Eight tiers, each with a finite lifetime production cap. Own as many copies as you like.
              </p>
            </div>
            <Badge variant="demo" className="hidden shrink-0 sm:inline-flex">Live catalog</Badge>
          </div>

          {catalog.length === 0 ? (
            <p className="mt-8 text-sm text-muted">
              {catalogError ? 'The live catalog could not be loaded right now. Sign in to see the current roster.' : 'Loading the current CEO roster…'}
            </p>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {catalog.slice(0, 8).map((t) => (
                <div key={t.slug} className="rounded-2xl border border-line bg-surface/60 p-4 text-center">
                  <div className="flex justify-center"><CeoAvatar name={t.name} slug={t.slug} rarity={t.rarity} size={64} imageUrl={t.imageUrl} /></div>
                  <h3 className="mt-2 truncate text-sm font-bold text-ink">{t.name}</h3>
                  <p className="text-[10px] text-muted">{t.rarity}</p>
                  <p className="mt-1 text-xs font-bold text-ink">{t.priceUsd <= 0 ? 'Free' : formatUsd(t.priceUsd)}</p>
                  <p className="text-[10px] text-gold">{t.nominalSpPer24h != null ? `${formatNumber(t.nominalSpPer24h)} SP/24h` : '—'}</p>
                  <p className="text-[10px] text-muted">cap {t.lifetimeCapSp != null ? `${formatNumber(t.lifetimeCapSp)} SP` : '—'}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-center text-[11px] text-muted">
            Nominal rates, not guaranteed returns. Longer equipment cycles yield proportionally more per collection.
          </p>
        </div>
      </section>

      {/* My Empire */}
      <section id="empire" className="border-t border-line bg-surface-2/30">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:px-6">
          <div>
            <span className="chip border-primary/40 text-primary"><Compass className="h-3.5 w-3.5" /> My Empire</span>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">See your empire come alive</h2>
            <p className="mt-2 text-sm text-muted">
              My Empire is an interactive view of the CEO copies you really own. Each unit reflects real ownership
              and its live production state — idle, producing, ready to collect, or exhausted. Select a unit to open
              its details and use the same Start and Collect actions as the rest of the game.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li className="flex items-start gap-2"><Gauge className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Stable, deterministic placement — your collection, visualised.</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Real ownership only. No fake buildings, no invented production.</li>
              <li className="flex items-start gap-2"><Download className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> A list view is available for smaller screens and accessibility.</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-line bg-surface/60 p-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {['Idle', 'Producing', 'Ready', 'Exhausted', 'Equipment', 'Lifetime cap'].map((label, i) => (
                <div key={label} className="rounded-xl border border-line bg-surface-2/50 p-3 text-center">
                  <div className={`mx-auto h-8 w-8 rounded-lg ${['bg-line', 'bg-primary/30', 'bg-success/40', 'bg-warning/30', 'bg-gold/30', 'bg-primary/15'][i]}`} />
                  <p className="mt-2 text-[10px] font-semibold text-ink">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-muted">States shown reflect your real owned copies after sign-in.</p>
          </div>
        </div>
      </section>

      {/* Progression */}
      <section id="progress" className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2 md:px-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Progression that keeps you coming back</h2>
            <p className="mt-2 text-sm text-muted">Earn XP from daily and weekly missions and permanent achievements. Advance through six ranks from Rookie to Empire Legend.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Rookie', 'Entrepreneur', 'Founder', 'Executive', 'Tycoon', 'Empire Legend'].map((r) => (
                <span key={r} className="chip"><Star className="h-3 w-3 text-primary" /> {r}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface/60 p-4"><Trophy className="h-5 w-5 text-primary" /><h3 className="mt-2 font-bold text-ink">Global leaderboard</h3><p className="text-xs text-muted">One permanent ranking by lifetime XP.</p></div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4"><Sparkles className="h-5 w-5 text-accent" /><h3 className="mt-2 font-bold text-ink">Achievements</h3><p className="text-xs text-muted">Five tracks, four tiers each, XP rewards.</p></div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4"><Zap className="h-5 w-5 text-gold" /><h3 className="mt-2 font-bold text-ink">Missions</h3><p className="text-xs text-muted">Daily and weekly tasks that reset on UTC boundaries.</p></div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4"><Building2 className="h-5 w-5 text-success" /><h3 className="mt-2 font-bold text-ink">Tech Empire</h3><p className="text-xs text-muted">Buildings and projects are planned for a future update.</p></div>
          </div>
        </div>
      </section>

      {/* Economy + trust */}
      <section id="economy" className="border-t border-line bg-surface-2/30">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-6">
          <ShieldCheck className="mx-auto h-8 w-8 text-success" />
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">A real economy, explained honestly</h2>
          <p className="mt-3 text-sm text-muted">
            CEO purchases and production are game mechanics with defined rules — not ownership in real companies or
            financial assets. Production is manual, every copy has a finite lifetime cap, and nominal SP rates are
            never presented as guaranteed income.
          </p>
          <p className="mt-3 text-sm text-muted">{capabilityLine(caps)}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs">
            <span className="chip"><Coins className="h-3.5 w-3.5 text-gold" /> 1 USDT = 1,000 SP</span>
            <span className="chip"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Finite lifetime caps</span>
            <span className="chip"><Lock className="h-3.5 w-3.5" /> Bonus SP never withdrawable</span>
          </div>
          <p className="mt-4 text-[11px] text-muted">
            Eligible Earned SP withdrawals: minimum 1,000 SP (1 USDT), 0.25 USDT player fee, USDT on BSC/BEP20,
            subject to Admin approval.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-line">
        <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
          <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">Frequently asked</h2>
          <div className="mt-8 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-line bg-surface/60 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
                  {f.q}
                  <ChevronRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-2 text-xs text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Community */}
      <section id="community" className="border-t border-line bg-surface-2/30">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-6">
          <Users className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Join the community</h2>
          <p className="mt-3 text-sm text-muted">Announcements, events and support in our official Telegram channel.</p>
          <a
            href={COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#229ED9] px-5 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
          >
            <Send className="h-4 w-4" /> Telegram · @tycoonX_official
          </a>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Ready to build your empire?</h2>
          <p className="mt-3 text-sm text-muted">Claim your free Intern CEO and start producing in seconds.</p>
          <button onClick={() => navigate(startHref)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3.5 text-sm font-bold text-bg shadow-glow transition-transform hover:scale-[1.02]">
            <Rocket className="h-4 w-4" /> Start Your Empire — Free
          </button>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted md:flex-row md:px-6">
          <span>© {new Date().getFullYear()} TycoonX. A game — not a financial product.</span>
          <span className="flex items-center gap-3">
            <a href="#faq" className="hover:text-ink">FAQ</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms') }} className="hover:text-ink">Terms</a>
            <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy') }} className="hover:text-ink">Privacy</a>
            <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              <Send className="h-3 w-3" /> Telegram
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}

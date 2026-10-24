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
  Send
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Logo } from '../components/Logo'
import { CeoAvatar } from '../components/CeoAvatar'
import { formatNumber, formatUsd } from '../lib/format'
import { fetchPublicCeos } from '../lib/ceos'

type Props = { navigate: (p: string) => void; authed: boolean }

const TIERS = [
  { name: 'Intern', rarity: 'Common', price: 0, sp: 10, cap: 40 },
  { name: 'CEO 2', rarity: 'Rare', price: 0.99, sp: 100, cap: 1200 },
  { name: 'CEO 3', rarity: 'Rare', price: 4.99, sp: 1000, cap: 6500 },
  { name: 'CEO 4', rarity: 'Epic', price: 19.99, sp: 5000, cap: 28000 },
  { name: 'CEO 5', rarity: 'Epic', price: 49.99, sp: 10000, cap: 75000 },
  { name: 'CEO 6', rarity: 'Legendary', price: 99.99, sp: 25000, cap: 160000 }
]

const STEPS = [
  { Icon: Users, title: 'Recruit a CEO', text: 'Start free with an Intern CEO and grow a collection of executives.' },
  { Icon: Play, title: 'Start production', text: 'Run manual production cycles with 4h, 6h, or 8h equipment.' },
  { Icon: Download, title: 'Collect SP', text: 'Return to collect Earned SP before the cycle’s lifetime cap runs out.' },
  { Icon: Trophy, title: 'Level up', text: 'Earn XP from missions and achievements, climb the global leaderboard.' }
]

const EARNING_PATHS = [
  {
    Icon: Cpu,
    title: 'CEO Production',
    text: 'Recruit or purchase CEOs, manually start production cycles (4h · 6h · 8h), then collect Earned SP. Every copy has a finite lifetime production cap.'
  },
  {
    Icon: Zap,
    title: 'Missions & Tasks',
    text: 'Complete eligible daily and weekly missions plus special campaigns. Rewards are the configured XP and Bonus SP; special submissions may require Admin approval.'
  },
  {
    Icon: Users,
    title: 'Referrals',
    text: 'Invite friends: earn 10 Bonus SP when a referral qualifies through their first eligible CEO purchase, plus 10% Bonus SP commission on qualifying deposit-funded purchases (when referral rewards are enabled).'
  }
]

const COMMUNITY_URL = 'https://t.me/tycoonX_official'

type ShowCeo = { name: string; slug: string; rarity: string; priceUsd: number; sp24h: number; capSp: number }
const FALLBACK_CEOS: ShowCeo[] = TIERS.map((t) => ({
  name: t.name,
  slug: t.name,
  rarity: t.rarity,
  priceUsd: t.price,
  sp24h: t.sp,
  capSp: t.cap
}))

const FAQS = [
  {
    q: 'What is TycoonX?',
    a: 'TycoonX is a mobile-first tech-tycoon game. You build a company by recruiting collectible CEOs, running production cycles and completing missions. It is free to start.'
  },
  {
    q: 'How do I start playing?',
    a: 'Create a free account. A starter CEO is granted automatically the first time you sign in — start a production cycle in one tap and collect SP when it completes.'
  },
  {
    q: 'What do CEOs do?',
    a: 'Each CEO copy you own can run manual production cycles (4h, 6h or 8h with equipment). Start a cycle, wait for it to finish, then collect Earned SP. Every copy has a finite lifetime production cap and archives once exhausted; you keep ownership.'
  },
  {
    q: 'What is the difference between Earned SP and Bonus SP?',
    a: 'Earned SP is produced by your CEOs and is the only balance that can ever be withdrawn. Bonus SP comes from bonuses such as missions, referrals and confirmed deposits; it is spent first on eligible purchases but is never withdrawable.'
  },
  {
    q: 'How do missions and tasks work?',
    a: 'Daily and weekly missions reset on UTC boundaries and award XP when you claim them. Special campaigns can award XP and/or Bonus SP and may require Admin approval of your proof. Unclaimed rewards persist until you claim them.'
  },
  {
    q: 'How do referrals work?',
    a: 'Share your referral link. When a referred user makes their first eligible CEO purchase they qualify — earning you 10 Bonus SP — and you accrue a 10% Bonus SP commission on the deposit-funded portion of their later eligible purchases. Referral rewards are implemented but currently pending activation.'
  },
  {
    q: 'How do deposits work, and can I withdraw?',
    a: 'You can deposit supported cryptocurrencies through our payment provider; confirmed deposits are credited as Bonus SP at 1 USDT = 1,000 SP. Withdrawals of eligible Earned SP are not open yet — a request cannot be submitted until they are enabled — and Bonus SP can never be withdrawn.'
  },
  {
    q: 'Is TycoonX affiliated with any real technology CEOs?',
    a: 'No. All CEOs are original fictional characters created for gameplay. They are not real people, and nothing here implies endorsement, affiliation or investment by any public figure.'
  },
  {
    q: 'Are SP rates guaranteed earnings?',
    a: 'No. Production is a game mechanic. Nominal SP rates are not investment returns or guaranteed payouts.'
  }
]

export default function Landing({ navigate, authed }: Props) {
  const go = () => navigate(authed ? '/dashboard' : '/register')
  const ref = useMemo(() => new URLSearchParams(window.location.search).get('ref'), [])
  const startHref = ref ? `/register?ref=${encodeURIComponent(ref)}` : '/register'

  const [catalog, setCatalog] = useState<ShowCeo[]>([])
  useEffect(() => {
    let alive = true
    fetchPublicCeos()
      .then((rows) => {
        if (!alive) return
        const shown = rows
          .filter((r) => r.isForSale)
          .map((r) => ({ name: r.name, slug: r.slug, rarity: r.rarity, priceUsd: r.priceUsd, sp24h: r.nominalSpPer24h ?? 0, capSp: r.lifetimeCapSp ?? 0 }))
        if (shown.length) setCatalog(shown)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const featured = catalog.length ? catalog : FALLBACK_CEOS

  return (
    <div className="min-h-screen bg-bg text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Logo size={32} />
          </div>
          <nav className="ml-6 hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#how" className="transition-colors hover:text-white">How it works</a>
            <a href="#ceos" className="transition-colors hover:text-white">CEOs</a>
            <a href="#progress" className="transition-colors hover:text-white">Progression</a>
            <a href="#community" className="transition-colors hover:text-white">Community</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {authed ? (
              <button onClick={go} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold transition-colors hover:bg-primary/90">Open Empire</button>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="hidden rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-white sm:block">Sign in</button>
                <button onClick={() => navigate(startHref)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold transition-colors hover:bg-primary/90">Start free</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
          <div className="animate-slide-up">
            <span className="chip border-primary/40 text-primary"><Sparkles className="h-3.5 w-3.5" /> Technology empire tycoon</span>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Build your <span className="text-gradient">technology empire</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-muted">
              Recruit collectible CEOs, run production cycles, earn XP, and climb the global ranks.
              Start free with an Intern CEO — no purchase required.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={() => navigate(startHref)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 text-sm font-bold shadow-glow transition-transform hover:scale-[1.02]">
                <Rocket className="h-4 w-4" /> Start Your Empire — Free
              </button>
              <a href="#ceos" className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5">
                Explore CEOs <ChevronRight className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><Coins className="h-4 w-4 text-gold" /> Earn SP from production</span>
              <span className="inline-flex items-center gap-1.5"><Trophy className="h-4 w-4 text-primary" /> Global XP leaderboard</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> Transparent mechanics</span>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative animate-fade-in">
            <div className="rounded-3xl border border-line bg-surface/70 p-4 shadow-card backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">Empire overview</span>
                <Badge variant="demo">Preview</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {featured.slice(0, 3).map((t) => (
                  <div key={t.slug} className="flex flex-col items-center rounded-xl border border-line bg-surface-2/60 p-3">
                    <CeoAvatar name={t.name} slug={t.slug} rarity={t.rarity} size={48} />
                    <span className="mt-2 max-w-full truncate text-[11px] font-semibold">{t.name}</span>
                    <span className="text-[10px] text-muted">{formatNumber(t.sp24h)} SP/24h</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-line bg-surface-2/60 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Production cycle</span>
                  <span className="inline-flex items-center gap-1 text-success"><Clock className="h-3.5 w-3.5" /> 2h 14m left</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-accent" />
                </div>
              </div>
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
                <h3 className="mt-1 font-bold text-white">{s.title}</h3>
                <p className="mt-1 text-xs text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earning paths */}
      <section id="paths" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">Three ways to earn SP</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted">
            Earned SP comes from CEO production; Bonus SP comes from missions and referrals. Bonus SP is spendable
            but never withdrawable.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {EARNING_PATHS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-line bg-surface/60 p-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
                  <p.Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-lg font-bold text-white">{p.title}</h3>
                <p className="mt-1 text-sm text-muted">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CEOs */}
      <section id="ceos" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Collectible CEOs</h2>
              <p className="mt-2 max-w-lg text-sm text-muted">Eight tiers, each with a finite lifetime production cap. Own as many copies as you like.</p>
            </div>
            <Badge variant="demo" className="hidden sm:inline-flex">Approved catalog</Badge>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {featured.slice(0, 6).map((t) => (
              <div key={t.slug} className="rounded-2xl border border-line bg-surface/60 p-4 text-center">
                <div className="flex justify-center"><CeoAvatar name={t.name} slug={t.slug} rarity={t.rarity} size={56} /></div>
                <h3 className="mt-2 truncate text-sm font-bold">{t.name}</h3>
                <p className="text-[10px] text-muted">{t.rarity}</p>
                <p className="mt-1 text-xs font-bold text-white">{t.priceUsd === 0 ? 'Free' : formatUsd(t.priceUsd)}</p>
                <p className="text-[10px] text-gold">{formatNumber(t.sp24h)} SP/24h</p>
                <p className="text-[10px] text-muted">cap {formatNumber(t.capSp)} SP</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[11px] text-muted">Nominal rates, not guaranteed returns. Longer equipment cycles yield proportionally more per collection.</p>
        </div>
      </section>

      {/* Progression */}
      <section id="progress" className="border-t border-line bg-surface-2/30">
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
            <div className="rounded-2xl border border-line bg-surface/60 p-4"><Trophy className="h-5 w-5 text-primary" /><h3 className="mt-2 font-bold">Global leaderboard</h3><p className="text-xs text-muted">One permanent ranking by lifetime XP.</p></div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4"><Sparkles className="h-5 w-5 text-accent" /><h3 className="mt-2 font-bold">Achievements</h3><p className="text-xs text-muted">Five tracks, four tiers each, XP rewards.</p></div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4"><Zap className="h-5 w-5 text-gold" /><h3 className="mt-2 font-bold">Missions</h3><p className="text-xs text-muted">Daily and weekly tasks that reset on UTC boundaries.</p></div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4"><Building2 className="h-5 w-5 text-success" /><h3 className="mt-2 font-bold">Tech Empire</h3><p className="text-xs text-muted">Buildings and projects — coming soon.</p></div>
          </div>
        </div>
      </section>

      {/* Transparency */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-6">
          <ShieldCheck className="mx-auto h-8 w-8 text-success" />
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Transparent by design</h2>
          <p className="mt-3 text-sm text-muted">
            CEO purchases are game products with defined production mechanics — not ownership in real companies or
            financial assets. Production is manual, every copy has a finite lifetime cap, and real-money withdrawals
            are currently disabled. We never present nominal SP rates as guaranteed income.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs">
            <span className="chip"><Lock className="h-3.5 w-3.5" /> Withdrawals disabled</span>
            <span className="chip"><Coins className="h-3.5 w-3.5 text-gold" /> 1 USDT = 1,000 SP</span>
            <span className="chip"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Finite lifetime caps</span>
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

      {/* FAQ */}
      <section id="faq" className="border-t border-line bg-surface-2/30">
        <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
          <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">Frequently asked</h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-line bg-surface/60 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-white">
                  {f.q}
                  <ChevronRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-2 text-xs text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Ready to build your empire?</h2>
          <p className="mt-3 text-sm text-muted">Claim your free Intern CEO and start producing in seconds.</p>
          <button onClick={() => navigate(startHref)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3.5 text-sm font-bold shadow-glow transition-transform hover:scale-[1.02]">
            <Rocket className="h-4 w-4" /> Start Your Empire — Free
          </button>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted md:flex-row md:px-6">
          <span>© {new Date().getFullYear()} TycoonX. A game — not a financial product.</span>
          <span className="flex items-center gap-3">
            <a href="#faq" className="hover:text-white">FAQ</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms') }} className="hover:text-white">Terms</a>
            <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy') }} className="hover:text-white">Privacy</a>
            <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white">
              <Send className="h-3 w-3" /> Telegram
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}

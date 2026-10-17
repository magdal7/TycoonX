import { useMemo } from 'react'
import {
  ArrowRight,
  Play,
  Users,
  Building2,
  Activity,
  Trophy,
  Sparkles,
  Lock,
  ShieldCheck,
  Smartphone,
  Monitor,
  Zap,
  ChevronDown,
  CheckCircle2,
  Rocket,
  Gauge
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { rarityStyle } from '../lib/ceos'

type Props = { navigate: (p: string) => void; authed: boolean }

interface ExecutivePreview {
  name: string
  rarity: string
  role: string
  rate: string
  price: string
}

const EXECUTIVES: ExecutivePreview[] = [
  { name: 'Junior Developer', rarity: 'Common', role: 'Ships the basics', rate: '0.15%', price: '$5' },
  { name: 'Marketing Director', rarity: 'Rare', role: 'Grows your reach', rate: '0.20%', price: '$30' },
  { name: 'AI Architect', rarity: 'Epic', role: 'Automates research', rate: '0.25%', price: '$100' },
  { name: 'Tech Billionaire', rarity: 'Legendary', role: 'Scales everything', rate: '0.30%', price: '$500' }
]

const STEPS = [
  {
    Icon: Users,
    title: 'Discover CEOs',
    desc: 'Browse the executive market by rarity, price and simulated daily rate.',
    status: 'live' as const
  },
  {
    Icon: Building2,
    title: 'Build your empire',
    desc: 'Plan headquarters, server farms and labs that shape your tech empire.',
    status: 'preview' as const
  },
  {
    Icon: Gauge,
    title: 'Manage simulated production',
    desc: 'Track 4-hour production cycles and office energy — simulated only.',
    status: 'preview' as const
  },
  {
    Icon: Trophy,
    title: 'Complete missions',
    desc: 'Clear daily missions to earn XP and SP game points as a preview.',
    status: 'preview' as const
  }
]

const BUILDINGS = [
  { name: 'Headquarters', desc: 'Central command', level: 3, locked: false },
  { name: 'Server Farm', desc: 'Compute capacity', level: 2, locked: false },
  { name: 'AI Lab', desc: 'Model training', level: 1, locked: false },
  { name: 'Data Center', desc: 'Storage & streaming', level: 0, locked: true }
]

const FEATURES = [
  { Icon: Smartphone, title: 'Mobile-first PWA', desc: 'Install on your home screen and play full-screen.' },
  { Icon: ShieldCheck, title: 'Simulation-first', desc: 'Every rate and credit is simulated — never real money.' },
  { Icon: Zap, title: 'Game points', desc: 'Earn XP and SP for progress across missions.' },
  { Icon: Activity, title: 'Live previews', desc: 'Explore the CEO Market and game UI today.' }
]

const FAQS = [
  { q: 'Is TycoonX free to play?', a: 'Yes. TycoonX is a free simulation preview. No payments are enabled.' },
  { q: 'Can I earn real money?', a: 'No. All rates, credits and points are simulated and non-withdrawable.' },
  { q: 'Do I need Telegram?', a: 'No. TycoonX is a standalone progressive web app.' },
  { q: 'Can I install it on my phone?', a: 'Yes — add it to your home screen from your mobile browser.' },
  { q: 'What is available now?', a: 'Accounts, the CEO Market and game UI previews. Production, ownership and rewards are in development.' }
]

const RARITY_FRAME: Record<string, string> = {
  Common: 'border-gray-700/60',
  Rare: 'border-primary/40',
  Epic: 'border-accent/50',
  Legendary: 'border-amber-500/50'
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function Portrait({ name, rarity, size = 'md' }: { name: string; rarity: string; size?: 'sm' | 'md' }) {
  const style = rarityStyle(rarity)
  const h = hashStr(name)
  const skins = ['#f1c9a5', '#e0ac82', '#c68642', '#8d5524', '#ffd9b3']
  const hairs = ['#2b2b2b', '#5a3a22', '#111827', '#6b7280', '#3b2f2f']
  const suits = ['#1f2a44', '#22304f', '#2a2440', '#203a3a']
  const skin = skins[h % skins.length]
  const hair = hairs[(h >> 3) % hairs.length]
  const suit = suits[(h >> 5) % suits.length]
  const dim = size === 'sm' ? 'h-12 w-12' : 'h-16 w-16'
  const frame = RARITY_FRAME[rarity] ?? 'border-gray-700/60'
  return (
    <div className={`relative ${dim} shrink-0 rounded-xl border ${frame} bg-gray-900/50 overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${style.glow} to-transparent`} />
      <svg viewBox="0 0 120 120" className="relative z-10 h-full w-full" role="img" aria-label={`${name} portrait`}>
        <ellipse cx="60" cy="58" rx="30" ry="30" fill="currentColor" className={style.accent} opacity="0.12" />
        <path d="M18,120 C18,92 42,84 60,84 C78,84 102,92 102,120 Z" fill={suit} />
        <path d="M60,84 L52,112 L68,112 Z" fill="#e5e7eb" opacity="0.85" />
        <path d="M60,86 L44,120 L58,120 Z" fill="currentColor" className={style.accent} opacity="0.45" />
        <path d="M60,86 L76,120 L62,120 Z" fill="currentColor" className={style.accent} opacity="0.45" />
        <rect x="52" y="72" width="16" height="16" rx="5" fill={skin} />
        <circle cx="38" cy="60" r="4.5" fill={skin} />
        <circle cx="82" cy="60" r="4.5" fill={skin} />
        <circle cx="60" cy="56" r="22" fill={skin} />
        <path d="M37,52 C37,30 83,30 83,52 C79,40 72,37 60,37 C48,37 41,40 37,52 Z" fill={hair} />
        <circle cx="51" cy="57" r="2.4" fill="#0b1020" />
        <circle cx="69" cy="57" r="2.4" fill="#0b1020" />
        <path d="M53,66 Q60,70 67,66" fill="none" stroke="#0b1020" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </svg>
    </div>
  )
}

function HeroArt() {
  return (
    <svg viewBox="0 0 480 320" className="w-full h-auto" role="img" aria-label="Isometric illustration of a tech empire headquarters">
      <defs>
        <linearGradient id="lgTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7aa8ff" />
          <stop offset="100%" stopColor="#3478FF" />
        </linearGradient>
        <linearGradient id="lgLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b2a55" />
          <stop offset="100%" stopColor="#121a33" />
        </linearGradient>
        <linearGradient id="lgRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d4fa0" />
          <stop offset="100%" stopColor="#1a2c63" />
        </linearGradient>
        <linearGradient id="lgAccent" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b39cf7" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <polygon points="240,140 420,230 240,320 60,230" fill="#0f1730" stroke="#1f2b52" strokeWidth="1" />
      <polygon points="240,170 350,225 240,280 130,225" fill="none" stroke="#1b2547" strokeWidth="1" />
      <ellipse cx="240" cy="225" rx="170" ry="76" fill="#3478FF" opacity="0.1" />
      <polygon points="96,150 130,167 130,214 96,197" fill="url(#lgLeft)" />
      <polygon points="164,150 130,167 130,214 164,197" fill="url(#lgRight)" />
      <polygon points="130,133 164,150 130,167 96,150" fill="url(#lgTop)" />
      <polygon points="300,138 340,158 340,214 300,194" fill="url(#lgLeft)" />
      <polygon points="380,138 340,158 340,214 380,194" fill="url(#lgRight)" />
      <polygon points="340,118 380,138 340,158 300,138" fill="url(#lgAccent)" />
      <polygon points="196,120 240,142 240,220 196,198" fill="url(#lgLeft)" />
      <polygon points="284,120 240,142 240,220 284,198" fill="url(#lgRight)" />
      <polygon points="240,98 284,120 240,142 196,120" fill="url(#lgAccent)" />
      <circle cx="240" cy="92" r="10" fill="#8B5CF6" opacity="0.25" className="motion-safe:animate-pulse" />
      <circle cx="240" cy="92" r="4" fill="#8B5CF6" />
      <polygon points="212,214 240,228 240,258 212,244" fill="url(#lgLeft)" />
      <polygon points="268,214 240,228 240,258 268,244" fill="url(#lgRight)" />
      <polygon points="240,200 268,214 240,228 212,214" fill="url(#lgTop)" />
    </svg>
  )
}

function SectionTitle({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="max-w-2xl">
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary font-semibold">
        <Sparkles className="h-3 w-3" /> {eyebrow}
      </span>
      <h2 className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight">{title}</h2>
      {desc && <p className="mt-2 text-sm md:text-base text-gray-400">{desc}</p>}
    </div>
  )
}

export default function Landing({ navigate, authed }: Props) {
  const registerHref = useMemo(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    return ref ? `/register?ref=${encodeURIComponent(ref)}` : '/register'
  }, [])

  const startPlaying = () => navigate(authed ? '/dashboard' : registerHref)

  return (
    <div className="min-h-screen bg-bg text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-800/70 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-6">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/') }} className="text-lg font-bold tracking-tighter bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            TycoonX
          </a>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Sections">
            <a href="#how" className="rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800/60 hover:text-white">How it works</a>
            <a href="#executives" className="rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800/60 hover:text-white">Executives</a>
            <a href="#empire" className="rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800/60 hover:text-white">Empire</a>
            <a href="#faq" className="rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800/60 hover:text-white">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {authed ? (
              <Button size="sm" onClick={() => navigate('/dashboard')}>
                Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  Login
                </Button>
                <Button size="sm" onClick={startPlaying}>
                  Start Playing <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-bg to-accent/15" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #3478FF 1px, transparent 0)', backgroundSize: '24px 24px' }}
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
              <Rocket className="h-3 w-3" /> Tech Tycoon Simulator
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              Build Your <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Tech Empire</span>
            </h1>
            <p className="mt-4 max-w-xl text-gray-300 md:text-lg">
              Recruit elite CEOs, expand a futuristic headquarters and manage simulated production.
              A premium, mobile-first tycoon experience — all values are simulated.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={startPlaying}>
                Start Playing <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <a
                href="#how"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-gray-700 px-4 text-base font-medium text-white transition-colors hover:bg-gray-800/60"
              >
                <Play className="h-4 w-4" /> See how it works
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { Icon: CheckCircle2, label: 'Free to play' },
                { Icon: ShieldCheck, label: 'No real money' },
                { Icon: Smartphone, label: 'Installable PWA' }
              ].map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800/70 bg-gray-900/40 px-2.5 py-1 text-xs text-gray-300">
                  <c.Icon className="h-3.5 w-3.5 text-success" /> {c.label}
                </span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl border border-gray-800/60 bg-gray-900/30 p-3 backdrop-blur-sm">
              <HeroArt />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 md:px-6 md:py-20">
        <SectionTitle eyebrow="How it works" title="From intern to empire" desc="Four steps to grow your tech tycoon story." />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative rounded-xl border border-gray-800/60 bg-gray-900/30 p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800/60">
                  <s.Icon className="h-5 w-5 text-primary" />
                </span>
                <Badge variant={s.status === 'live' ? 'success' : 'warning'}>
                  {s.status === 'live' ? 'Live now' : 'In development'}
                </Badge>
              </div>
              <p className="mt-4 text-[11px] font-semibold text-gray-500">STEP {i + 1}</p>
              <h3 className="mt-1 font-bold text-white">{s.title}</h3>
              <p className="mt-1 text-sm text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Executives */}
      <section id="executives" className="scroll-mt-20 border-y border-gray-800/60 bg-gray-900/20 py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SectionTitle eyebrow="Meet the executives" title="Elite talent, rare potential" desc="Illustrative previews of the executive roster." />
            <Badge variant="demo">Illustrative previews</Badge>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {EXECUTIVES.map((e) => {
              const style = rarityStyle(e.rarity)
              return (
                <div key={e.name} className={`relative overflow-hidden rounded-xl border bg-gray-900/30 p-4 ${RARITY_FRAME[e.rarity] ?? 'border-gray-800/60'}`}>
                  <div className={`pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-br ${style.glow} to-transparent blur-2xl`} />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3">
                      <Portrait name={e.name} rarity={e.rarity} />
                      <div className="min-w-0">
                        <h3 className="font-bold text-white truncate">{e.name}</h3>
                        <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>
                          {e.rarity}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-400">{e.role}</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-gray-400">Daily rate <span className={`font-semibold ${style.accent}`}>{e.rate}</span></span>
                      <span className="text-gray-400">Price <span className="font-semibold text-white">{e.price}</span></span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-[11px] text-gray-500">
            Rates and prices shown are simulated examples, not offers or real earnings.
          </p>
        </div>
      </section>

      {/* Empire preview */}
      <section id="empire" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 md:px-6 md:py-20">
        <SectionTitle eyebrow="Empire preview" title="Design your headquarters" desc="A futuristic campus with progression across buildings." />
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center">
          <div className="rounded-2xl border border-gray-800/60 bg-gray-900/30 p-3">
            <HeroArt />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BUILDINGS.map((b) => (
              <div key={b.name} className={`rounded-xl border p-4 ${b.locked ? 'border-gray-800/60 bg-gray-900/20 opacity-70' : 'border-gray-800/60 bg-gray-900/30'}`}>
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-800/60">
                    {b.locked ? <Lock className="h-4 w-4 text-gray-400" /> : <Building2 className="h-4 w-4 text-primary" />}
                  </span>
                  <Badge variant={b.locked ? 'warning' : 'demo'}>{b.locked ? 'Coming Soon' : `Level ${b.level}`}</Badge>
                </div>
                <h3 className="mt-3 font-bold text-white">{b.name}</h3>
                <p className="text-xs text-gray-400">{b.desc}</p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-gray-800/70 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: b.locked ? '0%' : `${(b.level / 5) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-[11px] text-gray-500">
          Buildings, levels and upgrades are previews — gameplay and ownership are in development.
        </p>
      </section>

      {/* Features + PWA */}
      <section className="border-y border-gray-800/60 bg-gray-900/20 py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionTitle eyebrow="Why TycoonX" title="Premium, fast and simulation-first" />
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-gray-800/60 bg-gray-900/30 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800/60">
                  <f.Icon className="h-5 w-5 text-accent" />
                </span>
                <h3 className="mt-3 font-bold text-white">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-xl font-bold">Play anywhere</h3>
              <p className="mt-2 text-sm text-gray-400">
                TycoonX is a responsive progressive web app. Add it to your home screen for a
                full-screen, offline-friendly experience on phone, tablet and desktop.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800/70 bg-gray-900/40 px-2.5 py-1 text-xs text-gray-300">
                  <Smartphone className="h-3.5 w-3.5 text-primary" /> Mobile 360px+
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800/70 bg-gray-900/40 px-2.5 py-1 text-xs text-gray-300">
                  <Monitor className="h-3.5 w-3.5 text-primary" /> Desktop &amp; tablet
                </span>
              </div>
            </div>
            <div className="flex items-end justify-center gap-4">
              <div className="h-40 w-24 rounded-2xl border border-gray-700 bg-gradient-to-br from-primary/20 to-accent/20 p-2">
                <div className="h-full w-full rounded-xl border border-gray-700/60 bg-bg/70" />
              </div>
              <div className="h-48 w-64 rounded-2xl border border-gray-700 bg-gradient-to-br from-accent/20 to-primary/20 p-2">
                <div className="h-full w-full rounded-xl border border-gray-700/60 bg-bg/70" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-14 md:px-6 md:py-20">
        <SectionTitle eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-8 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-xl border border-gray-800/60 bg-gray-900/30 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-gray-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-14 md:py-20">
        <div className="mx-auto max-w-4xl rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-accent/15 p-8 text-center md:p-12">
          <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">Ready to build your empire?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-gray-300">
            Create a free account and explore the CEO Market and your command center today.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={startPlaying}>
              {authed ? 'Go to Dashboard' : 'Start Playing'} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            {!authed && (
              <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
                I already have an account
              </Button>
            )}
          </div>
          <p className="mt-4 text-[11px] text-gray-400">
            Simulation only — no real earnings, withdrawals or guaranteed returns.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/70 bg-gray-900/20">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-sm">
              <span className="text-lg font-bold tracking-tighter bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                TycoonX
              </span>
              <p className="mt-2 text-xs text-gray-400">
                A premium tech-tycoon simulation. Not affiliated with any real company. All game
                economy values are simulated and non-withdrawable.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Footer">
              <a href="#how" className="text-gray-400 hover:text-white">How it works</a>
              <a href="#executives" className="text-gray-400 hover:text-white">Executives</a>
              <a href="#empire" className="text-gray-400 hover:text-white">Empire</a>
              <a href="#faq" className="text-gray-400 hover:text-white">FAQ</a>
              <a href="/" onClick={(e) => { e.preventDefault(); navigate(authed ? '/dashboard' : '/login') }} className="text-gray-400 hover:text-white">
                {authed ? 'Dashboard' : 'Login'}
              </a>
            </nav>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-gray-800/70 pt-6 text-[11px] text-gray-500 sm:flex-row">
            <span>&copy; {new Date().getFullYear()} TycoonX. Simulation preview.</span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> No real money involved
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

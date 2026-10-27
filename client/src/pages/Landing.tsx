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
import LanguageSelector from '../components/LanguageSelector'
import { formatNumber, formatUsd } from '../lib/format'
import { fetchPublicCeos, type PublicCeo } from '../lib/ceos'
import { useT } from '../i18n'

type Props = { navigate: (p: string) => void; authed: boolean }

const COMMUNITY_URL = 'https://t.me/tycoonX_official'

export default function Landing({ navigate, authed }: Props) {
  const t = useT()
  const go = () => navigate(authed ? '/dashboard' : '/register')
  const ref = useMemo(() => new URLSearchParams(window.location.search).get('ref'), [])
  const startHref = ref ? `/register?ref=${encodeURIComponent(ref)}` : '/register'

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

  const steps = [
    { Icon: Users, title: t('landing.how.step1.title'), text: t('landing.how.step1.text') },
    { Icon: Play, title: t('landing.how.step2.title'), text: t('landing.how.step2.text') },
    { Icon: Download, title: t('landing.how.step3.title'), text: t('landing.how.step3.text') },
    { Icon: Trophy, title: t('landing.how.step4.title'), text: t('landing.how.step4.text') }
  ]

  const earningPaths = [
    { Icon: Cpu, title: t('landing.earn.production.title'), text: t('landing.earn.production.text') },
    { Icon: Zap, title: t('landing.earn.missions.title'), text: t('landing.earn.missions.text') },
    { Icon: Users, title: t('landing.earn.referrals.title'), text: t('landing.earn.referrals.text') }
  ]

  const faqs = [
    { q: t('landing.faq.q1'), a: t('landing.faq.a1') },
    { q: t('landing.faq.q2'), a: t('landing.faq.a2') },
    { q: t('landing.faq.q3'), a: t('landing.faq.a3') },
    { q: t('landing.faq.q4'), a: t('landing.faq.a4') },
    { q: t('landing.faq.q5'), a: t('landing.faq.a5') },
    { q: t('landing.faq.q6'), a: t('landing.faq.a6') }
  ]

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-2" aria-label="TycoonX">
            <Logo size={32} />
          </button>
          <nav className="ms-6 hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#how" className="transition-colors hover:text-ink">{t('landing.nav.how')}</a>
            <a href="#ceos" className="transition-colors hover:text-ink">{t('landing.nav.ceos')}</a>
            <a href="#empire" className="transition-colors hover:text-ink">{t('landing.nav.empire')}</a>
            <a href="#economy" className="transition-colors hover:text-ink">{t('landing.nav.economy')}</a>
            <a href="#faq" className="transition-colors hover:text-ink">{t('landing.nav.faq')}</a>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSelector variant="compact" className="hidden sm:flex" />
            {authed ? (
              <button onClick={go} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-primary/90">{t('landing.openEmpire')}</button>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="hidden rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink sm:block">{t('landing.signIn')}</button>
                <button onClick={() => navigate(startHref)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-primary/90">{t('landing.startFree')}</button>
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
            <span className="chip border-primary/40 text-primary"><Sparkles className="h-3.5 w-3.5" /> {t('landing.badge')}</span>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              {t('landing.hero.title1')} <span className="text-gradient">{t('landing.hero.title2')}</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-muted">{t('landing.hero.body')}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={() => navigate(startHref)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 text-sm font-bold text-bg shadow-glow transition-transform hover:scale-[1.02]">
                <Rocket className="h-4 w-4" /> {t('landing.hero.cta')}
              </button>
              <a href="#how" className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white/5">
                {t('landing.hero.how')} <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> {t('landing.trust.free')}</span>
              <span className="inline-flex items-center gap-1.5"><Coins className="h-4 w-4 text-gold" /> {t('landing.trust.transparent')}</span>
              <span className="inline-flex items-center gap-1.5"><Trophy className="h-4 w-4 text-primary" /> {t('landing.trust.leaderboard')}</span>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative animate-fade-in">
            <div className="rounded-3xl border border-line bg-surface/70 p-4 shadow-card backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">{t('landing.preview.title')}</span>
                <Badge variant="demo">{t('landing.preview.illustrative')}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(catalog.length ? catalog.slice(0, 3) : []).map((c) => (
                  <div key={c.slug} className="flex flex-col items-center rounded-xl border border-line bg-surface-2/60 p-3">
                    <CeoAvatar name={c.name} slug={c.slug} rarity={c.rarity} size={48} imageUrl={c.imageUrl} />
                    <span className="mt-2 max-w-full truncate text-[11px] font-semibold">{c.name}</span>
                    <span className="text-[10px] text-muted">{c.nominalSpPer24h != null ? `${formatNumber(c.nominalSpPer24h)} SP/24h` : c.rarity}</span>
                  </div>
                ))}
                {catalog.length === 0 &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center rounded-xl border border-line bg-surface-2/40 p-3">
                      <div className="h-12 w-12 rounded-full bg-white/5" />
                      <span className="mt-2 text-[10px] text-muted">{t('landing.preview.catalog')}</span>
                    </div>
                  ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-muted">
                <div className="rounded-xl border border-line bg-surface-2/60 p-2"><Play className="mx-auto h-3.5 w-3.5 text-primary rtl:rotate-180" /><div className="mt-1 font-semibold text-ink">{t('landing.preview.start')}</div></div>
                <div className="rounded-xl border border-line bg-surface-2/60 p-2"><Clock className="mx-auto h-3.5 w-3.5 text-gold" /><div className="mt-1 font-semibold text-ink">{t('landing.preview.wait')}</div></div>
                <div className="rounded-xl border border-line bg-surface-2/60 p-2"><Download className="mx-auto h-3.5 w-3.5 text-success" /><div className="mt-1 font-semibold text-ink">{t('landing.preview.collect')}</div></div>
              </div>
              <p className="mt-2 text-[10px] text-muted">{t('landing.preview.note')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-line bg-surface-2/30">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">{t('landing.how.title')}</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted">{t('landing.how.subtitle')}</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-line bg-surface/60 p-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><s.Icon className="h-5 w-5" /></div>
                <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted">{t('landing.how.step', { n: i + 1 })}</div>
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
          <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">{t('landing.earn.title')}</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted">{t('landing.earn.subtitle')}</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {earningPaths.map((p) => (
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
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{t('landing.ceos.title')}</h2>
              <p className="mt-2 max-w-lg text-sm text-muted">{t('landing.ceos.subtitle')}</p>
            </div>
            <Badge variant="demo" className="hidden shrink-0 sm:inline-flex">{t('landing.ceos.live')}</Badge>
          </div>

          {catalog.length === 0 ? (
            <p className="mt-8 text-sm text-muted">
              {catalogError ? t('landing.ceos.error') : t('landing.ceos.loading')}
            </p>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {catalog.slice(0, 8).map((c) => (
                <div key={c.slug} className="rounded-2xl border border-line bg-surface/60 p-4 text-center">
                  <div className="flex justify-center"><CeoAvatar name={c.name} slug={c.slug} rarity={c.rarity} size={64} imageUrl={c.imageUrl} /></div>
                  <h3 className="mt-2 truncate text-sm font-bold text-ink">{c.name}</h3>
                  <p className="text-[10px] text-muted">{c.rarity}</p>
                  <p className="mt-1 text-xs font-bold text-ink">{c.priceUsd <= 0 ? t('common.free') : formatUsd(c.priceUsd)}</p>
                  <p className="text-[10px] text-gold">{c.nominalSpPer24h != null ? `${formatNumber(c.nominalSpPer24h)} SP/24h` : '—'}</p>
                  <p className="text-[10px] text-muted">{t('landing.ceos.cap', { value: c.lifetimeCapSp != null ? formatNumber(c.lifetimeCapSp) : '—' })}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-center text-[11px] text-muted">{t('landing.ceos.disclaimer')}</p>
        </div>
      </section>

      {/* My Empire */}
      <section id="empire" className="border-t border-line bg-surface-2/30">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:px-6">
          <div>
            <span className="chip border-primary/40 text-primary"><Compass className="h-3.5 w-3.5" /> {t('landing.empire.badge')}</span>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{t('landing.empire.title')}</h2>
            <p className="mt-2 text-sm text-muted">{t('landing.empire.text')}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li className="flex items-start gap-2"><Gauge className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t('landing.empire.point1')}</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {t('landing.empire.point2')}</li>
              <li className="flex items-start gap-2"><Download className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> {t('landing.empire.point3')}</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-line bg-surface/60 p-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[t('common.idle'), t('common.producing'), t('common.ready'), t('common.exhausted'), t('game.legend.equipment'), t('game.legend.cap')].map((label, i) => (
                <div key={label} className="rounded-xl border border-line bg-surface-2/50 p-3 text-center">
                  <div className={`mx-auto h-8 w-8 rounded-lg ${['bg-line', 'bg-primary/30', 'bg-success/40', 'bg-warning/30', 'bg-gold/30', 'bg-primary/15'][i]}`} />
                  <p className="mt-2 text-[10px] font-semibold text-ink">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-muted">{t('landing.empire.statesNote')}</p>
          </div>
        </div>
      </section>

      {/* Progression */}
      <section id="progress" className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2 md:px-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{t('landing.progress.title')}</h2>
            <p className="mt-2 text-sm text-muted">{t('landing.progress.text')}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Rookie', 'Entrepreneur', 'Founder', 'Executive', 'Tycoon', 'Empire Legend'].map((r) => (
                <span key={r} className="chip"><Star className="h-3 w-3 text-primary" /> {r}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface/60 p-4"><Trophy className="h-5 w-5 text-primary" /><h3 className="mt-2 font-bold text-ink">{t('landing.progress.leaderboard.title')}</h3><p className="text-xs text-muted">{t('landing.progress.leaderboard.text')}</p></div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4"><Sparkles className="h-5 w-5 text-accent" /><h3 className="mt-2 font-bold text-ink">{t('landing.progress.achievements.title')}</h3><p className="text-xs text-muted">{t('landing.progress.achievements.text')}</p></div>
            <div className="rounded-2xl border border-line bg-surface/60 p-4"><Zap className="h-5 w-5 text-gold" /><h3 className="mt-2 font-bold text-ink">{t('landing.progress.missions.title')}</h3><p className="text-xs text-muted">{t('landing.progress.missions.text')}</p></div>
          </div>
        </div>
      </section>

      {/* Economy + trust */}
      <section id="economy" className="border-t border-line bg-surface-2/30">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-6">
          <ShieldCheck className="mx-auto h-8 w-8 text-success" />
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{t('landing.economy.title')}</h2>
          <p className="mt-3 text-sm text-muted">{t('landing.economy.text')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs">
            <span className="chip"><Coins className="h-3.5 w-3.5 text-gold" /> {t('landing.economy.rate')}</span>
            <span className="chip"><ShieldCheck className="h-3.5 w-3.5 text-success" /> {t('landing.economy.caps')}</span>
            <span className="chip"><Lock className="h-3.5 w-3.5" /> {t('landing.economy.bonus')}</span>
          </div>
          <p className="mt-4 text-[11px] text-muted">{t('landing.economy.withdrawals')}</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-line">
        <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
          <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">{t('landing.faq.title')}</h2>
          <div className="mt-8 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-line bg-surface/60 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
                  {f.q}
                  <ChevronRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:-rotate-90" />
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
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{t('landing.community.title')}</h2>
          <p className="mt-3 text-sm text-muted">{t('landing.community.text')}</p>
          <a
            href={COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#229ED9] px-5 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
          >
            <Send className="h-4 w-4" /> {t('landing.community.cta')}
          </a>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{t('landing.cta.title')}</h2>
          <p className="mt-3 text-sm text-muted">{t('landing.cta.text')}</p>
          <button onClick={() => navigate(startHref)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3.5 text-sm font-bold text-bg shadow-glow transition-transform hover:scale-[1.02]">
            <Rocket className="h-4 w-4" /> {t('landing.cta.button')}
          </button>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted md:flex-row md:px-6">
          <span>{t('common.year', { year: new Date().getFullYear() })}</span>
          <span className="flex flex-wrap items-center gap-3">
            <a href="#faq" className="hover:text-ink">{t('landing.footer.link.faq')}</a>
            <a href="#how" className="hover:text-ink">{t('landing.footer.link.how')}</a>
            <a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms') }} className="hover:text-ink">{t('landing.footer.link.terms')}</a>
            <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy') }} className="hover:text-ink">{t('landing.footer.link.privacy')}</a>
            <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              <Send className="h-3 w-3" /> Telegram
            </a>
            <LanguageSelector variant="compact" />
          </span>
        </div>
      </footer>
    </div>
  )
}

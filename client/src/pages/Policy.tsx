import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useT } from '../i18n'

export type PolicyKind = 'terms' | 'privacy'

type Section = { heading: string; paragraphs: string[] }

export default function Policy({ kind, navigate }: { kind: PolicyKind; navigate: (p: string) => void }) {
  const t = useT()
  const meta = {
    title: kind === 'terms' ? t('policy.terms') : t('policy.privacy'),
    version: '1.0',
    effective: '2026-10-19'
  }

  const sections: Section[] =
    kind === 'terms'
      ? [
          { heading: t('policy.s1.heading'), paragraphs: [t('policy.s1.p1'), t('policy.s1.p2')] },
          { heading: t('policy.s2.heading'), paragraphs: [t('policy.s2.p1'), t('policy.s2.p2')] },
          { heading: t('policy.s3.heading'), paragraphs: [t('policy.s3.p1'), t('policy.s3.p2')] },
          { heading: t('policy.s4.heading'), paragraphs: [t('policy.s4.p1'), t('policy.s4.p2')] },
          { heading: t('policy.s5.heading'), paragraphs: [t('policy.s5.p1'), t('policy.s5.p2')] },
          { heading: t('policy.s6.heading'), paragraphs: [t('policy.s6.p1')] },
          { heading: t('policy.s7.heading'), paragraphs: [t('policy.s7.p1')] }
        ]
      : [
          { heading: t('policy.p1.heading'), paragraphs: [t('policy.p1.p1'), t('policy.p1.p2'), t('policy.p1.p3')] },
          { heading: t('policy.p2.heading'), paragraphs: [t('policy.p2.p1')] },
          { heading: t('policy.p3.heading'), paragraphs: [t('policy.p3.p1'), t('policy.p3.p2')] },
          { heading: t('policy.p4.heading'), paragraphs: [t('policy.p4.p1')] },
          { heading: t('policy.p5.heading'), paragraphs: [t('policy.p5.p1'), t('policy.p5.p2')] },
          { heading: t('policy.p6.heading'), paragraphs: [t('policy.p6.p1')] },
          { heading: t('policy.p7.heading'), paragraphs: [t('policy.p7.p1')] }
        ]

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-[calc(env(safe-area-inset-bottom)_+_3rem)] md:px-6 md:py-10">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); navigate('/') }}
          className="mb-8 flex items-center gap-2 text-accent/70 transition hover:text-accent"
          aria-label={t('auth.backHome')}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('policy.back')}
        </a>

        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{meta.title}</h1>
            <p className="text-xs text-muted">{t('policy.version', { version: meta.version, effective: meta.effective })}</p>
          </div>
        </div>

        <p className="mt-6 text-sm text-muted">{t('policy.intro')}</p>

        <div className="mt-8 space-y-7">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold text-ink">{section.heading}</h2>
              <div className="mt-2 space-y-2">
                {section.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-4 border-t border-line pt-6 text-sm">
          <a
            href={kind === 'terms' ? '/privacy' : '/terms'}
            onClick={(e) => { e.preventDefault(); navigate(kind === 'terms' ? '/privacy' : '/terms') }}
            className="text-accent underline"
          >
            {kind === 'terms' ? t('policy.switchToPrivacy') : t('policy.switchToTerms')}
          </a>
        </div>

        <p className="mt-8 text-[10px] text-muted">{t('common.year', { year: new Date().getFullYear() })}</p>
      </div>
    </div>
  )
}

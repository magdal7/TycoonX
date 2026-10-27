import { useEffect, useState } from 'react'
import { Sparkles, LayoutDashboard, Play, Download, Coins, Store, Target, Users } from 'lucide-react'
import { Button } from './ui/button'
import { useAuth } from '../context/AuthContext'
import { useT, type TranslationKey } from '../i18n'
import {
  clearOnboardingState,
  getOnboardingState,
  setOnboardingState,
} from '../lib/onboarding'

export const ONBOARDING_REPLAY_EVENT = 'tycoonx:onboarding:replay'

/** Trigger a replay from anywhere (e.g. the Help page). */
export function requestOnboardingReplay(): void {
  window.dispatchEvent(new Event(ONBOARDING_REPLAY_EVENT))
}

const STEPS: { Icon: React.ComponentType<{ className?: string }>; titleKey: TranslationKey; textKey: TranslationKey }[] = [
  { Icon: Sparkles, titleKey: 'onboarding.s1.title', textKey: 'onboarding.s1.text' },
  { Icon: LayoutDashboard, titleKey: 'onboarding.s2.title', textKey: 'onboarding.s2.text' },
  { Icon: Users, titleKey: 'onboarding.s3.title', textKey: 'onboarding.s3.text' },
  { Icon: Play, titleKey: 'onboarding.s4.title', textKey: 'onboarding.s4.text' },
  { Icon: Download, titleKey: 'onboarding.s5.title', textKey: 'onboarding.s5.text' },
  { Icon: Coins, titleKey: 'onboarding.s6.title', textKey: 'onboarding.s6.text' },
  { Icon: Store, titleKey: 'onboarding.s7.title', textKey: 'onboarding.s7.text' },
  { Icon: Target, titleKey: 'onboarding.s8.title', textKey: 'onboarding.s8.text' },
]

export default function OnboardingGuide() {
  const { user } = useAuth()
  const t = useT()
  const userId = user?.id ?? null
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  // Auto-open once per user when not yet completed/skipped.
  useEffect(() => {
    if (userId != null && getOnboardingState(userId) === null) {
      setStep(0)
      setOpen(true)
    }
  }, [userId])

  // Replay requested (from Help).
  useEffect(() => {
    const handler = () => {
      if (userId != null) clearOnboardingState(userId)
      setStep(0)
      setOpen(true)
    }
    window.addEventListener(ONBOARDING_REPLAY_EVENT, handler)
    return () => window.removeEventListener(ONBOARDING_REPLAY_EVENT, handler)
  }, [userId])

  if (!open) return null

  const current = STEPS[step]
  const last = step === STEPS.length - 1

  function finish(state: 'done' | 'skipped') {
    if (userId != null) setOnboardingState(userId, state)
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-label={t('onboarding.dialogLabel')}
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)_+_4.5rem)] z-40 flex justify-center px-3 md:bottom-6 md:ms-72 md:me-6 md:px-0"
    >
      <div className="pointer-events-auto w-full max-w-md animate-slide-up rounded-2xl border border-line bg-surface/95 p-4 shadow-card backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <current.Icon className="h-4 w-4" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
            {t('onboarding.step', { current: step + 1, total: STEPS.length })}
          </span>
          <button
            type="button"
            onClick={() => finish('skipped')}
            className="ms-auto text-[11px] text-muted underline hover:text-ink"
          >
            {t('onboarding.skip')}
          </button>
        </div>
        <h3 className="mt-2 text-sm font-bold text-ink">{t(current.titleKey)}</h3>
        <p className="mt-1 text-xs text-muted">{t(current.textKey)}</p>

        <div className="mt-3 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s.titleKey} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-line'}`} />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            {t('onboarding.back')}
          </Button>
          {last ? (
            <Button size="sm" className="flex-1" onClick={() => finish('done')}>{t('onboarding.finish')}</Button>
          ) : (
            <Button size="sm" className="flex-1" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>{t('onboarding.next')}</Button>
          )}
        </div>
      </div>
    </div>
  )
}

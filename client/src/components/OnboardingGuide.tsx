import { useEffect, useState } from 'react'
import { Sparkles, LayoutDashboard, Play, Download, Coins, Store, Target, Users } from 'lucide-react'
import { Button } from './ui/button'
import { useAuth } from '../context/AuthContext'
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

const STEPS = [
  { Icon: Sparkles, title: 'Welcome to TycoonX', text: 'You are building a technology empire. This short tour shows the core loop — you can skip it any time and replay it from Help.' },
  { Icon: LayoutDashboard, title: 'Your command center', text: 'The Empire dashboard is home: your balances, level and CEO fleet all live here.' },
  { Icon: Users, title: 'Your free Intern CEO', text: 'A starter Intern CEO is provisioned automatically on first sign-in — no purchase required.' },
  { Icon: Play, title: 'Start production', text: 'Start a manual production cycle on a CEO (4h, 6h or 8h with equipment). Nothing restarts automatically.' },
  { Icon: Download, title: 'Collect when ready', text: 'When a cycle finishes it becomes “Ready”. Collect it to receive Earned SP.' },
  { Icon: Coins, title: 'Earned SP vs Bonus SP', text: 'Earned SP comes from production and is the only balance that can ever be withdrawn. Bonus SP is spendable but never withdrawable.' },
  { Icon: Store, title: 'Recruit more CEOs', text: 'The Market lets you buy more CEO copies with SP (Bonus SP spends first). Every copy has a finite lifetime cap.' },
  { Icon: Target, title: 'Missions & progression', text: 'Complete daily and weekly missions and permanent achievements to earn XP and climb the ranks.' },
]

export default function OnboardingGuide() {
  const { user } = useAuth()
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
      aria-label="Getting started guide"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)_+_4.5rem)] z-40 flex justify-center px-3 md:bottom-6 md:left-72 md:right-6 md:px-0"
    >
      <div className="pointer-events-auto w-full max-w-md animate-slide-up rounded-2xl border border-line bg-surface/95 p-4 shadow-card backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <current.Icon className="h-4 w-4" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Step {step + 1} of {STEPS.length}
          </span>
          <button
            type="button"
            onClick={() => finish('skipped')}
            className="ml-auto text-[11px] text-muted underline hover:text-ink"
          >
            Skip
          </button>
        </div>
        <h3 className="mt-2 text-sm font-bold text-ink">{current.title}</h3>
        <p className="mt-1 text-xs text-muted">{current.text}</p>

        <div className="mt-3 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s.title} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-line'}`} />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          {last ? (
            <Button size="sm" className="flex-1" onClick={() => finish('done')}>Got it — start playing</Button>
          ) : (
            <Button size="sm" className="flex-1" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Next</Button>
          )}
        </div>
      </div>
    </div>
  )
}

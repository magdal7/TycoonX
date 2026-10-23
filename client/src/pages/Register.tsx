import { useState } from 'react'
import { Mail, Lock, User, ArrowLeft, ChevronRight, Gift } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card } from '../components/ui/card'
import { LogoMark } from '../components/Logo'
import { usePublicSettings } from '../lib/siteSettings'

type Props = { navigate: (p: string) => void }

export default function Register({ navigate }: Props) {
  const { register } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ref, setRef] = useState(() => new URLSearchParams(window.location.search).get('ref') ?? '')
  const settings = usePublicSettings()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const email = fd.get('email') as string
    const username = fd.get('username') as string
    const password = fd.get('password') as string
    const confirmPassword = fd.get('confirmPassword') as string
    const acceptTerms = fd.get('acceptTerms') === 'on'
    const referral = ref.trim()

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!acceptTerms) {
      setError('You must accept the Terms of Service and Privacy Policy')
      return
    }

    setLoading(true)
    setError('')
    const res = await register({
      email,
      username,
      password,
      acceptTerms,
      ...(referral ? { ref: referral } : {}),
    })
    setLoading(false)
    if (res.error) setError(res.error || 'Registration failed')
    else navigate('/dashboard')
  }

  const closed = settings.data && (!settings.data.registrationEnabled || settings.data.maintenance.enabled)

  return (
    <div className="min-h-screen bg-bg text-ink font-sans px-4 py-6 pb-[calc(env(safe-area-inset-bottom)_+_2rem)]">
      <a
        href="/"
        onClick={(e) => { e.preventDefault(); navigate('/') }}
        className="flex items-center gap-2 text-accent/70 hover:text-accent transition mb-6"
        aria-label="Back to home"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </a>

      <div className="max-w-sm mx-auto">
        <div className="text-center mb-8">
          <LogoMark size={48} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
          <p className="text-muted text-sm mt-2">Start building your TycoonX empire</p>
        </div>

        <Card padding="lg" hover={false} className="border border-line">
          {closed && (
            <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {settings.data?.maintenance.enabled
                ? settings.data.maintenance.message
                : 'Registration is temporarily closed. Please check back later.'}
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted" />
                <label className="text-sm font-medium text-ink">Email address</label>
              </div>
              <Input name="email" type="email" required autoComplete="email" className="mt-1" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted" />
                <label className="text-sm font-medium text-ink">Username</label>
              </div>
              <Input name="username" type="text" required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" autoComplete="username" className="mt-1" />
              <p className="text-[10px] text-muted mt-1">3–20 characters, letters, numbers, underscores only</p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted" />
                <label className="text-sm font-medium text-ink">Password</label>
              </div>
              <Input name="password" type="password" required minLength={8} autoComplete="new-password" showPasswordToggle className="mt-1" />
              <p className="text-[10px] text-muted mt-1">At least 8 characters</p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted" />
                <label className="text-sm font-medium text-ink">Confirm password</label>
              </div>
              <Input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" showPasswordToggle className="mt-1" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-muted" />
                <label className="text-sm font-medium text-ink">Referral code <span className="font-normal text-muted">(optional)</span></label>
              </div>
              <Input
                name="ref"
                type="text"
                maxLength={64}
                pattern="[a-zA-Z0-9_]*"
                autoComplete="off"
                placeholder="e.g. a friend's username"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                className="mt-1"
              />
              <p className="text-[10px] text-muted mt-1">Referral rewards stay disabled until qualification is approved.</p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="acceptTerms"
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-line bg-surface-2/60 text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span className="text-xs leading-relaxed text-muted">
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-accent underline">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent underline">Privacy Policy</a>.
              </span>
            </label>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/20 border border-red-500/30">
                <span className="text-red-400">!</span>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={loading} disabled={Boolean(closed)}>
              {loading ? 'Creating...' : 'Create account'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-line">
            <p className="text-center text-sm text-muted mb-4">Already have an account?</p>
            <a
              href="/login"
              onClick={(e) => { e.preventDefault(); navigate('/login') }}
              className="w-full flex items-center justify-center gap-2 text-sm text-accent underline"
            >
              Sign in <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className="mt-4">
            <p className="text-[10px] text-muted text-center">Free to play · Email verification is not required for the MVP</p>
          </div>
        </Card>
      </div>

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_1rem)] left-4 right-4 text-center pointer-events-none">
        <p className="text-[10px] text-muted">TycoonX &bull; Premium UI Preview</p>
      </div>
    </div>
  )
}

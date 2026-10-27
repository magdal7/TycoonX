import { useState } from 'react'
import { Mail, Lock, User, ArrowLeft, ChevronRight, Gift } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card } from '../components/ui/card'
import { LogoMark } from '../components/Logo'
import LanguageSelector from '../components/LanguageSelector'
import { usePublicSettings } from '../lib/siteSettings'
import { useT } from '../i18n'

type Props = { navigate: (p: string) => void }

export default function Register({ navigate }: Props) {
  const { register } = useAuth()
  const t = useT()
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
      setError(t('auth.passwordsMismatch'))
      return
    }
    if (!acceptTerms) {
      setError(t('auth.mustAccept'))
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
    if (res.error) setError(res.error || t('auth.register.failed'))
    else navigate('/dashboard')
  }

  const closed = settings.data && (!settings.data.registrationEnabled || settings.data.maintenance.enabled)

  return (
    <div className="min-h-screen bg-bg text-ink font-sans px-4 py-6 pb-[calc(env(safe-area-inset-bottom)_+_2rem)]">
      <div className="mb-6 flex items-center justify-between gap-3">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); navigate('/') }}
          className="flex items-center gap-2 text-accent/70 transition hover:text-accent"
          aria-label={t('auth.backHome')}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('auth.back')}
        </a>
        <LanguageSelector variant="compact" />
      </div>

      <div className="max-w-sm mx-auto">
        <div className="text-center mb-8">
          <LogoMark size={48} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">{t('auth.register.title')}</h1>
          <p className="text-muted text-sm mt-2">{t('auth.register.subtitle')}</p>
        </div>

        <Card padding="lg" hover={false} className="border border-line">
          {closed && (
            <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {settings.data?.maintenance.enabled
                ? settings.data.maintenance.message
                : t('auth.registrationClosed')}
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted" />
                <label className="text-sm font-medium text-ink">{t('auth.email')}</label>
              </div>
              <Input name="email" type="email" required autoComplete="email" className="mt-1" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted" />
                <label className="text-sm font-medium text-ink">{t('auth.username')}</label>
              </div>
              <Input name="username" type="text" required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" autoComplete="username" className="mt-1" />
              <p className="text-[10px] text-muted mt-1">{t('auth.usernameHint')}</p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted" />
                <label className="text-sm font-medium text-ink">{t('auth.password')}</label>
              </div>
              <Input name="password" type="password" required minLength={8} autoComplete="new-password" showPasswordToggle className="mt-1" />
              <p className="text-[10px] text-muted mt-1">{t('auth.passwordHint')}</p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted" />
                <label className="text-sm font-medium text-ink">{t('auth.confirmPassword')}</label>
              </div>
              <Input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" showPasswordToggle className="mt-1" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-muted" />
                <label className="text-sm font-medium text-ink">{t('auth.referralCode')} <span className="font-normal text-muted">{t('auth.optional')}</span></label>
              </div>
              <Input
                name="ref"
                type="text"
                maxLength={64}
                pattern="[a-zA-Z0-9_]*"
                autoComplete="off"
                placeholder={t('auth.referralPlaceholder')}
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                className="mt-1"
              />
              <p className="text-[10px] text-muted mt-1">
                {settings.data?.capabilities?.referralRewards === true
                  ? t('auth.referralActive')
                  : settings.data?.capabilities?.referralRewards === false
                    ? t('auth.referralInactive')
                    : t('auth.referralUnknown')}
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="acceptTerms"
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-line bg-surface-2/60 text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span className="text-xs leading-relaxed text-muted">
                {t('auth.agreePrefix')}{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-accent underline">{t('auth.terms')}</a>
                {' '}{t('auth.and')}{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent underline">{t('auth.privacy')}</a>.
              </span>
            </label>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/20 border border-red-500/30">
                <span className="text-red-400">!</span>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={loading} disabled={Boolean(closed)}>
              {loading ? t('auth.register.submitting') : t('auth.register.submit')}
              <ChevronRight className="ms-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-line">
            <p className="text-center text-sm text-muted mb-4">{t('auth.haveAccount')}</p>
            <a
              href="/login"
              onClick={(e) => { e.preventDefault(); navigate('/login') }}
              className="w-full flex items-center justify-center gap-2 text-sm text-accent underline"
            >
              {t('auth.signInLink')} <span aria-hidden="true" className="rtl:rotate-180">→</span>
            </a>
          </div>

          <div className="mt-4">
            <p className="text-[10px] text-muted text-center">{t('auth.noVerify')}</p>
          </div>
        </Card>
      </div>

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_1rem)] inset-x-4 text-center pointer-events-none">
        <p className="text-[10px] text-muted">TycoonX &bull; {t('brand.tagline')}</p>
      </div>
    </div>
  )
}

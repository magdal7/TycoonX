import { useState } from 'react'
import { Mail, Lock, ArrowLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card } from '../components/ui/card'
import { LogoMark } from '../components/Logo'
import LanguageSelector from '../components/LanguageSelector'
import { useT } from '../i18n'

type Props = { navigate: (p: string) => void }

export default function Login({ navigate }: Props) {
  const { login } = useAuth()
  const t = useT()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const email = fd.get('email') as string
    const password = fd.get('password') as string
    setLoading(true)
    setError('')
    const res = await login(email, password)
    setLoading(false)
    if (res.error) setError(res.error || t('auth.login.failed'))
    else navigate('/dashboard')
  }

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
          <h1 className="text-2xl font-bold tracking-tight">{t('auth.login.title')}</h1>
          <p className="text-muted text-sm mt-2">{t('auth.login.subtitle')}</p>
        </div>

        <Card padding="lg" hover={false} className="border border-line">
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
                <Lock className="h-5 w-5 text-muted" />
                <label className="text-sm font-medium text-ink">{t('auth.password')}</label>
              </div>
              <Input name="password" type="password" required minLength={8} autoComplete="current-password" showPasswordToggle className="mt-1" />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/20 border border-red-500/30">
                <span className="text-red-400">!</span>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={loading}>
              {loading ? t('auth.login.submitting') : t('auth.login.submit')}
              <ChevronRight className="ms-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-line">
            <p className="text-center text-sm text-muted mb-4">{t('auth.noAccount')}</p>
            <a
              href="/register"
              onClick={(e) => { e.preventDefault(); navigate('/register') }}
              className="w-full flex items-center justify-center gap-2 text-sm text-accent underline"
            >
              {t('auth.createAccountLink')} <span aria-hidden="true" className="rtl:rotate-180">→</span>
            </a>
          </div>

          <div className="mt-4">
            <p className="text-[10px] text-muted text-center">{t('auth.freeToPlay')}</p>
          </div>
        </Card>
      </div>

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_1rem)] inset-x-4 text-center pointer-events-none">
        <p className="text-[10px] text-muted">TycoonX &bull; {t('brand.tagline')}</p>
      </div>
    </div>
  )
}

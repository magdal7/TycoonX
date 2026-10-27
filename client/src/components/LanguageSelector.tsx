import { Globe } from 'lucide-react'
import { useI18n, type Locale } from '../i18n'
import { useT } from '../i18n'

/**
 * Language selector. Lists each language in its native name and persists the
 * choice (the provider writes localStorage + document lang/dir).
 */
export default function LanguageSelector({
  variant = 'default',
  className = ''
}: {
  variant?: 'default' | 'compact' | 'landing'
  className?: string
}) {
  const { locale, languages, setLocale } = useI18n()
  const t = useT()

  const base =
    variant === 'landing'
      ? 'rounded-xl border border-line bg-surface/70 px-3 py-2 text-sm text-ink outline-none focus:border-primary'
      : variant === 'compact'
        ? 'rounded-lg border border-line bg-surface-2/60 px-2 py-1.5 text-xs text-ink outline-none focus:border-primary'
        : 'w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm text-ink outline-none focus:border-primary'

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Globe className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <label className="sr-only" htmlFor="tycoonx-language">
        {t('language.label')}
      </label>
      <select
        id="tycoonx-language"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className={base}
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nativeName}
          </option>
        ))}
      </select>
    </div>
  )
}

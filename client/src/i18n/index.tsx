import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import en, { type Dictionary, type TranslationKey } from './locales/en'
import ar from './locales/ar'
import fr from './locales/fr'
import es from './locales/es'
import de from './locales/de'
import ptBR from './locales/pt-BR'
import tr from './locales/tr'
import ru from './locales/ru'
import { setFormatLocale } from '../lib/format'
import { resolvePlural, resolveTranslation, type Vars } from './translate'

export type Locale = 'en' | 'ar' | 'fr' | 'es' | 'de' | 'pt-BR' | 'tr' | 'ru'

export interface LanguageMeta {
  code: Locale
  /** Native display name, shown in the selector. */
  nativeName: string
  englishName: string
  dir: 'ltr' | 'rtl'
}

export const LANGUAGES: readonly LanguageMeta[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', dir: 'ltr' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr' },
]

const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  ar,
  fr,
  es,
  de,
  'pt-BR': ptBR,
  tr,
  ru,
}

export const STORAGE_KEY = 'tycoonx.lang'
export const DEFAULT_LOCALE: Locale = 'en'

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LANGUAGES as readonly LanguageMeta[]).some((l) => l.code === value)
}

/** Normalizes a BCP-47 tag (e.g. "pt-br", "en-US") to a supported locale. */
function matchLocale(tag: string): Locale | null {
  const lower = tag.toLowerCase()
  if (lower === 'pt-br' || lower.startsWith('pt')) return 'pt-BR'
  const base = lower.split('-')[0]
  const exact = LANGUAGES.find((l) => l.code.toLowerCase() === lower)
  if (exact) return exact.code
  const byBase = LANGUAGES.find((l) => l.code.toLowerCase() === base)
  return byBase ? byBase.code : null
}

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    /* storage unavailable — fall through */
  }
  return DEFAULT_LOCALE
}

function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return LANGUAGES.find((l) => l.code === locale)?.dir ?? 'ltr'
}

export interface I18nValue {
  locale: Locale
  dir: 'ltr' | 'rtl'
  languages: readonly LanguageMeta[]
  setLocale: (locale: Locale) => void
  /** Translate by key with optional `{placeholder}` variables. */
  t: (key: TranslationKey, vars?: Vars) => string
  /** Plural-aware translate: resolves `key.<category>` via Intl.PluralRules. */
  tp: (key: string, count: number, vars?: Vars) => string
  /** Locale-aware number formatting (never mutates stored values). */
  n: (value: number, options?: Intl.NumberFormatOptions) => string
  /** Locale-aware date/time formatting. */
  d: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof window === 'undefined' ? DEFAULT_LOCALE : readStoredLocale(),
  )

  const dir = dirFor(locale)

  useEffect(() => {
    const root = document.documentElement
    root.lang = locale
    root.dir = dir
    setFormatLocale(locale)
  }, [locale, dir])

  const setLocale = useCallback((next: Locale) => {
    const safe = isLocale(next) ? next : DEFAULT_LOCALE
    try {
      window.localStorage.setItem(STORAGE_KEY, safe)
    } catch {
      /* ignore storage failures */
    }
    setLocaleState(safe)
  }, [])

  const value = useMemo<I18nValue>(() => {
    const dict = DICTIONARIES[locale] ?? en
    const active = dict as unknown as Record<string, string>
    const fallback = en as unknown as Record<string, string>

    const t = (key: TranslationKey, vars?: Vars): string =>
      resolveTranslation(active, fallback, key, vars)

    const tp = (key: string, count: number, vars?: Vars): string =>
      resolvePlural(active, fallback, locale, key, count, vars)

    const n = (value: number, options?: Intl.NumberFormatOptions): string => {
      try {
        return new Intl.NumberFormat(locale, options).format(value)
      } catch {
        return String(value)
      }
    }

    const d = (value: string | number | Date, options?: Intl.DateTimeFormatOptions): string => {
      const date = value instanceof Date ? value : new Date(value)
      if (!Number.isFinite(date.getTime())) return ''
      try {
        return new Intl.DateTimeFormat(locale, options).format(date)
      } catch {
        return date.toLocaleString()
      }
    }

    return { locale, dir, languages: LANGUAGES, setLocale, t, tp, n, d }
  }, [locale, dir, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

/** Convenience hook returning only the translate function. */
export function useT(): I18nValue['t'] {
  return useI18n().t
}

export { matchLocale, isLocale }
export type { Dictionary, TranslationKey }

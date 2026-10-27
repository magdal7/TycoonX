/**
 * Pure translation helpers (no React / DOM), so they are unit-testable and
 * reusable. The i18n runtime and the automated tests share these.
 */
export type Vars = Record<string, string | number>

/** Replaces `{placeholder}` tokens; unknown tokens are left untouched. */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  )
}

/** CLDR plural category for a count, tolerant of bad locales. */
export function pluralCategory(locale: string, count: number): Intl.LDMLPluralRule {
  try {
    return new Intl.PluralRules(locale).select(count)
  } catch {
    return count === 1 ? 'one' : 'other'
  }
}

/** Resolves a key with English fallback, then interpolates variables. */
export function resolveTranslation(
  dict: Record<string, string>,
  fallback: Record<string, string>,
  key: string,
  vars?: Vars,
): string {
  return interpolate(dict[key] ?? fallback[key] ?? key, vars)
}

/** Resolves a plural key (`key.<category>` -> `key.other` -> `key`) with fallback. */
export function resolvePlural(
  dict: Record<string, string>,
  fallback: Record<string, string>,
  locale: string,
  key: string,
  count: number,
  vars?: Vars,
): string {
  const category = pluralCategory(locale, count)
  const candidates = [`${key}.${category}`, `${key}.other`, key]
  for (const candidate of candidates) {
    const raw = dict[candidate] ?? fallback[candidate]
    if (raw) return interpolate(raw, { ...vars, count })
  }
  return interpolate(key, { ...vars, count })
}

/** Sorted placeholder names found in a template (for parity checks). */
export function placeholdersOf(template: string): string[] {
  const out: string[] = []
  const re = /\{(\w+)\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(template)) !== null) out.push(match[1])
  return out.sort()
}

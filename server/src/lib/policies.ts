/**
 * Canonical policy version identifiers recorded with registration consent.
 *
 * Non-financial product metadata. Bump the matching version whenever the
 * corresponding policy page content changes so stored consent stays auditable.
 */
export const POLICY_VERSIONS = {
  terms: '1.0',
  privacy: '1.0',
} as const

export const POLICY_EFFECTIVE_DATE = '2026-10-19'

export type PolicyKind = keyof typeof POLICY_VERSIONS

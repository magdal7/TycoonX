import { createHash } from 'node:crypto'

const SALT = process.env.REFERRAL_FINGERPRINT_SALT ?? process.env.JWT_SECRET ?? 'tycoonx-referral'

/**
 * One-way fingerprint for abuse detection only (IP / user-agent). Never stores
 * or logs the raw value. Salted so hashes are not reversible via rainbow tables.
 */
export function hashFingerprint(value: string | undefined | null): string | null {
  if (!value) return null
  return createHash('sha256').update(`${value}:${SALT}`).digest('hex')
}

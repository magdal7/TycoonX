import { normalizeAsset, normalizeNetwork, type SupportedAssetNetwork } from './oxapayAssets'

/**
 * Pure comparison of TycoonX's deposit allowlist against live OxaPay data.
 * No I/O. Used by `npm run diag:oxapay` and unit tests.
 */

export interface ProviderCurrencyInput {
  symbol: string
  status: boolean
  networks: Array<{ network: string; name?: string }>
}

export interface AllowlistComparisonInput {
  providerCurrencies: ProviderCurrencyInput[]
  acceptedCurrencies?: string[]
  allowlist: readonly SupportedAssetNetwork[]
}

export interface AllowlistComparison {
  /** Allowlist pairs offered by the provider on an active asset. */
  allowlistMatched: string[]
  /** Allowlist pairs NOT offered by the provider (or asset inactive). */
  allowlistMissingFromProvider: string[]
  /** Active provider pairs that are not in the allowlist (informational). */
  providerExtraPairs: string[]
  /** Symbols returned by /payment/accepted-currencies. */
  acceptedByMerchant: string[]
  /** Merchant-accepted assets with no allowlist entry. */
  acceptedNotInAllowlist: string[]
  /** Allowlist assets the merchant has not accepted. */
  allowlistAssetsNotAccepted: string[]
}

function canonicalNetwork(net: { network: string; name?: string }): string | null {
  const normalized = normalizeNetwork(net.network) ?? (net.name ? normalizeNetwork(net.name) : null)
  if (normalized) return normalized
  // Keep unrecognized provider networks so they surface as extras rather than
  // being silently dropped from the comparison.
  const raw = typeof net.network === 'string' ? net.network.trim() : ''
  return raw === '' ? null : raw
}

export function compareAllowlistToProvider(input: AllowlistComparisonInput): AllowlistComparison {
  const active = new Map<string, Set<string>>()
  for (const currency of input.providerCurrencies) {
    if (!currency.status) continue
    const asset = normalizeAsset(currency.symbol)
    if (!asset) continue
    const networks = active.get(asset) ?? new Set<string>()
    for (const net of currency.networks) {
      const canonical = canonicalNetwork(net)
      if (canonical) networks.add(canonical)
    }
    active.set(asset, networks)
  }

  const allowlistMatched: string[] = []
  const allowlistMissingFromProvider: string[] = []
  const allowlistPairKeys = new Set<string>()
  const allowlistAssets = new Set<string>()

  for (const pair of input.allowlist) {
    const asset = normalizeAsset(pair.asset)
    const network = normalizeNetwork(pair.network) ?? pair.network
    if (!asset) continue
    allowlistAssets.add(asset)
    const key = `${asset}/${network}`
    allowlistPairKeys.add(key)
    const networks = active.get(asset)
    if (networks && networks.has(network)) allowlistMatched.push(key)
    else allowlistMissingFromProvider.push(key)
  }

  const providerExtraPairs: string[] = []
  for (const [asset, networks] of active) {
    for (const network of networks) {
      const key = `${asset}/${network}`
      if (!allowlistPairKeys.has(key)) providerExtraPairs.push(key)
    }
  }

  const acceptedByMerchant = (input.acceptedCurrencies ?? [])
    .map((symbol) => normalizeAsset(symbol))
    .filter((symbol): symbol is string => Boolean(symbol))
  const acceptedSet = new Set(acceptedByMerchant)

  return {
    allowlistMatched: allowlistMatched.sort(),
    allowlistMissingFromProvider: allowlistMissingFromProvider.sort(),
    providerExtraPairs: providerExtraPairs.sort(),
    acceptedByMerchant,
    acceptedNotInAllowlist: [...acceptedSet].filter((asset) => !allowlistAssets.has(asset)).sort(),
    allowlistAssetsNotAccepted: [...allowlistAssets].filter((asset) => !acceptedSet.has(asset)).sort(),
  }
}

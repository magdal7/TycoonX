/**
 * Centralized OxaPay deposit asset/network allowlist (pure, no I/O).
 *
 * Identifiers are verified against the live provider API:
 *  - `GET /common/currencies` (public) returned network codes Ethereum, Tron,
 *    BSC, Solana, Polygon, The Open Network, Bitcoin, Dogecoin, Litecoin,
 *    BitcoinCash, xrpl.
 *  - `GET /payment/accepted-currencies` (authenticated) returned the merchant's
 *    enabled symbols: BTC, ETH, USDT, USDC, BNB, DOGE, POL, LTC, SOL, TRX, GRAM,
 *    BCH, XRP.
 *
 * Legacy OxaPay docs used ERC20/TRC20/BEP20 codes; those are kept as aliases so
 * either convention normalizes to the live canonical code. Unlisted pairs fail
 * closed. Re-verify with `npm run diag:oxapay` before go-live.
 */

export interface SupportedAssetNetwork {
  asset: string
  network: string
  networkName: string
}

/** Verified deposit pairs (asset + live canonical network code). */
export const SUPPORTED_DEPOSIT_PAIRS: readonly SupportedAssetNetwork[] = [
  { asset: 'USDT', network: 'Ethereum', networkName: 'Ethereum Network' },
  { asset: 'USDT', network: 'Tron', networkName: 'Tron Network' },
  { asset: 'USDT', network: 'BSC', networkName: 'Binance Smart Chain' },
  { asset: 'USDT', network: 'Solana', networkName: 'Solana Network' },
  { asset: 'USDT', network: 'Polygon', networkName: 'Polygon Network' },
  { asset: 'USDC', network: 'Ethereum', networkName: 'Ethereum Network' },
  { asset: 'USDC', network: 'BSC', networkName: 'Binance Smart Chain' },
  { asset: 'USDC', network: 'Solana', networkName: 'Solana Network' },
  { asset: 'USDC', network: 'Polygon', networkName: 'Polygon Network' },
  { asset: 'BTC', network: 'Bitcoin', networkName: 'Bitcoin Network' },
  { asset: 'ETH', network: 'Ethereum', networkName: 'Ethereum Network' },
  { asset: 'BNB', network: 'BSC', networkName: 'Binance Smart Chain' },
  { asset: 'DOGE', network: 'Dogecoin', networkName: 'Dogecoin Network' },
  { asset: 'POL', network: 'Polygon', networkName: 'Polygon Network' },
  { asset: 'LTC', network: 'Litecoin', networkName: 'Litecoin Network' },
  { asset: 'SOL', network: 'Solana', networkName: 'Solana Network' },
  { asset: 'TRX', network: 'Tron', networkName: 'Tron Network' },
  { asset: 'BCH', network: 'BitcoinCash', networkName: 'Bitcoin Cash Network' },
  { asset: 'XRP', network: 'xrpl', networkName: 'Ripple' },
  { asset: 'GRAM', network: 'The Open Network', networkName: 'TON Network' },
]

/**
 * Aliases built only from verified provider identifiers: live codes, live
 * network names, and the legacy OxaPay doc codes.
 */
const NETWORK_ALIASES: Readonly<Record<string, string>> = {
  // live canonical codes
  ethereum: 'Ethereum',
  tron: 'Tron',
  bsc: 'BSC',
  solana: 'Solana',
  polygon: 'Polygon',
  'the open network': 'The Open Network',
  bitcoin: 'Bitcoin',
  dogecoin: 'Dogecoin',
  litecoin: 'Litecoin',
  bitcoincash: 'BitcoinCash',
  xrpl: 'xrpl',
  // live human-readable names
  'ethereum network': 'Ethereum',
  'tron network': 'Tron',
  'binance smart chain': 'BSC',
  'solana network': 'Solana',
  'polygon network': 'Polygon',
  'ton network': 'The Open Network',
  'bitcoin network': 'Bitcoin',
  'dogecoin network': 'Dogecoin',
  'litecoin network': 'Litecoin',
  'bitcoin cash network': 'BitcoinCash',
  ripple: 'xrpl',
  // legacy OxaPay doc codes
  erc20: 'Ethereum',
  trc20: 'Tron',
  bep20: 'BSC',
  // legacy OxaPay doc names
  'ethereum (erc20)': 'Ethereum',
  'tron (trc20)': 'Tron',
  'bnb smart chain (bep20)': 'BSC',
  'bnb smart chain': 'BSC',
  'bitcoin cash': 'BitcoinCash',
}

const PAIR_SET = new Set(SUPPORTED_DEPOSIT_PAIRS.map((p) => `${p.asset}/${p.network}`))

/** Normalizes an asset symbol (uppercase, trimmed); null when empty/invalid. */
export function normalizeAsset(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const asset = raw.trim().toUpperCase()
  return asset === '' ? null : asset
}

/** Resolves a provider network code or name to its canonical code; null otherwise. */
export function normalizeNetwork(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (key === '') return null
  return NETWORK_ALIASES[key] ?? null
}

/** True only when the (asset, network) pair is verified and allowed. */
export function isSupportedDepositPair(asset: unknown, network: unknown): boolean {
  const normalizedAsset = normalizeAsset(asset)
  const normalizedNetwork = normalizeNetwork(network)
  if (!normalizedAsset || !normalizedNetwork) return false
  return PAIR_SET.has(`${normalizedAsset}/${normalizedNetwork}`)
}

/** Canonical networks allowed for an asset (empty when the asset is unsupported). */
export function supportedNetworksFor(asset: unknown): string[] {
  const normalizedAsset = normalizeAsset(asset)
  if (!normalizedAsset) return []
  return SUPPORTED_DEPOSIT_PAIRS.filter((p) => p.asset === normalizedAsset).map((p) => p.network)
}

/** True when the asset appears in the allowlist on at least one network. */
export function isSupportedAsset(asset: unknown): boolean {
  return supportedNetworksFor(asset).length > 0
}

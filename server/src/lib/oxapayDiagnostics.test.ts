import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareAllowlistToProvider } from './oxapayDiagnostics'
import { SUPPORTED_DEPOSIT_PAIRS } from './oxapayAssets'

// Fixture shaped like the live GET /common/currencies response (subset).
const PROVIDER = [
  {
    symbol: 'USDT',
    status: true,
    networks: [
      { network: 'Ethereum' },
      { network: 'Tron' },
      { network: 'BSC' },
      { network: 'Solana' },
      { network: 'Polygon' },
      { network: 'The Open Network' },
    ],
  },
  {
    symbol: 'USDC',
    status: true,
    networks: [
      { network: 'Ethereum' },
      { network: 'BSC' },
      { network: 'Solana' },
      { network: 'Polygon' },
      { network: 'Base' },
    ],
  },
  { symbol: 'BTC', status: true, networks: [{ network: 'Bitcoin' }] },
  { symbol: 'POL', status: true, networks: [{ network: 'Polygon' }] },
  { symbol: 'GRAM', status: true, networks: [{ network: 'The Open Network' }] },
  { symbol: 'DAI', status: true, networks: [{ network: 'Ethereum' }] },
  { symbol: 'BUSD', status: false, networks: [] },
]

test('comparison reports matched allowlist pairs against live provider data', () => {
  const report = compareAllowlistToProvider({
    providerCurrencies: PROVIDER,
    acceptedCurrencies: ['BTC', 'USDT', 'POL', 'DAI'],
    allowlist: SUPPORTED_DEPOSIT_PAIRS,
  })
  for (const key of [
    'USDT/Ethereum',
    'USDT/Tron',
    'USDT/BSC',
    'USDT/Solana',
    'USDT/Polygon',
    'USDC/Ethereum',
    'USDC/BSC',
    'USDC/Solana',
    'USDC/Polygon',
    'BTC/Bitcoin',
    'POL/Polygon',
    'GRAM/The Open Network',
  ]) {
    assert.ok(report.allowlistMatched.includes(key), `expected matched ${key}`)
  }
  assert.ok(!report.providerExtraPairs.some((key) => key.startsWith('BUSD')))
})

test('comparison reports allowlist pairs missing from the provider', () => {
  const report = compareAllowlistToProvider({ providerCurrencies: PROVIDER, allowlist: SUPPORTED_DEPOSIT_PAIRS })
  for (const key of [
    'ETH/Ethereum',
    'BNB/BSC',
    'DOGE/Dogecoin',
    'LTC/Litecoin',
    'SOL/Solana',
    'TRX/Tron',
    'BCH/BitcoinCash',
    'XRP/xrpl',
  ]) {
    assert.ok(report.allowlistMissingFromProvider.includes(key), `expected missing ${key}`)
  }
})

test('comparison reports provider extras and merchant acceptance gaps', () => {
  const report = compareAllowlistToProvider({
    providerCurrencies: PROVIDER,
    acceptedCurrencies: ['BTC', 'USDT', 'POL', 'DAI'],
    allowlist: SUPPORTED_DEPOSIT_PAIRS,
  })
  assert.ok(report.providerExtraPairs.includes('USDT/The Open Network'))
  assert.ok(report.providerExtraPairs.includes('USDC/Base'))
  assert.ok(report.providerExtraPairs.includes('DAI/Ethereum'))
  assert.deepEqual(report.acceptedNotInAllowlist, ['DAI'])
  assert.ok(report.allowlistAssetsNotAccepted.includes('USDC'))
  assert.ok(!report.allowlistAssetsNotAccepted.includes('USDT'))
})

test('comparison normalizes legacy network aliases in provider data', () => {
  const report = compareAllowlistToProvider({
    providerCurrencies: [{ symbol: 'USDT', status: true, networks: [{ network: 'TRC20' }] }],
    allowlist: SUPPORTED_DEPOSIT_PAIRS,
  })
  assert.ok(report.allowlistMatched.includes('USDT/Tron'))
})

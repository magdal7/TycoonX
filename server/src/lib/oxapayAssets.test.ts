import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SUPPORTED_DEPOSIT_PAIRS,
  isSupportedAsset,
  isSupportedDepositPair,
  normalizeAsset,
  normalizeNetwork,
  supportedNetworksFor,
} from './oxapayAssets'

test('allowlist contains the verified live asset/network pairs', () => {
  const pairs = SUPPORTED_DEPOSIT_PAIRS.map((p) => `${p.asset}/${p.network}`)
  for (const expected of [
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
    'ETH/Ethereum',
    'BNB/BSC',
    'DOGE/Dogecoin',
    'POL/Polygon',
    'LTC/Litecoin',
    'SOL/Solana',
    'TRX/Tron',
    'BCH/BitcoinCash',
    'XRP/xrpl',
    'GRAM/The Open Network',
  ]) {
    assert.ok(pairs.includes(expected), `missing ${expected}`)
  }
})

test('normalizeAsset uppercases and trims, rejecting non-strings/empty', () => {
  assert.equal(normalizeAsset('usdt'), 'USDT')
  assert.equal(normalizeAsset('  Btc '), 'BTC')
  assert.equal(normalizeAsset(''), null)
  assert.equal(normalizeAsset(42), null)
})

test('normalizeNetwork resolves live codes, live names and legacy codes/names', () => {
  // live codes
  assert.equal(normalizeNetwork('Ethereum'), 'Ethereum')
  assert.equal(normalizeNetwork('Tron'), 'Tron')
  assert.equal(normalizeNetwork('BSC'), 'BSC')
  assert.equal(normalizeNetwork('The Open Network'), 'The Open Network')
  assert.equal(normalizeNetwork('xrpl'), 'xrpl')
  // live names
  assert.equal(normalizeNetwork('Ethereum Network'), 'Ethereum')
  assert.equal(normalizeNetwork('Binance Smart Chain'), 'BSC')
  assert.equal(normalizeNetwork('Polygon Network'), 'Polygon')
  assert.equal(normalizeNetwork('TON Network'), 'The Open Network')
  assert.equal(normalizeNetwork('Ripple'), 'xrpl')
  // legacy codes/names
  assert.equal(normalizeNetwork('ERC20'), 'Ethereum')
  assert.equal(normalizeNetwork('TRC20'), 'Tron')
  assert.equal(normalizeNetwork('BEP20'), 'BSC')
  assert.equal(normalizeNetwork('BNB Smart Chain (Bep20)'), 'BSC')
  // unknown
  assert.equal(normalizeNetwork('BSC Mainnet'), null)
  assert.equal(normalizeNetwork(''), null)
})

test('isSupportedDepositPair accepts verified pairs only', () => {
  assert.equal(isSupportedDepositPair('USDT', 'BSC'), true)
  assert.equal(isSupportedDepositPair('usdt', 'Binance Smart Chain'), true)
  assert.equal(isSupportedDepositPair('USDT', 'BEP20'), true) // legacy alias
  assert.equal(isSupportedDepositPair('USDC', 'Solana'), true)
  assert.equal(isSupportedDepositPair('XRP', 'xrpl'), true)
  assert.equal(isSupportedDepositPair('GRAM', 'The Open Network'), true)
  assert.equal(isSupportedDepositPair('BTC', 'Ethereum'), false)
  assert.equal(isSupportedDepositPair('USDC', 'Dogecoin'), false)
  assert.equal(isSupportedDepositPair(undefined, 'BSC'), false)
})

test('supportedNetworksFor and isSupportedAsset reflect the allowlist', () => {
  assert.deepEqual(supportedNetworksFor('usdt').sort(), ['BSC', 'Ethereum', 'Polygon', 'Solana', 'Tron'])
  assert.deepEqual(supportedNetworksFor('usdc').sort(), ['BSC', 'Ethereum', 'Polygon', 'Solana'])
  assert.equal(isSupportedAsset('POL'), true)
  assert.equal(isSupportedAsset('XRP'), true)
  assert.equal(isSupportedAsset('GRAM'), true)
  assert.equal(isSupportedAsset('DAI'), false)
})

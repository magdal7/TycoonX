import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import {
  createInvoice,
  getAcceptedCurrencies,
  getSupportedCurrencies,
  loadOxapayConfig,
  type OxapayConfig,
} from '../services/oxapay'
import { compareAllowlistToProvider } from '../lib/oxapayDiagnostics'
import { SUPPORTED_DEPOSIT_PAIRS } from '../lib/oxapayAssets'

/**
 * Development diagnostics only.
 *
 * Default mode (read-only): queries `GET /common/currencies` (public) and
 * `GET /payment/accepted-currencies` (authenticated) and compares them with
 * TycoonX's allowlist.
 *
 * `--sandbox-invoice`: additionally creates ONE clearly labelled SANDBOX invoice
 * (requires `OXAPAY_SANDBOX=true`) and prints the actual response fields. It
 * refuses to run unless sandbox mode is enabled, never creates live invoices,
 * never persists an intent, never credits balances, and never calls payout
 * endpoints. The API key is never printed.
 *
 * Run from the server workspace:
 *   npm run diag:oxapay
 *   npm run diag:oxapay -- --sandbox-invoice
 */

/** Masks an opaque provider identifier, keeping only a short prefix/suffix. */
function maskIdentifier(value: string): string {
  if (value.length <= 6) return '*'.repeat(value.length)
  return `${value.slice(0, 3)}…${value.slice(-2)}`
}

/** Masks a URL to scheme + host, hiding path/query (may contain identifiers). */
function maskUrl(value: string): string {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}/…`
  } catch {
    return '…'
  }
}

async function runAllowlistComparison(config: OxapayConfig) {
  const [currencies, accepted] = await Promise.all([
    getSupportedCurrencies(config),
    getAcceptedCurrencies(config),
  ])

  const report = compareAllowlistToProvider({
    providerCurrencies: currencies.map((c) => ({
      symbol: c.symbol,
      status: c.status,
      networks: c.networks.map((n) => ({ network: n.network, name: n.name })),
    })),
    acceptedCurrencies: accepted,
    allowlist: SUPPORTED_DEPOSIT_PAIRS,
  })

  console.log(
    JSON.stringify(
      {
        providerCurrencyCount: currencies.length,
        allowlistMatched: report.allowlistMatched,
        allowlistMissingFromProvider: report.allowlistMissingFromProvider,
        providerExtraPairs: report.providerExtraPairs,
        acceptedByMerchant: report.acceptedByMerchant,
        acceptedNotInAllowlist: report.acceptedNotInAllowlist,
        allowlistAssetsNotAccepted: report.allowlistAssetsNotAccepted,
      },
      null,
      2,
    ),
  )
}

async function runSandboxInvoice(config: OxapayConfig) {
  if (!config.sandbox) {
    console.error('Sandbox invoice refused: OXAPAY_SANDBOX is not enabled.')
    process.exitCode = 1
    return
  }

  const result = await createInvoice(config, {
    amountUsdt: '1.00',
    orderId: `diag_${randomUUID()}`,
    description: 'TycoonX SANDBOX diagnostic - no value',
    lifetimeMinutes: 15,
  })

  console.log(
    JSON.stringify(
      {
        mode: 'sandbox',
        description: 'TycoonX SANDBOX diagnostic - no value',
        responseFields: {
          trackId: maskIdentifier(result.trackId),
          paymentUrl: maskUrl(result.paymentUrl),
          expiredAt: result.expiredAt,
          createdAt: result.createdAt,
        },
        responseFieldTypes: {
          trackId: typeof result.trackId,
          paymentUrl: typeof result.paymentUrl,
          expiredAt: result.expiredAt === null ? 'null' : typeof result.expiredAt,
          createdAt: result.createdAt === null ? 'null' : typeof result.createdAt,
        },
      },
      null,
      2,
    ),
  )
}

async function main() {
  const config = loadOxapayConfig()
  if (!config.merchantApiKey) {
    console.error('OXAPAY_MERCHANT_API_KEY is not configured; skipping authenticated diagnostics.')
    process.exitCode = 1
    return
  }

  if (process.argv.includes('--sandbox-invoice')) {
    await runSandboxInvoice(config)
    return
  }

  await runAllowlistComparison(config)
}

main().catch((error) => {
  // Errors carry only provider status/type/key summaries, never the API key.
  console.error('OxaPay diagnostics failed:', error instanceof Error ? error.message : 'unknown error')
  process.exitCode = 1
})

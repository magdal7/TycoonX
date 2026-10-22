import {
  normalizePaymentStatus,
  normalizePayoutStatus,
  toDecimalString,
  type NormalizedPaymentStatus,
  type NormalizedPayoutStatus,
} from '../lib/oxapay'

/**
 * OxaPay v1 REST adapter (server-side only).
 *
 * This module performs no network calls at import time and is not wired to any
 * route, deposit crediting or payout execution. The payment gates
 * (`PAYMENTS_ENABLED` / `PAYOUTS_ENABLED` in `lib/payments`) remain authoritative
 * and must stay false. API keys and raw provider responses are never logged.
 *
 * Verified endpoints (docs.oxapay.com, v1):
 *  - POST /payment/invoice          header merchant_api_key
 *  - GET  /payment/{track_id}       header merchant_api_key
 *  - POST /payout                   header payout_api_key
 *  - GET  /payout/{track_id}        header payout_api_key
 */

export type OxapayErrorCode =
  | 'not_configured'
  | 'invalid_amount'
  | 'invalid_input'
  | 'provider_error'
  | 'network_error'
  | 'timeout'
  | 'invalid_response'

/** Safe error type: never carries API keys, signatures or full provider payloads. */
export class OxapayError extends Error {
  readonly code: OxapayErrorCode
  readonly status?: number
  constructor(code: OxapayErrorCode, message?: string, status?: number) {
    super(message ?? code)
    this.name = 'OxapayError'
    this.code = code
    this.status = status
  }
}

export interface OxapayFetchInit {
  method: 'GET' | 'POST'
  headers: Record<string, string>
  body?: string
  signal?: unknown
}

export interface OxapayFetchResponse {
  ok: boolean
  status: number
  text(): Promise<string>
}

export type OxapayFetch = (url: string, init: OxapayFetchInit) => Promise<OxapayFetchResponse>

export interface OxapayConfig {
  merchantApiKey?: string
  payoutApiKey?: string
  generalApiKey?: string
  baseUrl: string
  sandbox: boolean
  timeoutMs: number
  callbackUrl?: string
  fetch: OxapayFetch
}

export const DEFAULT_OXAPAY_BASE_URL = 'https://api.oxapay.com/v1'
export const DEFAULT_OXAPAY_TIMEOUT_MS = 10_000

const defaultFetch: OxapayFetch = (url, init) => {
  const impl = (globalThis as { fetch?: OxapayFetch }).fetch
  if (!impl) return Promise.reject(new OxapayError('not_configured', 'global fetch is unavailable'))
  return impl(url, init)
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }
  return undefined
}

/** Loads OxaPay config from the environment. Missing keys are not fatal here;
 *  each operation fails closed when its required key is absent. */
export function loadOxapayConfig(
  env: Record<string, string | undefined> = process.env,
  overrides: Partial<OxapayConfig> = {},
): OxapayConfig {
  const sandboxRaw = (env.OXAPAY_SANDBOX ?? '').trim().toLowerCase()
  const timeoutRaw = Number(env.OXAPAY_TIMEOUT_MS)
  const timeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.floor(timeoutRaw) : DEFAULT_OXAPAY_TIMEOUT_MS
  return {
    merchantApiKey: optionalString(env.OXAPAY_MERCHANT_API_KEY),
    payoutApiKey: optionalString(env.OXAPAY_PAYOUT_API_KEY),
    generalApiKey: optionalString(env.OXAPAY_GENERAL_API_KEY),
    baseUrl: optionalString(env.OXAPAY_BASE_URL) ?? DEFAULT_OXAPAY_BASE_URL,
    sandbox: sandboxRaw === 'true' || sandboxRaw === '1',
    timeoutMs,
    callbackUrl: optionalString(env.OXAPAY_CALLBACK_URL),
    fetch: defaultFetch,
    ...overrides,
  }
}

interface OxapayErrorBody {
  type?: unknown
  key?: unknown
}

interface OxapayEnvelope {
  data?: Record<string, unknown>
  message?: unknown
  error?: OxapayErrorBody | null
  status?: number
}

function providerErrorSummary(envelope: OxapayEnvelope | null, httpStatus: number): string {
  const parts = [`provider responded with status ${httpStatus}`]
  const type = optionalString(envelope?.error?.type)
  const key = optionalString(envelope?.error?.key)
  if (type) parts.push(`type=${type}`)
  if (key) parts.push(`key=${key}`)
  return parts.join(' ')
}

/**
 * OxaPay v1 success envelopes include `"error": {}` (an empty object). Only a
 * non-empty error object or a non-empty error string indicates a real failure.
 */
function hasProviderError(error: unknown): boolean {
  if (error === null || error === undefined) return false
  if (typeof error === 'string') return error.trim() !== ''
  if (typeof error === 'object') return Object.keys(error as Record<string, unknown>).length > 0
  return true
}

interface RequestOptions {
  path: string
  method: 'GET' | 'POST'
  apiKey?: string
  headerName: string
  body?: Record<string, unknown>
  /** Defaults to true. Set false only for documented public endpoints. */
  requiresKey?: boolean
}

async function request(config: OxapayConfig, options: RequestOptions): Promise<OxapayEnvelope> {
  const requiresKey = options.requiresKey ?? true
  if (requiresKey && !options.apiKey) {
    throw new OxapayError('not_configured', `missing API key for ${options.method} ${options.path}`)
  }

  const controller = makeAbortController()
  const url = `${config.baseUrl}${options.path}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.apiKey) headers[options.headerName] = options.apiKey
  const init: OxapayFetchInit = {
    method: options.method,
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    ...(controller ? { signal: controller.signal } : {}),
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort()
      reject(new OxapayError('timeout', `provider request timed out after ${config.timeoutMs}ms`))
    }, config.timeoutMs)
  })

  let response: OxapayFetchResponse
  try {
    const pending = config.fetch(url, init)
    // Prevent an unhandled rejection if the request settles after the timeout.
    pending.catch(() => {})
    response = await Promise.race([pending, timeout])
  } catch (error) {
    if (error instanceof OxapayError) throw error
    throw new OxapayError('network_error', 'provider request failed')
  } finally {
    if (timer) clearTimeout(timer)
  }

  const raw = await response.text()
  let parsed: OxapayEnvelope | null = null
  if (raw) {
    try {
      parsed = JSON.parse(raw) as OxapayEnvelope
    } catch {
      throw new OxapayError('invalid_response', `provider returned non-JSON (status ${response.status})`, response.status)
    }
  }

  const envelope = parsed ?? {}
  const envelopeStatus = typeof envelope.status === 'number' ? envelope.status : undefined
  const failed = !response.ok || (envelopeStatus !== undefined && envelopeStatus >= 400) || hasProviderError(envelope.error)
  if (failed) {
    throw new OxapayError('provider_error', providerErrorSummary(envelope, response.status), response.status)
  }
  return envelope
}

function makeAbortController(): { signal: unknown; abort(): void } | undefined {
  const Controller = (
    globalThis as { AbortController?: new () => { signal: unknown; abort(): void } }
  ).AbortController
  if (!Controller) return undefined
  try {
    return new Controller()
  } catch {
    return undefined
  }
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'bigint') return value.toString()
  return undefined
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Serializes a decimal amount as a JSON number, rejecting values that cannot be
 *  represented exactly (round-trip check) so no amount is silently altered. */
function amountToJsonNumber(amount: string | number | bigint): number {
  let canonical: string
  try {
    canonical = toDecimalString(amount)
  } catch {
    throw new OxapayError('invalid_amount', 'amount must be a decimal string')
  }
  const value = Number(canonical)
  if (!Number.isFinite(value) || value <= 0) {
    throw new OxapayError('invalid_amount', 'amount must be a positive decimal')
  }
  if (String(value) !== canonical) {
    throw new OxapayError('invalid_amount', 'amount is not exactly representable')
  }
  return value
}

// ---------------------------------------------------------------------------
// Payment (merchant) service
// ---------------------------------------------------------------------------

export interface CreateInvoiceInput {
  amountUsdt: string | number | bigint
  orderId?: string
  callbackUrl?: string
  returnUrl?: string
  description?: string
  lifetimeMinutes?: number
  /**
   * When set, explicitly sends `fee_paid_by_payer` (1 = payer pays the fee,
   * 0 = merchant pays). Omitted means inherit the merchant dashboard setting.
   */
  feePaidByPayer?: boolean
}

export interface InvoiceResult {
  trackId: string
  paymentUrl: string
  expiredAt: number | null
  createdAt: number | null
}

export async function createInvoice(
  config: OxapayConfig,
  input: CreateInvoiceInput,
): Promise<InvoiceResult> {
  const body: Record<string, unknown> = {
    amount: amountToJsonNumber(input.amountUsdt),
    sandbox: config.sandbox,
  }
  if (input.orderId) body.order_id = input.orderId
  if (input.callbackUrl) body.callback_url = input.callbackUrl
  if (input.returnUrl) body.return_url = input.returnUrl
  if (input.description) body.description = input.description
  if (input.lifetimeMinutes !== undefined) body.lifetime = input.lifetimeMinutes
  if (input.feePaidByPayer !== undefined) body.fee_paid_by_payer = input.feePaidByPayer ? 1 : 0

  const envelope = await request(config, {
    path: '/payment/invoice',
    method: 'POST',
    apiKey: config.merchantApiKey,
    headerName: 'merchant_api_key',
    body,
  })

  const data = envelope.data ?? {}
  const trackId = asString(data.track_id)
  const paymentUrl = asString(data.payment_url)
  if (!trackId || !paymentUrl) {
    throw new OxapayError('invalid_response', 'invoice response missing track_id or payment_url')
  }
  return {
    trackId,
    paymentUrl,
    expiredAt: asNumber(data.expired_at),
    createdAt: asNumber(data.date),
  }
}

export interface OxapayTransaction {
  txHash?: string
  amount?: string
  currency?: string
  network?: string
  address?: string
  status?: string
  confirmations?: number
  date?: number
}

export interface PaymentInfo {
  trackId: string
  status: NormalizedPaymentStatus | null
  rawStatus: string
  amount?: string
  currency?: string
  orderId?: string
  expiredAt: number | null
  createdAt: number | null
  transactions: OxapayTransaction[]
}

function mapTransaction(value: unknown): OxapayTransaction {
  const row = (value ?? {}) as Record<string, unknown>
  const tx: OxapayTransaction = {}
  const txHash = asString(row.tx_hash)
  if (txHash) tx.txHash = txHash
  const amount = asString(row.amount)
  if (amount) tx.amount = amount
  const currency = asString(row.currency)
  if (currency) tx.currency = currency
  const network = asString(row.network)
  if (network) tx.network = network
  const address = asString(row.address)
  if (address) tx.address = address
  const status = asString(row.status)
  if (status) tx.status = status
  const confirmations = asNumber(row.confirmations)
  if (confirmations !== null) tx.confirmations = confirmations
  const date = asNumber(row.date)
  if (date !== null) tx.date = date
  return tx
}

export async function getPaymentInfo(config: OxapayConfig, trackId: string): Promise<PaymentInfo> {
  const id = optionalString(trackId)
  if (!id) throw new OxapayError('invalid_input', 'trackId is required')

  const envelope = await request(config, {
    path: `/payment/${encodeURIComponent(id)}`,
    method: 'GET',
    apiKey: config.merchantApiKey,
    headerName: 'merchant_api_key',
  })

  const data = envelope.data ?? {}
  const rawStatus = asString(data.status) ?? ''
  return {
    trackId: asString(data.track_id) ?? id,
    status: normalizePaymentStatus(rawStatus),
    rawStatus,
    amount: asString(data.amount),
    currency: asString(data.currency),
    orderId: asString(data.order_id),
    expiredAt: asNumber(data.expired_at),
    createdAt: asNumber(data.date),
    transactions: Array.isArray(data.txs) ? data.txs.map(mapTransaction) : [],
  }
}

// ---------------------------------------------------------------------------
// Common / diagnostics (read-only; no invoices, payments or payouts)
// ---------------------------------------------------------------------------

export interface ProviderCurrencyNetwork {
  /** Network key as returned by the provider. */
  key: string
  /** Documented network identifier (e.g. Ethereum, Tron, BSC, Solana, Polygon). */
  network: string
  /** Human-readable network name (e.g. "Ethereum Network"). */
  name: string
  depositMin?: string
}

export interface ProviderCurrency {
  symbol: string
  name?: string
  status: boolean
  networks: ProviderCurrencyNetwork[]
}

/** GET /common/currencies — public, read-only list of supported assets/networks. */
export async function getSupportedCurrencies(config: OxapayConfig): Promise<ProviderCurrency[]> {
  const envelope = await request(config, {
    path: '/common/currencies',
    method: 'GET',
    headerName: 'merchant_api_key',
    requiresKey: false,
  })

  const data = envelope.data ?? {}
  const result: ProviderCurrency[] = []
  for (const [symbol, raw] of Object.entries(data)) {
    const row = (raw ?? {}) as Record<string, unknown>
    const networkSource =
      row.networks && typeof row.networks === 'object'
        ? (row.networks as Record<string, unknown>)
        : row.networkList && typeof row.networkList === 'object'
          ? (row.networkList as Record<string, unknown>)
          : {}
    const networks: ProviderCurrencyNetwork[] = Object.entries(networkSource).map(([key, value]) => {
      const net = (value ?? {}) as Record<string, unknown>
      return {
        key,
        network: asString(net.network) ?? key,
        name: asString(net.name) ?? '',
        ...(asString(net.deposit_min) ? { depositMin: asString(net.deposit_min) } : {}),
      }
    })
    result.push({ symbol, name: asString(row.name), status: row.status === true, networks })
  }
  return result
}

/** GET /payment/accepted-currencies — authenticated, read-only merchant allowlist. */
export async function getAcceptedCurrencies(config: OxapayConfig): Promise<string[]> {
  const envelope = await request(config, {
    path: '/payment/accepted-currencies',
    method: 'GET',
    apiKey: config.merchantApiKey,
    headerName: 'merchant_api_key',
  })

  const data = envelope.data ?? {}
  const list = Array.isArray(data.list) ? data.list : []
  return list
    .map((value) => asString(value))
    .filter((value): value is string => Boolean(value))
}

// ---------------------------------------------------------------------------
// Payout service (prepared only — never invoked by withdrawal execution)
// ---------------------------------------------------------------------------

export interface CreatePayoutInput {
  address: string
  currency: string
  amount: string | number | bigint
  network?: string
  callbackUrl?: string
  memo?: string
  description?: string
}

export interface PayoutResult {
  trackId: string
  status: NormalizedPayoutStatus | null
  rawStatus: string
}

export async function createPayout(config: OxapayConfig, input: CreatePayoutInput): Promise<PayoutResult> {
  const address = optionalString(input.address)
  const currency = optionalString(input.currency)
  if (!address) throw new OxapayError('invalid_input', 'address is required')
  if (!currency) throw new OxapayError('invalid_input', 'currency is required')

  const body: Record<string, unknown> = {
    address,
    currency,
    amount: amountToJsonNumber(input.amount),
  }
  if (input.network) body.network = input.network
  if (input.callbackUrl) body.callback_url = input.callbackUrl
  if (input.memo) body.memo = input.memo
  if (input.description) body.description = input.description

  const envelope = await request(config, {
    path: '/payout',
    method: 'POST',
    apiKey: config.payoutApiKey,
    headerName: 'payout_api_key',
    body,
  })

  const data = envelope.data ?? {}
  const trackId = asString(data.track_id)
  if (!trackId) throw new OxapayError('invalid_response', 'payout response missing track_id')
  const rawStatus = asString(data.status) ?? ''
  return { trackId, status: normalizePayoutStatus(rawStatus), rawStatus }
}

export interface PayoutInfo {
  trackId: string
  status: NormalizedPayoutStatus | null
  rawStatus: string
  address?: string
  currency?: string
  network?: string
  amount?: string
  fee?: string
  txHash?: string
  description?: string
  createdAt: number | null
}

export async function getPayoutInfo(config: OxapayConfig, trackId: string): Promise<PayoutInfo> {
  const id = optionalString(trackId)
  if (!id) throw new OxapayError('invalid_input', 'trackId is required')

  const envelope = await request(config, {
    path: `/payout/${encodeURIComponent(id)}`,
    method: 'GET',
    apiKey: config.payoutApiKey,
    headerName: 'payout_api_key',
  })

  const data = envelope.data ?? {}
  const rawStatus = asString(data.status) ?? ''
  return {
    trackId: asString(data.track_id) ?? id,
    status: normalizePayoutStatus(rawStatus),
    rawStatus,
    address: asString(data.address),
    currency: asString(data.currency),
    network: asString(data.network),
    amount: asString(data.amount),
    fee: asString(data.fee),
    txHash: asString(data.tx_hash),
    description: asString(data.description),
    createdAt: asNumber(data.date),
  }
}

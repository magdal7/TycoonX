import { toNumber } from './ceos'
import { apiUrl } from './api'

export interface SpBalances {
  earnedSp: number
  bonusSp: number
  totalSp: number
  lifetimeEarnedSp: number
}

export interface Progress {
  xp: number
  level: number
  rank: string
  intoLevel: number
  toNext: number
}

export interface OwnedCeo {
  id: number
  templateId: number
  templateSlug: string
  templateName: string
  rarity: string
  acquisitionType: string
  level: number
  status: string
  equipment: string
  cycleLimit: number | null
  completedRewardCycles: number
  baseSpPerCycle: number | null
  nominalSpPer24h: number | null
  lifetimeCapSp: number | null
  lifetimeEarnedSp: number
  archivedAt: string | null
  priceUsd: number
  cycleHours: number
  cycleEndsAt: string | null
  cycleRewardSp: number | null
  canStart: boolean
  canCollect: boolean
  acquiredAt: string
}

export interface CycleView {
  id: string
  ownedCeoId: number
  status: string
  startsAt: string
  endsAt: string
  equipment: string
  cycleHours: number
  rewardSp: number
}

export interface Resources {
  sp: SpBalances
  progress: Progress
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), { credentials: 'include', ...init })
  if (!res.ok) {
    let message = `Request failed (status ${res.status}).`
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

interface RawResources {
  sp: { earnedSp: string; bonusSp: string; totalSp: string; lifetimeEarnedSp: string }
  progress: Progress
}

export async function fetchResources(): Promise<Resources> {
  const data = await request<RawResources>('/api/game/resources')
  return {
    sp: {
      earnedSp: toNumber(data.sp.earnedSp),
      bonusSp: toNumber(data.sp.bonusSp),
      totalSp: toNumber(data.sp.totalSp),
      lifetimeEarnedSp: toNumber(data.sp.lifetimeEarnedSp),
    },
    progress: data.progress,
  }
}

interface RawOwned {
  owned: OwnedCeo[]
}

export async function fetchOwnedCeos(): Promise<OwnedCeo[]> {
  const data = await request<RawOwned>('/api/game/ceos/owned')
  return data.owned
}

function parseCycle(raw: CycleView): CycleView {
  return { ...raw, rewardSp: toNumber(raw.rewardSp as unknown as string | number) }
}

export async function startCycle(ownedId: number): Promise<CycleView> {
  const data = await request<{ cycle: CycleView }>(`/api/game/ceos/${ownedId}/start`, { method: 'POST' })
  return parseCycle(data.cycle)
}

export interface CollectResult {
  ownedCeoId: number
  cycleId: string
  rewardSp: number
  alreadyCollected: boolean
  balanceSp: number
  status: string
}

export async function collectCycle(ownedId: number): Promise<CollectResult> {
  const raw = await request<Omit<CollectResult, 'rewardSp' | 'balanceSp'> & { rewardSp: string; balanceSp: string }>(
    `/api/game/ceos/${ownedId}/collect`,
    { method: 'POST' },
  )
  return { ...raw, rewardSp: toNumber(raw.rewardSp), balanceSp: toNumber(raw.balanceSp) }
}

export async function upgradeEquipment(
  ownedId: number,
  target: 'EXTENDED' | 'ADVANCED',
): Promise<{ equipment: string; earnedSp: number; bonusSp: number }> {
  const raw = await request<{ equipment: string; earnedSp: string; bonusSp: string }>(
    `/api/game/ceos/${ownedId}/equipment`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }) },
  )
  return { equipment: raw.equipment, earnedSp: toNumber(raw.earnedSp), bonusSp: toNumber(raw.bonusSp) }
}

export interface BulkResult {
  results: Array<{ ownedId: number; ok: boolean; reason?: string }>
  summary: { succeeded: number; skipped: number }
}

export function bulkStart(ownedIds: number[]): Promise<BulkResult> {
  return request('/api/game/ceos/bulk-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownedIds }),
  })
}

export function bulkCollect(ownedIds: number[]): Promise<BulkResult> {
  return request('/api/game/ceos/bulk-collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownedIds }),
  })
}

export interface TaskState {
  key: string
  title: string
  kind: 'daily' | 'weekly'
  goal: number
  xp: number
  progress: number
  completed: boolean
  claimed: boolean
  periodKey: string
}

export interface BonusState {
  key: string
  xp: number
  completed: boolean
  claimed: boolean
  periodKey: string
}

export interface TaskBoard {
  day: string
  week: string
  daily: TaskState[]
  weekly: TaskState[]
  dailyBonus: BonusState
  weeklyBonus: BonusState
}

export interface ClaimResult {
  taskKey: string
  xpAwarded: number
  claimed: boolean
  alreadyClaimed: boolean
  claimable: boolean
  board: TaskBoard
}

export interface ClaimAllResult {
  claimed: string[]
  xpAwarded: number
  board: TaskBoard
}

export const fetchTasks = (): Promise<TaskBoard> => request('/api/game/tasks')

export const claimTask = (taskKey: string) =>
  request<ClaimResult>('/api/game/tasks/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskKey }),
  })

export const claimAllTasks = () =>
  request<ClaimAllResult>('/api/game/tasks/claim-all', { method: 'POST' })

export interface AchievementStage {
  stage: string
  threshold: number
  xp: number
  achieved: boolean
  claimed: boolean
}

export interface AchievementTrack {
  key: string
  title: string
  value: number
  stageIndex: number
  stages: AchievementStage[]
}

export const fetchAchievements = () =>
  request<{ tracks: AchievementTrack[] }>('/api/game/achievements').then((d) => d.tracks)

export const claimAchievement = (trackKey: string, stage: string) =>
  request<{ xpAwarded: number }>('/api/game/achievements/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackKey, stage }),
  })

export interface LeaderboardEntry {
  rank: number
  userId: number
  username: string
  avatarKey: string
  level: number
  rankName: string
  xp: number
  primaryBadge: string | null
}

export const fetchLeaderboard = () =>
  request<{ entries: LeaderboardEntry[] }>('/api/public/leaderboard').then((d) => d.entries)

export const fetchMyRank = () => request<{ rank: number | null }>('/api/game/leaderboard/me')

export interface PublicProfile {
  username: string
  avatarKey: string
  level: number
  rankName: string
  xp: number
  featured: string[]
}

export const fetchPublicProfile = (username: string) =>
  request<PublicProfile>(`/api/public/profile/${encodeURIComponent(username)}`)

export type ReferralState = 'PENDING' | 'QUALIFIED' | 'REJECTED' | 'REVOKED'

export interface ReferralHistoryItem {
  id: number
  referredUsername: string
  status: ReferralState
  createdAt: string
  qualifiedAt: string | null
  rewards: Array<{ kind: string; status: string; amountSp: string; currency: string }>
}

export interface ReferralStatus {
  code: string | null
  link: string | null
  total: number
  qualified: number
  pendingRewardsSp: string
  paidRewardsSp: string
  rewardsEnabled: boolean
  registrationBonusSp: string
  commissionPercent: string
  commissionCurrency: string
  qualification: { minLevel: number; requireEmailVerification: boolean; minCyclesCollected: number }
  history: ReferralHistoryItem[]
}

export const fetchReferrals = () => request<ReferralStatus>('/api/game/referrals')

export const setFeaturedBadges = (badges: string[]) =>
  request<{ featured: string[] }>('/api/game/me/featured', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ badges }),
  }).then((d) => d.featured)

export interface LedgerEntry {
  id: string
  bucket: string
  amountSp: number
  sourceType: string
  createdAt: string
}

export const fetchLedger = () =>
  request<{ entries: Array<{ id: string; bucket: string; amountSp: string; sourceType: string; createdAt: string }> }>(
    '/api/game/sp/ledger',
  ).then((d) => d.entries.map((e) => ({ ...e, amountSp: toNumber(e.amountSp) })))

export interface WithdrawalView {
  id: number
  grossSp: number
  feeUsdt: number
  netUsdt: number
  address: string
  network: string
  status: string
  createdAt: string
}

interface RawWithdrawal {
  id: number
  grossSp: string
  feeUsdt: string
  netUsdt: string
  address: string
  network: string
  status: string
  createdAt: string
}

const mapWithdrawal = (w: RawWithdrawal): WithdrawalView => ({
  ...w,
  grossSp: toNumber(w.grossSp),
  feeUsdt: toNumber(w.feeUsdt),
  netUsdt: toNumber(w.netUsdt),
})

export const fetchWithdrawals = () =>
  request<{ withdrawals: RawWithdrawal[]; payoutsEnabled: boolean }>('/api/game/withdrawals').then((d) => ({
    withdrawals: d.withdrawals.map(mapWithdrawal),
    payoutsEnabled: d.payoutsEnabled,
  }))

export const createWithdrawal = (grossSp: number, address: string) =>
  request<{ withdrawal: RawWithdrawal; payoutsEnabled: boolean }>('/api/game/withdrawals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grossSp: String(grossSp), address }),
  }).then((d) => mapWithdrawal(d.withdrawal))

export const cancelWithdrawal = (id: number) =>
  request<{ withdrawal: RawWithdrawal }>(`/api/game/withdrawals/${id}/cancel`, { method: 'POST' }).then((d) =>
    mapWithdrawal(d.withdrawal),
  )

export type PlayerSpecialTaskState =
  | 'AVAILABLE'
  | 'PENDING'
  | 'APPROVED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'INELIGIBLE'
  | 'FULL'

export interface PlayerSpecialTask {
  id: number
  title: string
  description: string
  link: string | null
  proofInstructions: string | null
  rewardXp: number
  rewardBonusSp: string
  state: PlayerSpecialTaskState
  minLevel: number
  startsAt: string | null
  expiresAt: string | null
  attemptsUsed: number
  maxAttempts: number
  submissionId: number | null
  submissionStatus: string | null
  submissionAttempt: number | null
  reviewNote: string | null
}

export const fetchSpecialTasks = () =>
  request<{ tasks: PlayerSpecialTask[] }>('/api/game/special-tasks').then((d) => d.tasks)

export const submitSpecialTask = (taskId: number, proof: { proofText?: string; proofUrl?: string }) =>
  request<{ submissionId: number; status: string; attempt: number }>(`/api/game/special-tasks/${taskId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(proof),
  })

export const claimSpecialTaskReward = (submissionId: number) =>
  request<{ submissionId: number; xpAwarded: number; bonusSpAwarded: string }>(
    `/api/game/special-tasks/submissions/${submissionId}/claim`,
    { method: 'POST' },
  )

// ---------------------------------------------------------------------------
// Wallet, deposits and CEO purchases (payments prepared but disabled)
// ---------------------------------------------------------------------------

export interface WalletSummary {
  sp: { earnedSp: string; bonusSp: string; totalSp: string; lifetimeEarnedSp: string }
  usdt: { balance: string; deposited: string; paidOut: string }
  pendingWithdrawalSp: string
  paymentsEnabled: boolean
  payoutsEnabled: boolean
}

export interface WalletTransaction {
  id: string
  type: 'SP' | 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE'
  label: string
  amount: string
  bucket?: string
  status?: string
  createdAt: string
}

export interface DepositView {
  id: number
  provider: string
  externalId: string
  amountUsdt: string
  creditedSp: string | null
  status: string
  purpose: string
  createdAt: string
  confirmedAt: string | null
}

export interface PurchaseView {
  id: number
  ceoId: number
  priceUsd: string
  status: string
  paymentIntentId: number | null
  ownedCeoId: number | null
  createdAt: string
  paidAt: string | null
  deliveredAt: string | null
  ceoName?: string
}

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const fetchWallet = () => request<WalletSummary>('/api/game/wallet')

export const fetchWalletTransactions = () =>
  request<{ transactions: WalletTransaction[] }>('/api/game/wallet/transactions').then((d) => d.transactions)

export const fetchDeposits = () =>
  request<{ deposits: DepositView[]; paymentsEnabled: boolean }>('/api/game/deposits')

export const createDeposit = (amountUsdt: string) =>
  request<{ deposit: DepositView }>('/api/game/deposits', jsonPost({ amountUsdt, confirm: true })).then(
    (d) => d.deposit,
  )

export const fetchPurchases = () =>
  request<{ purchases: PurchaseView[]; paymentsEnabled: boolean }>('/api/game/purchases')

export const createPurchase = (ceoId: number, idempotencyKey: string) =>
  request<{ purchase: PurchaseView }>('/api/game/purchases', jsonPost({ ceoId, idempotencyKey })).then(
    (d) => d.purchase,
  )

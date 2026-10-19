import { request } from './game'

export type SpecialTaskStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED'
export type SpecialTaskAction = 'publish' | 'pause' | 'expire' | 'archive'
export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLAIMED'

export interface AdminTask {
  id: number
  title: string
  description: string
  link: string | null
  proofInstructions: string | null
  rewardXp: number
  rewardBonusSp: string
  status: SpecialTaskStatus
  verification: 'MANUAL' | 'AUTO'
  minLevel: number
  maxCompletions: number | null
  completionsCount: number
  startsAt: string | null
  expiresAt: string | null
  createdBy: number
  publishedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  submissionCount: number
}

export interface AdminTaskInput {
  title: string
  description: string
  link?: string | null
  proofInstructions?: string | null
  rewardXp: number
  rewardBonusSp: number
  verification: 'MANUAL' | 'AUTO'
  minLevel: number
  maxCompletions?: number | null
  startsAt?: string | null
  expiresAt?: string | null
  confirmHighReward?: boolean
}

export interface AdminSubmission {
  id: number
  taskId: number
  taskTitle: string
  userId: number
  username: string
  status: SubmissionStatus
  attempt: number
  proofText: string | null
  proofUrl: string | null
  rewardXpSnap: number
  rewardBonusSpSnap: string
  reviewNote: string | null
  reviewedAt: string | null
  claimedAt: string | null
  createdAt: string
}

export interface AdminDashboard {
  tasks: { draft: number; published: number; paused: number; expired: number; archived: number; total: number }
  submissions: { pending: number; approved: number; rejected: number; claimed: number; total: number }
  users: number
  recentAudit: AdminAuditEntry[]
}

export interface AdminAuditEntry {
  id: number
  actorId: number
  action: string
  targetType: string
  targetId: string
  metadata?: unknown
  createdAt: string
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const fetchAdminDashboard = () => request<AdminDashboard>('/api/admin/special-tasks/dashboard')

export const fetchAdminTasks = (status?: SpecialTaskStatus) =>
  request<{ tasks: AdminTask[] }>(
    `/api/admin/special-tasks${status ? `?status=${encodeURIComponent(status)}` : ''}`,
  ).then((d) => d.tasks)

export const createAdminTask = (input: AdminTaskInput) =>
  request<{ task: AdminTask }>('/api/admin/special-tasks', json(input)).then((d) => d.task)

export const updateAdminTask = (id: number, input: AdminTaskInput) =>
  request<{ task: AdminTask }>(`/api/admin/special-tasks/${id}`, {
    ...json(input),
    method: 'PUT',
  }).then((d) => d.task)

export const applyAdminTaskAction = (id: number, action: SpecialTaskAction) =>
  request<{ task: AdminTask }>(`/api/admin/special-tasks/${id}/status`, json({ action })).then((d) => d.task)

export const fetchAdminSubmissions = (filter: { taskId?: number; status?: SubmissionStatus } = {}) => {
  const params = new URLSearchParams()
  if (filter.taskId) params.set('taskId', String(filter.taskId))
  if (filter.status) params.set('status', filter.status)
  const qs = params.toString()
  return request<{ submissions: AdminSubmission[] }>(`/api/admin/submissions${qs ? `?${qs}` : ''}`).then(
    (d) => d.submissions,
  )
}

export const reviewAdminSubmission = (id: number, decision: 'APPROVE' | 'REJECT', note?: string) =>
  request<{ submission: { id: number; status: SubmissionStatus } }>(
    `/api/admin/submissions/${id}/review`,
    json({ decision, note }),
  ).then((d) => d.submission)

export const fetchAdminAudit = () =>
  request<{ entries: AdminAuditEntry[] }>('/api/admin/audit').then((d) => d.entries)

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export interface AdminUserSummary {
  id: number
  username: string
  email: string
  role: string
  isSuspended: boolean
  suspendedAt: string | null
  suspensionReason: string | null
  createdAt: string
  ownedCeos: number
  earnedSp: string
  bonusSp: string
  lifetimeEarnedSp: string
  xp: number
  level: number
}

export interface AdminUserDetail {
  user: {
    id: number
    username: string
    email: string
    role: string
    isSuspended: boolean
    suspendedAt: string | null
    suspensionReason: string | null
    createdAt: string
  }
  balances: { earnedSp: string; bonusSp: string; lifetimeEarnedSp: string }
  progress: { xp: number; level: number; rank: string }
  ownedCeos: Array<{
    id: number
    templateName: string
    templateSlug: string
    status: string
    equipment: string
    lifetimeEarnedSp: string
    lifetimeCapSp: string | null
    archivedAt: string | null
    acquiredAt: string
  }>
  referrals: { made: number; qualified: number; receivedFrom: { referrerId: number; code: string; eligible: boolean } | null }
  ledger: Array<{ id: string; bucket: string; amountSp: string; sourceType: string; createdAt: string }>
  withdrawals: Array<{ id: number; grossSp: string; feeUsdt: string; netUsdt: string; address: string; status: string; createdAt: string }>
  production: { cyclesTotal: number; cyclesClaimed: number; cyclesProducing: number }
}

export const fetchAdminUsers = (q?: string) =>
  request<{ users: AdminUserSummary[] }>(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(
    (d) => d.users,
  )

export const fetchAdminUser = (id: number) => request<AdminUserDetail>(`/api/admin/users/${id}`)

export const setAdminUserSuspension = (
  id: number,
  body: { suspend: boolean; reason?: string; confirm: boolean },
) => request<{ user: { id: number; isSuspended: boolean } }>(`/api/admin/users/${id}/suspension`, json(body)).then((d) => d.user)

// ---------------------------------------------------------------------------
// CEO catalog management
// ---------------------------------------------------------------------------

export interface AdminCatalogCeo {
  id: number
  name: string
  slug: string
  rarity: string
  priceUsd: string
  dailyRatePercent: string
  nominalSpPer24h: number | null
  lifetimeCapSp: string | null
  cycleHours: number
  energyCost: number
  isActive: boolean
  isForSale: boolean
  category: string | null
  displayOrder: number
  imageUrl: string | null
  isStarter: boolean
  rewardEligible: boolean
  maxOwned: number
  createdAt: string
  updatedAt: string
  ownedCount: number
}

export interface AdminCatalogUpdate {
  name?: string
  rarity?: string
  category?: string | null
  displayOrder?: number
  imageUrl?: string | null
  isActive?: boolean
  isForSale?: boolean
}

export const fetchAdminCatalog = () =>
  request<{ ceos: AdminCatalogCeo[] }>('/api/admin/catalog').then((d) => d.ceos)

export const updateAdminCatalogEntry = (id: number, patch: AdminCatalogUpdate) =>
  request<{ ceo: AdminCatalogCeo }>(`/api/admin/catalog/${id}`, { ...json(patch), method: 'PUT' }).then((d) => d.ceo)

export interface AdminCatalogCreate {
  name: string
  slug: string
  rarity: string
  priceUsd: string
  dailyRatePercent: string
  cycleHours: number
  energyCost: number
  category?: string | null
  displayOrder?: number
  imageUrl?: string | null
  confirmNewTier: boolean
}

export const createAdminCatalogEntry = (input: AdminCatalogCreate) =>
  request<{ ceo: AdminCatalogCeo }>('/api/admin/catalog', json(input)).then((d) => d.ceo)

export const deleteAdminCatalogEntry = (id: number) =>
  request<{ ok: boolean }>(`/api/admin/catalog/${id}`, { ...json({ confirm: true }), method: 'DELETE' })

// ---------------------------------------------------------------------------
// Economy monitoring
// ---------------------------------------------------------------------------

export interface AdminEconomy {
  totals: { earnedSp: string; bonusSp: string; lifetimeEarnedSp: string; accounts: number }
  ledgerBySource: Array<{ sourceType: string; count: number; amountSp: string }>
  cyclesByStatus: Array<{ status: string; count: number }>
  ownedByStatus: Array<{ status: string; count: number }>
  suspicious: {
    largeCredits: Array<{
      id: string
      userId: number
      username: string
      bucket: string
      amountSp: string
      sourceType: string
      createdAt: string
    }>
    highVolumeUsers: Array<{ userId: number; username: string; cycles: number; flagged: boolean }>
  }
}

export const fetchAdminEconomy = () => request<AdminEconomy>('/api/admin/economy')

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------

export interface AdminSettings {
  registrationEnabled: boolean
  maintenance: { enabled: boolean; message: string }
  announcement: { enabled: boolean; message: string; level: 'info' | 'warning' | 'critical' }
  features: {
    market: boolean
    collection: boolean
    tasks: boolean
    achievements: boolean
    leaderboard: boolean
    wallet: boolean
    specialTasks: boolean
  }
  referral: {
    registrationBonusSp: number
    commissionBps: number
    commissionCurrency: string
    qualification: { minLevel: number; requireEmailVerification: boolean; minCyclesCollected: number }
  }
}

export const fetchAdminSettings = () =>
  request<{ settings: AdminSettings }>('/api/admin/settings').then((d) => d.settings)

export const updateAdminSettings = (patch: Partial<AdminSettings>, confirm: boolean) =>
  request<{ settings: AdminSettings }>('/api/admin/settings', { ...json({ ...patch, confirm }), method: 'PUT' }).then(
    (d) => d.settings,
  )

// ---------------------------------------------------------------------------
// Withdrawal review
// ---------------------------------------------------------------------------

export interface AdminWithdrawal {
  id: number
  userId: number
  username: string
  grossSp: string
  feeUsdt: string
  netUsdt: string
  address: string
  network: string
  status: string
  note: string | null
  reviewedBy: number | null
  reviewedAt: string | null
  createdAt: string
}

export const fetchAdminWithdrawals = (status?: string) =>
  request<{ withdrawals: AdminWithdrawal[]; payoutsEnabled: boolean }>(
    `/api/admin/withdrawals${status ? `?status=${encodeURIComponent(status)}` : ''}`,
  ).then((d) => d.withdrawals)

export const reviewAdminWithdrawal = (id: number, decision: 'APPROVED' | 'REJECTED' | 'ON_HOLD', note?: string) =>
  request<{ withdrawal: AdminWithdrawal }>(`/api/admin/withdrawals/${id}/review`, json({ decision, note })).then(
    (d) => d.withdrawal,
  )

// ---------------------------------------------------------------------------
// Referral management
// ---------------------------------------------------------------------------

export type AdminReferralState = 'PENDING' | 'QUALIFIED' | 'REJECTED' | 'REVOKED'

export interface AdminReferral {
  id: number
  referrerId: number
  referrerUsername: string
  referredUsername: string
  code: string
  status: AdminReferralState
  createdAt: string
  qualifiedAt: string | null
  reviewedAt: string | null
  reviewNote: string | null
  hasSignupFingerprint: boolean
  suspiciousSharedIp: boolean
  purchaseEvents: number
  rewards: Array<{ kind: string; status: string; amountSp: string }>
}

export interface AdminReferralReward {
  id: number
  referralId: number
  referrerUsername: string
  referredUsername: string
  kind: 'REGISTRATION_BONUS' | 'PURCHASE_COMMISSION'
  status: 'PENDING' | 'PAID' | 'REVERSED'
  amountSp: string
  currency: string
  purchaseRef: string | null
  createdAt: string
  paidAt: string | null
  reversedAt: string | null
}

export const fetchAdminReferrals = (filter: { status?: AdminReferralState; q?: string } = {}) => {
  const params = new URLSearchParams()
  if (filter.status) params.set('status', filter.status)
  if (filter.q) params.set('q', filter.q)
  const qs = params.toString()
  return request<{ referrals: AdminReferral[]; rewardsEnabled: boolean }>(
    `/api/admin/referrals${qs ? `?${qs}` : ''}`,
  ).then((d) => d)
}

export const reviewAdminReferral = (
  id: number,
  decision: 'QUALIFY' | 'REJECT' | 'REVOKE',
  note: string | undefined,
  confirm: boolean,
) =>
  request<{ referral: { id: number; status: AdminReferralState } }>(
    `/api/admin/referrals/${id}/review`,
    json({ decision, note, confirm }),
  ).then((d) => d.referral)

export const fetchAdminReferralRewards = (filter: { status?: string; kind?: string } = {}) => {
  const params = new URLSearchParams()
  if (filter.status) params.set('status', filter.status)
  if (filter.kind) params.set('kind', filter.kind)
  const qs = params.toString()
  return request<{ rewards: AdminReferralReward[] }>(`/api/admin/referral-rewards${qs ? `?${qs}` : ''}`).then(
    (d) => d.rewards,
  )
}

// ---------------------------------------------------------------------------
// Payments & purchases
// ---------------------------------------------------------------------------

export interface AdminPayment {
  id: number
  userId: number
  username: string
  provider: string
  externalId: string
  amountUsdt: string
  creditedSp: string | null
  status: string
  purpose: string
  createdAt: string
  confirmedAt: string | null
}

export interface AdminPurchase {
  id: number
  userId: number
  username: string
  ceoId: number
  ceoName: string
  priceUsd: string
  status: string
  paymentIntentId: number | null
  ownedCeoId: number | null
  createdAt: string
  paidAt: string | null
  deliveredAt: string | null
}

export const fetchAdminPayments = (status?: string) =>
  request<{ payments: AdminPayment[]; paymentsEnabled: boolean }>(
    `/api/admin/payments${status ? `?status=${encodeURIComponent(status)}` : ''}`,
  )

export const fetchAdminPurchases = (status?: string) =>
  request<{ purchases: AdminPurchase[]; paymentsEnabled: boolean }>(
    `/api/admin/purchases${status ? `?status=${encodeURIComponent(status)}` : ''}`,
  )

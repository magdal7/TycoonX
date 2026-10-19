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

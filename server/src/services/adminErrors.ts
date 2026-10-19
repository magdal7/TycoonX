export type AdminErrorCode =
  | 'not_found'
  | 'invalid_state'
  | 'confirmation_required'
  | 'cannot_suspend_admin'
  | 'owned_exists'
  | 'slug_exists'
  | 'economy_field_locked'

export class AdminError extends Error {
  constructor(public code: AdminErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'AdminError'
  }
}

export const ADMIN_ERROR_STATUS: Record<AdminErrorCode, number> = {
  not_found: 404,
  invalid_state: 409,
  confirmation_required: 422,
  cannot_suspend_admin: 422,
  owned_exists: 409,
  slug_exists: 409,
  economy_field_locked: 403,
}

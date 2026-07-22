export interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
}

export const ADMIN_SESSION_KEY = 'aneko-admin-access'
const LEGACY_SESSION_KEY = 'aneko-drive-access'

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)
  let payload: ApiEnvelope<T>

  try {
    payload = await response.json()
  } catch {
    throw new Error(`HTTP ${response.status}`)
  }

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error || `HTTP ${response.status}`)
  }

  return payload.data
}

export async function verifyAdminAccess(code: string) {
  const result = await apiRequest<{ valid: boolean }>('/api/admin/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  return result.valid
}

export function storeAdminAccess(code: string) {
  sessionStorage.setItem(ADMIN_SESSION_KEY, code)
  sessionStorage.removeItem(LEGACY_SESSION_KEY)
}

export function clearAdminAccess() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY)
  sessionStorage.removeItem(LEGACY_SESSION_KEY)
}

export async function restoreAdminAccess() {
  const code = sessionStorage.getItem(ADMIN_SESSION_KEY)
    || sessionStorage.getItem(LEGACY_SESSION_KEY)
    || ''

  if (!code) return ''

  try {
    if (!await verifyAdminAccess(code)) {
      clearAdminAccess()
      return ''
    }
    storeAdminAccess(code)
    return code
  } catch {
    clearAdminAccess()
    return ''
  }
}

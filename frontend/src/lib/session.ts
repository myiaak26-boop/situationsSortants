import { apiFetch, getToken, setToken } from './api'

export interface Session {
  id: string
  name: string
  email: string
  active: boolean
  roleId: string
  roleName: string
  permissions: string[]
  isSuperAdmin: boolean
}

export const PERM = {
  READ: 'courrier:read',
  WRITE: 'courrier:write',
  CREATE: 'courrier:create',
  EDIT_OFFICIAL: 'courrier:edit-official',
  UPDATE_SITUATION: 'courrier:update-situation',
  DELETE: 'courrier:delete',
  HISTORY: 'courrier:history',
  PRINT: 'courrier:print',
  IMPORT: 'import',
  SITUATION_READ: 'situation:read',
  SITUATION_EXPORT: 'situation:export',
  STATS_READ: 'statistique:read',
  USER_READ: 'utilisateur:read',
  USER_WRITE: 'utilisateur:write',
  USER_DELETE: 'utilisateur:delete',
  ROLE_READ: 'role:read',
  ROLE_WRITE: 'role:write',
  ROLE_DELETE: 'role:delete',
  PARAM_READ: 'parametre:read',
  PARAM_WRITE: 'parametre:write',
  AUDIT_READ: 'audit:read',
} as const

export function can(session: Session | null, permission: string): boolean {
  if (!session) return false
  return session.permissions.includes('*') || session.permissions.includes(permission)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export async function login(email: string, password: string): Promise<Session> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Identifiants invalides')
  }
  const data = await res.json()
  setToken(data.token)
  return data.user
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
  } catch {
    // session locale nettoyée même si le backend est injoignable
  }
  setToken(null)
}

export async function fetchSession(): Promise<Session | null> {
  if (!isAuthenticated()) return null
  try {
    const res = await apiFetch('/api/session')
    if (!res.ok) return null
    return (await res.json()) as Session
  } catch {
    return null
  }
}
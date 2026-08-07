import { randomBytes } from 'node:crypto'

interface SessionEntry {
  userId: string
  expiresAt: number
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000

const sessions = new Map<string, SessionEntry>()

function prune() {
  const now = Date.now()
  for (const [token, entry] of sessions) {
    if (entry.expiresAt <= now) sessions.delete(token)
  }
}

export function createSession(userId: string): string {
  prune()
  const token = randomBytes(32).toString('base64url')
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS })
  return token
}

export function getSessionUserId(token: string): string | null {
  const entry = sessions.get(token)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    sessions.delete(token)
    return null
  }
  entry.expiresAt = Date.now() + SESSION_TTL_MS
  return entry.userId
}

export function destroySession(token: string): void {
  sessions.delete(token)
}
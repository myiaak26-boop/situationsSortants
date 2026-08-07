const rawFetch = globalThis.fetch.bind(globalThis)

export const TOKEN_KEY = 'dex.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

globalThis.fetch = async (input, init) => {
  const headers = new Headers(init?.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await rawFetch(input, { ...init, headers })
  if (res.status === 401 && !String(input).includes('/api/auth/login')) {
    setToken(null)
    onUnauthorized?.()
  }
  return res
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init)
}
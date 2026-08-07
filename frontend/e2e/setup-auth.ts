import { request } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default async function setup() {
  const ctx = await request.newContext({ baseURL: 'http://localhost:3000' })
  const res = await ctx.post('/api/auth/login', {
    data: {
      email: process.env.DEX_ADMIN_EMAIL || 'admin@dex.local',
      password: process.env.DEX_ADMIN_PASSWORD || 'admin123',
    },
  })
  if (!res.ok) throw new Error(`POST /api/auth/login → ${res.status()}`)
  const data = (await res.json()) as { token: string }
  const authPath = path.resolve(__dirname, '..', 'test-results', '.auth.json')
  fs.mkdirSync(path.dirname(authPath), { recursive: true })
  fs.writeFileSync(
    authPath,
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: [{ name: 'dex.token', value: data.token }],
        },
      ],
    }),
  )
  await ctx.dispose()
}
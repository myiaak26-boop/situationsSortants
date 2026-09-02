import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
;(async () => {
  const t0 = Date.now()
  await c.connect()
  console.log('connect ms:', Date.now() - t0)
  for (let i = 0; i < 3; i++) {
    const t1 = Date.now()
    const r = await c.query('select id, email from "User" where email = $1 limit 1', ['admin@dex.local'])
    console.log(`query ${i}:`, Date.now() - t1, 'ms rows:', r.rowCount)
  }
  await c.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
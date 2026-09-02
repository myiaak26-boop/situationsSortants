import 'dotenv/config'
import { Client } from 'pg'
async function bench(url, label) {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  const t0 = Date.now()
  try {
    await c.connect()
    const times = []
    for (let i = 0; i < 3; i++) {
      const t1 = Date.now()
      await c.query('select 1')
      times.push(Date.now() - t1)
    }
    console.log(`${label}: connect ${Date.now() - t0}ms, queries ${times.join(', ')}ms`)
  } catch (e) {
    console.log(`${label}: FAIL ${e.message}`)
  } finally {
    await c.end().catch(() => {})
  }
}
;(async () => {
  const base = process.env.DATABASE_URL
  const direct = base.replace('aws-0-eu-west-2.pooler.supabase.com:6543', 'db.jfapvjmeatfpfkfrhkjb.supabase.com:5432')
  await bench(direct, 'DIRECT db.supabase.com:5432')
  await bench(base, 'pooler 6543 (session)')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
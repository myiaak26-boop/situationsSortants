import { Client } from 'pg'
const c = new Client({
  connectionString: 'postgresql://postgres.jfapvjmeatfpfkfrhkjb:iiGc3E0EA0sQa4kp@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify',
  ssl: { rejectUnauthorized: false },
})
;(async () => {
  await c.connect()
  const idx = await c.query(`select indexname, indexdef from pg_indexes where tablename = 'Courrier'`)
  console.log('indexes:', JSON.stringify(idx.rows))
  const explain = await c.query(`explain analyze select * from "Courrier" where numero like '%9801-26%' limit 100`)
  console.log('explain:', JSON.stringify(explain.rows))
  const n = await c.query(`select count(*)::int as n from "Courrier"`)
  console.log('rows:', n.rows[0].n)
  await c.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
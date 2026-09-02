import { Client } from 'pg'
const c = new Client({
  connectionString: 'postgresql://postgres.jfapvjmeatfpfkfrhkjb:iiGc3E0EA0sQa4kp@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify',
  ssl: { rejectUnauthorized: false },
})
;(async () => {
  await c.connect()
  const act = await c.query(`select pid, state, wait_event_type, wait_event, left(query,120) as q, now() - xact_start as age from pg_stat_activity where datname = current_database() and state <> 'idle' order by age desc nulls last limit 20`)
  console.log('active:', JSON.stringify(act.rows))
  const locks = await c.query(`select * from pg_locks where not granted limit 10`)
  console.log('locks:', JSON.stringify(locks.rows))
  await c.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
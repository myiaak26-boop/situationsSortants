import { Client } from 'pg'
const c = new Client({
  connectionString: 'postgresql://postgres.jfapvjmeatfpfkfrhkjb:iiGc3E0EA0sQa4kp@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify',
  ssl: { rejectUnauthorized: false },
})
;(async () => {
  await c.connect()
  const act = await c.query(`select pid, state, left(query,80) as q from pg_stat_activity where datname = current_database() and state = 'idle in transaction'`)
  console.log('idle-in-tx:', JSON.stringify(act.rows))
  for (const r of act.rows) {
    if (r.pid !== c.processID) {
      await c.query(`select pg_terminate_backend(${r.pid})`)
      console.log('terminated', r.pid)
    }
  }
  await c.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
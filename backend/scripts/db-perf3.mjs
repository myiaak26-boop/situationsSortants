import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
;(async () => {
  await c.connect()
  const act = await c.query(`select pid, state, wait_event, left(query,60) as q, now()-xact_start as tx_age from pg_stat_activity where datname=current_database() order by state, tx_age desc nulls last limit 40`)
  for (const r of act.rows) console.log(`${r.pid} ${r.state} ${r.wait_event ?? ''} ${Math.round((r.tx_age?.seconds ?? 0))}s ${r.q ?? ''}`)
  await c.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
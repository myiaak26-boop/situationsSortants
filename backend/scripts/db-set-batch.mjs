import { Client } from 'pg'
const c = new Client({
  connectionString: 'postgresql://postgres.jfapvjmeatfpfkfrhkjb:iiGc3E0EA0sQa4kp@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify',
  ssl: { rejectUnauthorized: false },
})
;(async () => {
  await c.connect()
  await c.query(`update "Parametre" set valeur = '50' where cle = 'import.batchSize'`)
  const r = await c.query(`select cle, valeur from "Parametre" where cle = 'import.batchSize'`)
  console.log('batchSize =>', JSON.stringify(r.rows))
  await c.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
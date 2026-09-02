import { Client } from 'pg'
const c = new Client({
  connectionString: 'postgresql://postgres.jfapvjmeatfpfkfrhkjb:iiGc3E0EA0sQa4kp@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify',
  ssl: { rejectUnauthorized: false },
})
;(async () => {
  await c.connect()
  const total = await c.query(`select count(*)::int as n from "Courrier" where "deletedAt" is null`)
  console.log('Courriers actifs en base:', total.rows[0].n)
  const sig = await c.query(`select signataire, count(*)::int as n from "Courrier" where "deletedAt" is null and (numero like '0%' or numero like '1%') group by signataire order by n desc`)
  console.log('Répartition signataires (courriers réels):', JSON.stringify(sig.rows))
  const codes = await c.query(`select count(*)::int as n from "Courrier" where "deletedAt" is null and "signataireId" is not null`)
  console.log('Avec signataireId mappé:', codes.rows[0].n)
  const resp = await c.query(`select count(*)::int as n from "Courrier" where "deletedAt" is null and "numeroEntrant" is not null`)
  console.log('Avec numeroEntrant (réponses):', resp.rows[0].n)
  const dur = await c.query(`select count(*)::int as n from "Courrier" where "deletedAt" is null and "dureeTraitement" is not null`)
  console.log('Avec dureeTraitement:', dur.rows[0].n)
  await c.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
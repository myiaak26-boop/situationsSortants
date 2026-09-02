import 'dotenv/config'
import pg from 'pg'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
try {
  await c.query('delete from "HistoriqueAction" where "courrierId" in (select id from "Courrier" where numero in (\'9001-26\',\'9002-26\',\'9003-26\',\'9004-26\',\'9005-26\'))')
  await c.query('delete from "Retrait" where "courrierId" in (select id from "Courrier" where numero in (\'9001-26\',\'9002-26\',\'9003-26\',\'9004-26\',\'9005-26\'))')
  await c.query('delete from "Courrier" where numero in (\'9001-26\',\'9002-26\',\'9003-26\',\'9004-26\',\'9005-26\')')
  const r = await c.query("select count(*) n from \"Courrier\" where numero like '900%-26'")
  console.log('remaining 900x-26:', r.rows[0].n)
} finally { await c.end() }

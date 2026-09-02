import 'dotenv/config'
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
try {
  const r = await c.query('select nom from "Situation" order by ordre')
  console.log(JSON.stringify(r.rows.map((x) => x.nom)))
  const m = await c.query('select nom from "ModeTransmission" order by ordre')
  console.log('modes:', JSON.stringify(m.rows.map((x) => x.nom)))
} finally {
  await c.end()
}
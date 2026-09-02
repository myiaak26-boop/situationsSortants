import 'dotenv/config'
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
try {
  const r = await c.query('select code, nom, ordre from "Signataire" order by ordre')
  console.log(JSON.stringify(r.rows, null, 1))
} finally {
  await c.end()
}
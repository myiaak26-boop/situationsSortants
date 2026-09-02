import 'dotenv/config'
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
try {
  await c.query('ALTER TABLE "Courrier" ADD COLUMN IF NOT EXISTS "dureeTraitement" TEXT')
  const r = await c.query("select column_name from information_schema.columns where table_name='Courrier' and column_name='dureeTraitement'")
  console.log('column present:', r.rows.length === 1)
} finally {
  await c.end()
}
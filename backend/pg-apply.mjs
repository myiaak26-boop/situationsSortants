import { readFileSync } from 'node:fs'
import pg from 'pg'
import 'dotenv/config'

const sql = readFileSync(new URL('./pg-schema.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  await client.query(sql)
  console.log('SCHEMA APPLIED OK')
} catch (e) {
  console.log('APPLY ERR:', e.code, e.message?.slice(0, 500))
} finally {
  await client.end()
}
import 'dotenv/config'
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
try {
  const c1 = (await c.query("select id from \"Courrier\" where numero = '9001-26'")).rows[0]
  const retrait = await c.query("select id from \"Retrait\" where \"courrierId\" = $1", [c1.id])
  const hist = await c.query("select action, commentaire from \"HistoriqueAction\" where \"courrierId\" = $1", [c1.id])
  console.log('retraits:', retrait.rows.length, 'historique:', JSON.stringify(hist.rows, null, 1))
} finally {
  await c.end()
}
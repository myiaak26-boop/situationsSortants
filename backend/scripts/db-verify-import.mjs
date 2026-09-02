import 'dotenv/config'
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
try {
  const r = await c.query("select numero, \"dateEnvoi\", destinataire, objet, signataire, \"signataireId\", \"numeroEntrant\", \"nombrePages\", \"dureeTraitement\", \"situationId\", \"modeTransmissionId\" from \"Courrier\" where numero in ('9001-26','9002-26','9003-26','9004-26','9005-26') order by numero")
  console.log(JSON.stringify(r.rows, null, 1))
} finally {
  await c.end()
}
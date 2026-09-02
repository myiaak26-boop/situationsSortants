import 'dotenv/config'
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
try {
  const r = await c.query("select id, numero, \"situationId\", \"dureeTraitement\" from \"Courrier\" where numero in ('9001-26','9002-26','9003-26')")
  console.log('before:', JSON.stringify(r.rows, null, 1))

  const sitRetire = (await c.query("select id from \"Situation\" where nom like 'Retir%' limit 1")).rows[0]
  const modeCoursier = (await c.query("select id from \"ModeTransmission\" where nom like '%Remise au Coursier%' limit 1")).rows[0]
  const user = (await c.query("select id from \"User\" where email = 'admin@dex.local' limit 1")).rows[0]
  console.log('sitRetire:', sitRetire, 'mode:', modeCoursier)
  const c1 = r.rows.find((x) => x.numero === '9001-26')

  await c.query('update "Courrier" set "situationId" = $1, "modeTransmissionId" = $2, "dureeTraitement" = $3 where id = $4', [sitRetire.id, modeCoursier.id, 'VALEUR EXISTANTE', c1.id])
  await c.query('insert into "Retrait" (id, "courrierId", "nomRetraitant", "telephone", observation, "retireParId", "dateRetrait") values ($1,$2,$3,$4,$5,$6,$7)', ['ret-9001', c1.id, 'Retraitant Test', null, null, user.id, new Date().toISOString()])
  await c.query('insert into "HistoriqueAction" (id, "courrierId", action, commentaire, "userId", "createdAt") values ($1,$2,$3,$4,$5,$6)', ['hist-9001-1', c1.id, 'TRANSITION', 'Événement de suivi avant réimport', user.id, new Date().toISOString()])

  const after = await c.query("select id, \"situationId\", \"modeTransmissionId\", \"dureeTraitement\" from \"Courrier\" where numero = '9001-26'")
  console.log('after setup:', JSON.stringify(after.rows, null, 1))
  const retrait = await c.query("select id from \"Retrait\" where \"courrierId\" = $1", [c1.id])
  const hist = await c.query("select action, commentaire from \"HistoriqueAction\" where \"courrierId\" = $1", [c1.id])
  console.log('retraits:', retrait.rows.length, 'historique:', JSON.stringify(hist.rows, null, 1))
} finally {
  await c.end()
}
// -----------------------------------------------------------------------------
// Migration : "dureeTraitement" TEXT → DOUBLE PRECISION
//
// 1. Normalise les valeurs textes existantes en nombre de jours (ou NULL) :
//    « 6 Jrs 20 h 26 min » → 6.8514 · « 7 jours » → 7 · « VALEUR EXISTANTE » → NULL
// 2. Altere la colonne vers DOUBLE PRECISION.
//
// Usage : node scripts/migrate-duree-traitement-numeric.mjs
// -----------------------------------------------------------------------------
import pg from 'pg'
import 'dotenv/config'

function normalizeDuration(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'number' && isFinite(v)) {
    if (v > 36500) return null
    return roundJours(v)
  }
  const s = String(v).trim()
  if (!s) return null
  const parsed = parseDurationText(s)
  return parsed === null ? null : roundJours(parsed)
}

function parseDurationText(raw) {
  const s = raw.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!s) return null
  let m = s.match(/^(\d+(?:[.,]\d+)?)$/)
  if (m) return Number(m[1].replace(',', '.'))
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*(jours?|jour\(s\)?|j|jr|jrs|d)$/)
  if (m) return Number(m[1].replace(',', '.'))
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*(jours?|jour\(s\)?|j|jr|jrs|d)\s+(\d{1,2})\s*h(?:eures?)?(?:\s+(\d{1,2})\s*(?:min(?:utes?)?|m))?$/)
  if (m) {
    const h = Number(m[3])
    const min = m[4] ? Number(m[4]) : 0
    if (h > 23 || min > 59) return null
    return Number(m[1].replace(',', '.')) + h / 24 + min / 1440
  }
  m = s.match(/^(\d{1,2})\s*h(?:eures?)?(?:\s+(\d{1,2})\s*(?:min(?:utes?)?|m))?$/)
  if (m) {
    const h = Number(m[1])
    const min = m[2] ? Number(m[2]) : 0
    if (h > 23 || min > 59) return null
    return h / 24 + min / 1440
  }
  m = s.match(/^(\d{1,3})\s*(?:min(?:utes?)?|m)$/)
  if (m) return Number(m[1]) / 1440
  return null
}

function roundJours(n) {
  return Math.round(n * 10000) / 10000
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

try {
  const rows = await client.query('select id, numero, "dureeTraitement" from "Courrier" where "dureeTraitement" is not null')
  console.log(`Valeurs non NULL à convertir : ${rows.rows.length}`)
  let convertis = 0
  let nullifies = 0
  for (const r of rows.rows) {
    const n = normalizeDuration(r.dureeTraitement)
    if (n === null) {
      await client.query('update "Courrier" set "dureeTraitement" = null where id = $1', [r.id])
      nullifies++
      console.log(`  ${r.numero} : "${r.dureeTraitement}" → NULL (non numérique)`)
    } else {
      await client.query('update "Courrier" set "dureeTraitement" = $1 where id = $2', [n, r.id])
      convertis++
      console.log(`  ${r.numero} : "${r.dureeTraitement}" → ${n} jours`)
    }
  }

  await client.query('ALTER TABLE "Courrier" ALTER COLUMN "dureeTraitement" TYPE DOUBLE PRECISION USING "dureeTraitement"::double precision')
  console.log(`Colonne convertie en DOUBLE PRECISION (${convertis} convertis, ${nullifies} remis à NULL)`)
} finally {
  await client.end()
}
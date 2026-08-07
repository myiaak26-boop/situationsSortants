const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
const { PrismaClient } = require('@prisma/client')
const a = new PrismaBetterSqlite3({ url: 'file:C:/Users/HP/Desktop/dex/backend/dev.db' })
const p = new PrismaClient({ adapter: a })
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')
const j = (v) => JSON.stringify(v ?? '')
;(async () => {
  const c = await p.courrier.findMany({ orderBy: { numero: 'asc' } })
  for (const x of c) {
    console.log(
      [x.numero, iso(x.dateEnvoi), x.situationId, x.modeTransmissionId, x.signataireId || '', j(x.signataire), j(x.numeroEntrant), iso(x.dateArriveeEntrant), String(x.nombrePages ?? ''), j(x.expediteur), iso(x.dateObservation), x.modeEnvoi || '', x.nbrRappels].join('|'),
    )
  }
})()
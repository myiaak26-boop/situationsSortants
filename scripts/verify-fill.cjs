const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
const { PrismaClient } = require('@prisma/client')
const adapter = new PrismaBetterSqlite3({ url: 'file:C:/Users/HP/Desktop/dex/backend/dev.db' })
const p = new PrismaClient({ adapter })
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—')
;(async () => {
  const c = await p.courrier.findMany({ where: { deletedAt: null }, include: { situation: true, retrait: true } })
  for (const n of ['1264-26', '1823-26', '1292-26', '1281-26', '1259-26']) {
    const x = c.find((y) => y.numero === n)
    console.log(n, '|', x.situation.nom, '| retrait:', x.retrait ? `${x.retrait.nomRetraitant} / ${x.retrait.telephone} / ${iso(x.retrait.dateRetrait)}` : 'MANQUANT')
  }
  for (const n of ['1256-26', '1259-26', '1263-26', '1264-26']) {
    const x = c.find((y) => y.numero === n)
    console.log(n, 'arrivee entrant:', iso(x.dateArriveeEntrant))
  }
  for (const n of ['1840-26', '1285-26', '1280-26']) {
    const x = c.find((y) => y.numero === n)
    console.log(n, 'rappel:', x.nbrRappels, 'situation:', x.situation.nom)
  }
  const counts = {}
  for (const x of c) counts[x.signataire] = (counts[x.signataire] || 0) + 1
  console.log('par signataire:', JSON.stringify(counts))

  const hist = await p.historiqueAction.findMany({
    where: { courrierId: { in: c.map((x) => x.id) } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { action: true, commentaire: true },
  })
  console.log('\nhistoriqueAction (20 dernières):')
  for (const h of hist) console.log('  -', h.action, h.commentaire ? `(${h.commentaire})` : '')
})()
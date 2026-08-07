import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
})

const retraitMode = await p.modeTransmission.findUnique({
  where: { nom: 'Retrait au Secrétariat' },
})
if (!retraitMode) {
  console.log('Mode Retrait introuvable')
  process.exit(1)
}

const situ = await p.situation.findMany({ select: { id: true, nom: true } })
const idByNom = new Map(situ.map((s) => [s.nom, s.id]))

const legacySituationIds = [idByNom.get('Appeler'), idByNom.get('Rappeler')].filter(Boolean) as string[]

const legacyNames = [
  'Lancer appel',
  'Joint',
  'Tenter rappel',
  'Toujours injoignable',
  'Joint au rappel',
  'Retiré directement',
  'Injoignable',
]

const deleted = await p.transition.deleteMany({
  where: {
    modeTransmissionId: retraitMode.id,
    OR: [
      { fromSituationId: { in: legacySituationIds } },
      { toSituationId: { in: legacySituationIds } },
      { nom: { in: legacyNames } },
    ],
  },
})
console.log(`Transitions legacy supprimées : ${deleted.count}`)

const remaining = await p.transition.findMany({
  where: { modeTransmissionId: retraitMode.id },
  select: { nom: true, fromSituation: { select: { nom: true } }, toSituation: { select: { nom: true } } },
  orderBy: { ordre: 'asc' },
})
console.log(JSON.stringify(remaining, null, 2))
await p.$disconnect()

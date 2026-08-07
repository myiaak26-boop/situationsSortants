import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) })
const m = await p.modeTransmission.findUnique({ where: { nom: 'Retrait au Secrétariat' } })
const byN = new Map(
  (await p.situation.findMany({ select: { id: true, nom: true } })).map((s) => [s.nom, s.id]),
)
const r = await p.transition.deleteMany({
  where: {
    modeTransmissionId: m!.id,
    fromSituationId: byN.get('Destinataire joint')!,
    toSituationId: byN.get('Retiré')!,
  },
})
console.log('deleted', r.count)
const c = await p.transition.count({ where: { modeTransmissionId: m!.id } })
console.log('restant', c)
await p.$disconnect()

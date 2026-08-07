import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) })
const modes = await p.modeTransmission.findMany({
  select: { nom: true, cle: true, ordre: true, actif: true, _count: { select: { transitions: true, courriers: true } } },
  orderBy: { ordre: 'asc' },
})
console.log(JSON.stringify(modes, null, 2))
const ts = await p.transition.findMany({
  select: {
    nom: true,
    estRappel: true,
    demandeRetrait: true,
    modeTransmission: { select: { nom: true } },
    fromSituation: { select: { nom: true } },
    toSituation: { select: { nom: true } },
  },
  orderBy: { modeTransmissionId: 'asc' },
})
console.log(JSON.stringify(ts, null, 2))
await p.$disconnect()

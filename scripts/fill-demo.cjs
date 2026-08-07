const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
const { PrismaClient } = require('@prisma/client')
const fs = require('node:fs')
const path = require('node:path')

const adapter = new PrismaBetterSqlite3({ url: 'file:C:/Users/HP/Desktop/dex/backend/dev.db' })
const p = new PrismaClient({ adapter })

const RETRAITS = {
  '1264-26': { nom: 'Ibrahima Sory Baldé', tel: '065 44 33 22', d: '2026-08-07T09:30:00.000Z' },
  '1823-26': { nom: 'Fatoumata Diallo', tel: '061 34 56 78', d: '2026-08-06T10:15:00.000Z' },
  '1292-26': { nom: 'Saran KALLO', tel: '622 11 22 33', d: '2026-08-05T15:45:00.000Z' },
  '1281-26': { nom: 'Mamadou Camara', tel: '628 44 55 66', d: '2026-08-05T09:00:00.000Z' },
  '1259-26': { nom: 'Sekouba Kouré', tel: '078 90 12 34', d: '2026-08-06T11:00:00.000Z' },
}

// ============ signatures pour les courriers sans signataire ============
const SIG = {
  '1840-26': { nom: 'Premier Ministre', code: 'PM', rappels: 1 },
  '1827-26': { nom: 'Chef de Cabinet', code: 'CCAB' },
  '1823-26': { nom: 'Premier Ministre', code: 'PM' },
  '1821-26': { nom: 'Chef de Cabinet', code: 'CCAB' },
  '1815-26': { nom: 'Directeur de Cabinet Adjoint', code: 'DCA' },
  '1814-26': { nom: 'Directeur de Cabinet Adjoint', code: 'DCA' },
  '1813-26': { nom: 'Premier Ministre', code: 'PM' },
  '1803-26': { nom: 'Chef de Cabinet', code: 'CCAB' },
  '1293-26': { nom: 'Directeur de Cabinet Adjoint', code: 'DCA' },
  '1292-26': { nom: 'Directeur de Cabinet Adjoint', code: 'DCA' },
  '1285-26': { nom: 'Premier Ministre', code: 'PM', rappels: 1 },
  '1282-26': { nom: 'Directeur de Cabinet Adjoint', code: 'DCA' },
  '1281-26': { nom: 'Chef de Cabinet', code: 'CCAB' },
  '1280-26': { nom: 'Premier Ministre', code: 'PM', rappels: 1 },
}

// ============ dates d'arrivée des courriers entrant pour les 4 réponses ============
const ARRIVEE = {
  '1264-26': '2026-07-29T00:00:00.000Z', // déjà présente
  '1256-26': '2026-07-24T00:00:00.000Z',
  '1259-26': '2026-07-28T00:00:00.000Z',
  '1263-26': '2026-07-30T00:00:00.000Z',
}

// ============ nouvelles situations des 12 « Nouveau » ============
// Retiré (3) / Destinataire joint (3) / Appel effectué (4) / Injoignable (2)
const SIT_TARGET = {
  '1823-26': 'Retiré',
  '1292-26': 'Retiré',
  '1281-26': 'Retiré',
  '1815-26': 'Destinataire joint',
  '1803-26': 'Destinataire joint',
  '1293-26': 'Destinataire joint',
  '1821-26': 'Appel effectué',
  '1814-26': 'Appel effectué',
  '1813-26': 'Appel effectué',
  '1282-26': 'Appel effectué',
  '1285-26': 'Injoignable',
  '1280-26': 'Injoignable',
}

const NUMEROS = new Set([
  '1264-26', '1263-26', '1259-26', '1256-26',
  '1842-26', '1840-26', '1827-26', '1823-26', '1822-26', '1821-26',
  '1815-26', '1814-26', '1813-26', '1803-26', '1293-26', '1292-26',
  '1285-26', '1282-26', '1281-26', '1280-26',
])

async function main() {
  const situations = await p.situation.findMany()
  const sitId = Object.fromEntries(situations.map((s) => [s.nom, s.id]))
  const signataires = await p.signataire.findMany()
  const sigId = Object.fromEntries(signataires.map((s) => [s.nom, s.id]))
  const admin = await p.user.findFirst({ where: { email: 'admin@dex.local' } })
  const adminId = admin?.id ?? signataires[0].id // fallback improbable

  console.log('admin:', adminId)

  const all = await p.courrier.findMany({ where: { deletedAt: null } })
  const byNum = new Map(all.map((c) => [c.numero, c]))

  const snapshot = []
  await p.$transaction(async (tx) => {
    const existingRetraits = await tx.retrait.findMany()
    const retByCourrier = new Map(existingRetraits.map((r) => [r.courrierId, r]))

    for (const num of NUMEROS) {
      const c = byNum.get(num)
      if (!c) {
        console.log(`!! introuvable: ${num}`)
        continue
      }
      const before = retByCourrier.get(c.id)
      snapshot.push({
        numero: c.numero,
        situationId: c.situationId,
        signataire: c.signataire,
        signataireId: c.signataireId,
        numeroEntrant: c.numeroEntrant,
        dateArriveeEntrant: c.dateArriveeEntrant,
        nbrRappels: c.nbrRappels,
        retraitId: before?.id ?? null,
        retraitNom: before?.nomRetraitant ?? null,
        dateRetrait: before?.dateRetrait ?? null,
      })

      const data = {}
      const sig = SIG[num]
      const arrivee = ARRIVEE[num]
      const cible = SIT_TARGET[num]

      if (sig && sig.code) {
        const s = signataires.find((x) => x.code === sig.code)
        if (s) {
          data.signataire = s.nom
          data.signataireId = s.id
        }
      }
      if (arrivee) data.dateArriveeEntrant = new Date(arrivee)
      if (sig?.rappels) data.nbrRappels = sig.rappels
      if (cible) data.situationId = sitId[cible]

      const updated = await tx.courrier.update({ where: { id: c.id }, data })

      // retraits
      const rt = RETRAITS[c.numero]
      const existing = retByCourrier.get(c.id)
      if (rt) {
        if (existing) {
          await tx.retrait.update({
            where: { id: existing.id },
            data: { nomRetraitant: rt.nom, telephone: rt.tel, dateRetrait: new Date(rt.d) },
          })
        } else {
          await tx.retrait.create({
            data: {
              courrierId: c.id,
              nomRetraitant: rt.nom,
              telephone: rt.tel,
              observation: null,
              retireParId: adminId,
              dateRetrait: new Date(rt.d),
            },
          })
        }
      }

// historiqueAction pour le changement de situation
      const act = cible === 'Appel effectué' ? 'Appeler' : cible === 'Injoignable' ? 'Injoignable' : cible === 'Destinataire joint' ? 'Destinataire joint' : cible === 'Retiré' ? 'Retiré' : cible
      if (cible) {
        await tx.historiqueAction.create({
          data: {
            courrierId: c.id,
            transitionId: null,
            fromSituationId: c.situationId,
            toSituationId: sitId[cible],
            action: act,
            commentaire: cible === 'Retiré' && rt ? `Retiré par ${rt.nom} - ${rt.tel}` : null,
            userId: adminId,
          },
        })
      }

      console.log(`✓ ${num}: ${c.situationId} → ${cible ?? '—'} | sign=${sig?.code ?? '—'}`)
    }
  })

  fs.writeFileSync(path.join(__dirname, 'fill-before-snapshot.json'), JSON.stringify(snapshot, null, 2))
  console.log('Snapshot: scripts/fill-before-snapshot.json')
  console.log('OK')
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })

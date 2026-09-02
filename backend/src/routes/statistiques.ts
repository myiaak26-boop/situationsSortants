import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'
import { EXCLUSION_LEGACY } from '../lib/situation-query.js'
import type { Prisma } from '@prisma/client'

const ACTIF = { deletedAt: null }

interface StatsFiltres {
  debut?: string
  fin?: string
  signataire?: string
  situationId?: string
}

function buildStatsWhere(q: Record<string, unknown>): Prisma.CourrierWhereInput {
  const { debut, fin, signataire, situationId } = q as StatsFiltres
  const where: Prisma.CourrierWhereInput = { ...ACTIF, ...EXCLUSION_LEGACY }
  const date: Prisma.DateTimeFilter = {}
  if (debut) date.gte = new Date(`${debut}T00:00:00`)
  if (fin) date.lte = new Date(`${fin}T23:59:59.999`)
  if (debut || fin) where.dateEnvoi = date
  if (signataire) where.signataire = signataire
  if (situationId) where.situationId = situationId
  return where
}

function spanDays(debut?: string, fin?: string): number | null {
  if (!debut || !fin) return null
  const d = new Date(debut).getTime()
  const f = new Date(fin).getTime()
  if (isNaN(d) || isNaN(f) || f < d) return null
  return Math.round((f - d) / 86400000)
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1, 12).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function weekLabel(iso: string): string {
  const [y, m, dd] = iso.split('-').map(Number)
  return `Sem. du ${new Date(y, m - 1, dd, 12).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
}

function dayLabel(iso: string): string {
  const [y, m, dd] = iso.split('-').map(Number)
  return new Date(y, m - 1, dd, 12).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function pickBuckets(span: number | null): { key: (d: Date) => string; label: (k: string) => string } {
  if (span !== null && span <= 31) {
    return {
      key: (d) => {
        const base = new Date(d)
        base.setHours(12, 0, 0, 0)
        return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
      },
      label: dayLabel,
    }
  }
  if (span !== null && span <= 120) {
    return {
      key: (d) => {
        const base = new Date(d)
        base.setHours(12, 0, 0, 0)
        const day = (base.getDay() + 6) % 7
        base.setDate(base.getDate() - day)
        return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
      },
      label: weekLabel,
    }
  }
  return {
    key: (d) => {
      const base = new Date(d)
      base.setHours(12, 0, 0, 0)
      return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
    },
    label: monthLabel,
  }
}

export async function statistiquesRoutes(app: FastifyInstance) {
  app.get('/api/statistiques/global', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.STATISTIQUE_READ)
    if (!user) return
    const where = buildStatsWhere(req.query as Record<string, unknown>)
    const [total, retires, situations, courriers] = await Promise.all([
      prisma.courrier.count({ where }),
      prisma.courrier.count({
        where: {
          ...where,
          OR: [{ retrait: { isNot: null } }, { situation: { nom: { contains: 'Retiré' } } }],
        },
      }),
      prisma.situation.findMany({ orderBy: { ordre: 'asc' } }),
      prisma.courrier.findMany({
        where,
        select: {
          id: true,
          numero: true,
          dateEnvoi: true,
          destinataire: true,
          objet: true,
          numeroEntrant: true,
          dateArriveeEntrant: true,
          dureeTraitement: true,
          signataire: true,
          situationId: true,
          retrait: { select: { dateRetrait: true } },
        },
        orderBy: { dateEnvoi: 'asc' },
      }),
    ])

    const situationMap: Record<string, string> = {}
    for (const s of situations) situationMap[s.id] = s.nom

    let simples = 0
    let reponses = 0
    let injoignables = 0
    let livres = 0
    let nouveaux = 0
    let sommeReponse = 0
    let nbReponse = 0
    let sommeRetrait = 0
    let nbRetrait = 0
    const parSignataire: Record<string, number> = {}
    const distribution: Record<string, number> = {}

    for (const c of courriers) {
      if (c.numeroEntrant) {
        reponses++
        // Durée importée depuis Excel en priorité, sinon calcul par les dates.
        let j = c.dureeTraitement
        if (j === null && c.dateArriveeEntrant) {
          j = (c.dateEnvoi.getTime() - new Date(c.dateArriveeEntrant).getTime()) / 86400000
        }
        if (j !== null && j >= 0) {
          sommeReponse += j
          nbReponse++
        }
      } else {
        simples++
      }

      if (c.retrait) {
        const j = (new Date(c.retrait.dateRetrait).getTime() - c.dateEnvoi.getTime()) / 86400000
        if (j >= 0) {
          sommeRetrait += j
          nbRetrait++
        }
      }

      const nomSit = situationMap[c.situationId] || ''
      const nomSitLower = nomSit.toLowerCase()
      if (nomSitLower.includes('injoignable')) injoignables++
      if (nomSitLower.includes('livr')) livres++
      if (nomSitLower.includes('nouveau')) nouveaux++

      const nom = nomSit || 'Inconnu'
      distribution[nom] = (distribution[nom] || 0) + 1

      const sig = c.signataire || 'Inconnu'
      parSignataire[sig] = (parSignataire[sig] || 0) + 1
    }

    return {
      total,
      retires,
      courriersSimples: simples,
      courriersReponses: reponses,
      injoignables,
      livres,
      nouveaux,
      parSignataire,
      distribution,
      tempsMoyenReponseJours: nbReponse > 0 ? Math.round((sommeReponse / nbReponse) * 10) / 10 : null,
      tempsMoyenRetraitJours: nbRetrait > 0 ? Math.round((sommeRetrait / nbRetrait) * 10) / 10 : null,
    }
  })

  app.get('/api/statistiques/evolution', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.STATISTIQUE_READ)
    if (!user) return
    const q = req.query as StatsFiltres
    const where = buildStatsWhere(q as unknown as Record<string, unknown>)
    const courriers = await prisma.courrier.findMany({
      where,
      select: { dateEnvoi: true, retrait: true, situation: { select: { nom: true } } },
      orderBy: { dateEnvoi: 'asc' },
    })

    const buckets = pickBuckets(spanDays(q.debut, q.fin))
    const series: Record<string, { total: number; retires: number }> = {}
    for (const c of courriers) {
      const key = buckets.key(c.dateEnvoi)
      if (!series[key]) series[key] = { total: 0, retires: 0 }
      series[key].total++
      const estRetire = c.retrait !== null || (c.situation?.nom ?? '').toLowerCase().includes('retir')
      if (estRetire) series[key].retires++
    }

    return Object.entries(series).map(([cle, data]) => ({
      mois: buckets.label(cle),
      total: data.total,
      retires: data.retires,
    }))
  })

  app.get('/api/statistiques/destinataires', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.STATISTIQUE_READ)
    if (!user) return
    const where = buildStatsWhere(req.query as Record<string, unknown>)
    const courriers = await prisma.courrier.groupBy({
      by: ['destinataire'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    })

    return courriers.map((c) => ({
      destinataire: c.destinataire,
      total: c._count.id,
    }))
  })

  // Statistiques du moteur de workflow, par mode de transmission.
  // Aucune situation n'est référencée en dur : tout provient du graphe configuré.
  app.get('/api/statistiques/workflow', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.STATISTIQUE_READ)
    if (!user) return
    const modes = await prisma.modeTransmission.findMany({
      where: { actif: true },
      orderBy: { ordre: 'asc' },
    })

    const situations = await prisma.situation.findMany({ select: { id: true, nom: true, couleur: true, estFinal: true } })
    const situationById = new Map(situations.map((s) => [s.id, s]))

    const result = []

    for (const mode of modes) {
      const courriers = await prisma.courrier.findMany({
        where: { modeTransmissionId: mode.id, deletedAt: null, ...EXCLUSION_LEGACY },
        select: {
          id: true,
          createdAt: true,
          situationId: true,
          nbrRappels: true,
          retrait: { select: { dateRetrait: true } },
          historiqueActions: {
            select: { createdAt: true, toSituationId: true },
          },
        },
      })

      const distribution: Record<string, number> = {}
      let finalises = 0
      let retires = 0
      let rappels = 0

      const tempsSommations: number[] = []
      const finalsIds = new Set<string>()

      for (const c of courriers) {
        const sit = situationById.get(c.situationId)
        if (sit) distribution[sit.nom] = (distribution[sit.nom] ?? 0) + 1
        if (sit?.estFinal) {
          finalises++
          finalsIds.add(c.situationId)
        }
        if (c.retrait) retires++
        rappels += c.nbrRappels

        const premiereFinale = c.historiqueActions
          .filter((h) => h.toSituationId && situationById.get(h.toSituationId)?.estFinal)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
        if (premiereFinale) {
          const jours = (premiereFinale.createdAt.getTime() - new Date(c.createdAt).getTime()) / 86400000
          if (jours >= 0) tempsSommations.push(jours)
        }
      }

      const situationsDuMode = [...new Set(
        courriers.map((c) => c.situationId).concat(
          (await prisma.transition.findMany({
            where: { modeTransmissionId: mode.id },
            select: { fromSituationId: true, toSituationId: true },
          })).flatMap((t) => [t.fromSituationId, t.toSituationId]),
        ),
      )]
        .map((id) => situationById.get(id))
        .filter(Boolean)
        .sort((a, b) => (a!.nom.localeCompare(b!.nom)))

      result.push({
        mode: { id: mode.id, nom: mode.nom, couleur: mode.couleur, icone: mode.icone },
        total: courriers.length,
        finalises,
        enCours: courriers.length - finalises,
        retires,
        rappels,
        tempsMoyenJours:
          tempsSommations.length > 0
            ? Math.round((tempsSommations.reduce((a, b) => a + b, 0) / tempsSommations.length) * 10) / 10
            : null,
        distribution,
        situationsDuMode: situationsDuMode.map((s) => ({
          id: s!.id,
          nom: s!.nom,
          couleur: s!.couleur,
          estFinal: s!.estFinal,
        })),
      })
    }

    return result
  })
}

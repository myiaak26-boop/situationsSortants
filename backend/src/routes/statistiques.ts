import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'
import type { Prisma } from '@prisma/client'

const ACTIF = { deletedAt: null }
const EXCLUSION_LEGACY = { numero: { not: { contains: '_del_' } } }

interface StatsFiltres {
  debut?: string
  fin?: string
  signataire?: string
}

function buildStatsWhere(q: Record<string, unknown>): Prisma.CourrierWhereInput {
  const { debut, fin, signataire } = q as StatsFiltres
  const where: Prisma.CourrierWhereInput = { ...ACTIF, ...EXCLUSION_LEGACY }
  const date: Prisma.DateTimeFilter = {}
  if (debut) date.gte = new Date(`${debut}T00:00:00`)
  if (fin) date.lte = new Date(`${fin}T23:59:59.999`)
  if (debut || fin) where.dateEnvoi = date
  if (signataire) where.signataire = signataire
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
    const [total, retires, courriers] = await Promise.all([
      prisma.courrier.count({ where }),
      prisma.courrier.count({
        where: {
          ...where,
          retrait: { isNot: null },
        },
      }),
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
          retrait: { select: { dateRetrait: true } },
        },
        orderBy: { dateEnvoi: 'asc' },
      }),
    ])

    let simples = 0
    let reponses = 0
    let livres = 0
    let nouveaux = 0
    let sommeReponse = 0
    let nbReponse = 0
    let sommeRetrait = 0
    let nbRetrait = 0
    const parSignataire: Record<string, number> = {}

    for (const c of courriers) {
      if (c.numeroEntrant) {
        reponses++
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

      const sig = c.signataire || 'Inconnu'
      parSignataire[sig] = (parSignataire[sig] || 0) + 1
    }

    return {
      total,
      retires,
      courriersSimples: simples,
      courriersReponses: reponses,
      livres,
      nouveaux,
      parSignataire,
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
      select: { dateEnvoi: true, retrait: true },
      orderBy: { dateEnvoi: 'asc' },
    })

    const buckets = pickBuckets(spanDays(q.debut, q.fin))
    const series: Record<string, { total: number; retires: number }> = {}
    for (const c of courriers) {
      const key = buckets.key(c.dateEnvoi)
      if (!series[key]) series[key] = { total: 0, retires: 0 }
      series[key].total++
      if (c.retrait) series[key].retires++
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
}

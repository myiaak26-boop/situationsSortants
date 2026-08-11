import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'
import {
  SituationFiltres,
  TableColumn,
  buildWhere,
  computeExecStats,
  fetchAllRows,
  fetchTableRows,
  orderFor,
  parseFilters,
  periodLabel,
} from '../lib/situation-query.js'
import { generateExecPdf } from '../lib/report/pdf/index.js'
import { generateExecXlsx } from '../lib/report/xlsx/index.js'
import { reportConfigFor } from '../lib/report/types.js'
import { buildSignataireMap, signataireCode } from '../lib/report/signataires.js'

const PAGE_SIZE_MAX = 200
const MAX_EXPORT_ROWS = 50_000

const LOG_PARAM_KEYS = [
  'periode',
  'dateDebut',
  'dateFin',
  'reportType',
  'signataire',
  'destinataire',
  'situationId',
  'retires',
  'parMail',
  'parCoursier',
  'reponseEntrant',
  'injoignables',
  'rappels',
  'situationType',
] as const

function serializeParams(q: Record<string, unknown>): string {
  const p = new URLSearchParams()
  for (const k of LOG_PARAM_KEYS) {
    const v = q[k]
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  return p.toString()
}

const EXPORT_HEADERS = [
  'Numéro',
  "Date de sign.",
  'Signataire',
  'Destinataire',
  'Objet',
  'Statut de suivi',
  'Mode de transmission',
  'Réponse au courrier (N° entrant)',
  "Date d'arrivée (courrier entrant)",
  'Délai de réponse (jours)',
  'Date de retrait',
  'Délai de traitement (jours)',
  'Retiré par',
  'Téléphone',
  'Observation',
]

function extractFiltersText(f: SituationFiltres): string {
  const parts: string[] = []
  if (f.signataire) parts.push(`Signataire : ${f.signataire}`)
  if (f.destinataire) parts.push(`Destinataire : ${f.destinataire}`)
  if (f.situationId) parts.push('Situation filtrée')
  if (f.retires) parts.push('Retirés')
  if (f.parMail) parts.push('Envoyés par mail')
  if (f.parCoursier) parts.push('Envoyés par coursier')
  if (f.reponseEntrant) parts.push('Réponses à courrier entrant')
  return parts.join(' · ')
}

function calcDelaiJours(d1: Date | null | undefined, d2: Date | null | undefined): number | null {
  if (!d1 || !d2) return null
  const diff = Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000)
  return diff >= 0 ? diff : null
}

function buildExportRows(c: {
  numero: string
  dateEnvoi: Date
  destinataire: string
  objet: string
  signataire: string
  numeroEntrant: string | null
  dateArriveeEntrant: Date | null
  modeTransmission: { nom: string } | null
  situation: { nom: string }
  retrait: { dateRetrait: Date; nomRetraitant: string; telephone: string | null } | null
  observation: string | null
}, sigMap: Map<string, string>): (string | number)[] {
  const delaiReponse = calcDelaiJours(c.dateArriveeEntrant, c.dateEnvoi)
  const delaiTraitement = c.retrait ? calcDelaiJours(c.dateEnvoi, c.retrait.dateRetrait) : null
  return [
    c.numero,
    c.dateEnvoi.toISOString().split('T')[0],
    signataireCode(c.signataire, sigMap),
    c.destinataire,
    c.objet,
    c.situation.nom,
    c.modeTransmission?.nom || '',
    c.numeroEntrant || '-',
    c.dateArriveeEntrant ? c.dateArriveeEntrant.toISOString().split('T')[0] : '-',
    delaiReponse !== null ? delaiReponse : '-',
    c.retrait ? c.retrait.dateRetrait.toISOString().split('T')[0] : '',
    delaiTraitement !== null ? delaiTraitement : '',
    c.retrait?.nomRetraitant || '',
    c.retrait?.telephone || '',
    c.observation || '',
  ]
}

export async function situationRoutes(app: FastifyInstance) {
  app.get('/api/situations/meta', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.SITUATION_READ)
    if (!user) return
    const [situations, signataires] = await Promise.all([
      prisma.situation.findMany({
        select: { id: true, nom: true, couleur: true, estInitial: true, estFinal: true },
        orderBy: { ordre: 'asc' },
      }),
      prisma.signataire.findMany({
        select: { id: true, nom: true },
        where: { actif: true },
        orderBy: { ordre: 'asc' },
      }),
    ])
    return {
      situations,
      signataires: signataires.map((s) => s.nom).filter(Boolean),
    }
  })

  app.get('/api/situations/requete', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.SITUATION_READ)
    if (!user) return
    const q = req.query as SituationFiltres & { page?: string; pageSize?: string; tri?: string; dir?: string }
    const filtres = parseFilters({ ...q })
    const where = await buildWhere(filtres)

    const page = Math.max(1, parseInt(q.page || '1', 10) || 1)
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(q.pageSize || '50', 10) || 50))
    const tri = (q.tri || 'dateEnvoi') as TableColumn
    const dir = q.dir === 'asc' ? 'asc' : 'desc'

    const [execStats, tableau] = await Promise.all([
      computeExecStats(where),
      fetchTableRows(where, orderFor(tri, dir), page, pageSize),
    ])

    return reply.send({
      periodeLabel: periodLabel(filtres.periode, filtres.dateDebut, filtres.dateFin),
      filtreTexte: extractFiltersText(filtres),
      stats: execStats,
      tableau,
      page,
      pageSize,
    })
  })

  app.get('/api/situations/export/:type', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.SITUATION_EXPORT)
    if (!user) return
    const { type } = req.params as { type: string }
    const q = req.query as SituationFiltres & { tri?: string; dir?: string }
    if (!['pdf', 'xlsx', 'csv', 'exec-pdf', 'exec-xlsx'].includes(type)) {
      return reply.status(400).send({ error: 'Type d\'export non supporté' })
    }

    const filtres = parseFilters({ ...q })
    const where = await buildWhere(filtres)
    const tri = (q.tri || 'dateEnvoi') as TableColumn
    const dir = q.dir === 'asc' ? 'asc' : 'desc'
    const rows = await fetchAllRows(where, orderFor(tri, dir), MAX_EXPORT_ROWS + 1)
    if (rows.length > MAX_EXPORT_ROWS) {
      return reply.status(400).send({ error: `Sélection trop volumineuse pour l'export (${MAX_EXPORT_ROWS.toLocaleString('fr-FR')} lignes max). Réduisez la période.` })
    }

    const userNom = user.name
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayCount = await prisma.situationLog.count({ where: { createdAt: { gte: dayStart } } })
    const numeroSituation = `SCD-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${String(todayCount + 1).padStart(4, '0')}`
    const periode = periodLabel(filtres.periode, filtres.dateDebut, filtres.dateFin)
    const filtresTexte = extractFiltersText(filtres)
    const situationType = typeof (q as Record<string, unknown>).situationType === 'string' ? String((q as Record<string, unknown>).situationType) || 'Générale' : 'Générale'
    const params = serializeParams(q as unknown as Record<string, unknown>)

    const log = (taille: number) =>
      prisma.situationLog.create({
        data: {
          type,
          situationType,
          periode,
          filtres: filtresTexte || 'Aucun filtre',
          params,
          nbCourriers: rows.length,
          taille,
          userNom,
          userId: user.id,
        },
      }).then((l) =>
        prisma.auditLog.create({
          data: {
            action: 'SITUATION',
            entity: type.toUpperCase(),
            entityId: l.id,
            details: `${numeroSituation} : ${periode}${filtresTexte ? ` (${filtresTexte})` : ''} — ${rows.length} courriers`,
            userId: user.id,
          },
        }),
      )

    const signataires = await prisma.signataire.findMany({
      select: { code: true, nom: true, ordre: true },
      where: { actif: true },
      orderBy: { ordre: 'asc' },
    })
    const sigMap = buildSignataireMap(signataires)

    if (type === 'csv') {
      const csvRows = rows.map((r) =>
        EXPORT_HEADERS.map((_, i) => {
          const v = buildExportRows(r, sigMap)[i]
          return `"${String(v).replace(/"/g, '""')}"`
        }).join(';'),
      )
      const csv = '\uFEFF' + [EXPORT_HEADERS.map((h) => `"${h}"`).join(';'), ...csvRows].join('\r\n')
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="situation-${numeroSituation}.csv"`)
      await log(Buffer.byteLength(csv, 'utf8'))
      return reply.send(csv)
    }

    const [parametres, execStats, exclus] = await Promise.all([
      prisma.parametre.findMany({
        where: { cle: { in: ['situation.institutionNom', 'situation.logo', 'situation.titre', 'situation.republique', 'situation.devise', 'situation.signataireNom'] } },
      }),
      computeExecStats(where),
      prisma.courrier.findMany({
        where: { ...where, numero: { contains: '_del_' } },
        select: { numero: true },
        orderBy: { dateEnvoi: 'asc' },
      }),
    ])
    const paramMap = new Map(parametres.map((p) => [p.cle, p.valeur]))
    const reportType = typeof (q as Record<string, unknown>).reportType === 'string' && String((q as Record<string, unknown>).reportType)
      ? String((q as Record<string, unknown>).reportType)
      : 'generale'
    const config = reportConfigFor(reportType)

    const cover = {
      institutionNom: paramMap.get('situation.institutionNom') || 'Secrétariat Central et Documentation',
      republique: paramMap.get('situation.republique') || 'République de Guinée',
      devise: paramMap.get('situation.devise') || 'Travail - Justice - Solidarité',
      titre: paramMap.get('situation.titre') || 'Situation des Courriers Sortants',
      logoPath: paramMap.get('situation.logo') || '',
      periode,
      periodeDebut: filtres.dateDebut,
      periodeFin: filtres.dateFin,
      filtresTexte: filtresTexte || undefined,
      numeroRapport: numeroSituation,
      utilisateur: userNom,
      signataireNom: paramMap.get('situation.signataireNom') || undefined,
      genereLe: now,
      confidentiel: config.confidentiel === true,
    }

    if (type === 'pdf' || type === 'exec-pdf') {
      const buffer = await generateExecPdf({ cover, rows, stats: execStats, config, compact: type === 'pdf', signataires })
      reply.header('Content-Type', 'application/pdf')
      reply.header('Content-Disposition', `attachment; filename="situation-${type === 'exec-pdf' ? 'executive-' : ''}${numeroSituation}.pdf"`)
      await log(buffer.length)
      return reply.send(buffer)
    }

    const buffer = await generateExecXlsx({
      institutionNom: cover.institutionNom,
      republique: cover.republique,
      devise: cover.devise,
      titre: cover.titre,
      periode,
      filtresTexte,
      numeroRapport: numeroSituation,
      utilisateur: userNom,
      genereLe: now,
      stats: execStats,
      rows,
      config,
      signataires,
      auditInterne: {
        exclus,
        totalInclus: rows.length,
        signatairesNonRenseignes: rows.filter((r) => r.signataire === 'Non renseigné').length,
        destinatairesNonRenseignes: rows.filter((r) => r.destinataire === 'Non renseigné').length,
        objetsSansLibelle: rows.filter((r) => r.objet === 'Sans objet').length,
      },
    })
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', `attachment; filename="situation-${type === 'exec-xlsx' ? 'executive-' : ''}${numeroSituation}.xlsx"`)
    await log(buffer.length)
    return reply.send(buffer)
  })

  app.get('/api/situations/historique', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.SITUATION_READ)
    if (!user) return
    const q = req.query as { limit?: string }
    const limit = Math.min(parseInt(q.limit || '10', 10) || 10, 50)
    return prisma.situationLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
  })

  // GET /api/situations/indicateur/:type — retourne la liste des courriers pour un indicateur cliqué
  app.get('/api/situations/indicateur/:type', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.SITUATION_READ)
    if (!user) return
    const { type } = req.params as { type: string }
    const q = req.query as SituationFiltres & { signataire?: string }
    const filtres = parseFilters({ ...q })
    const baseWhere = await buildWhere(filtres)

    const VALID_TYPES = [
      'total', 'simples', 'reponses', 'retires',
      'envoyesMail', 'envoyesCoursier', 'enRetrait', 'injoignables', 'rappels',
    ]

    if (!VALID_TYPES.includes(type) && !type.startsWith('signataire:') && !type.startsWith('situation:')) {
      return reply.status(400).send({ error: 'Type d\'indicateur invalide' })
    }

    let extraWhere: Record<string, unknown> = {}

    if (type === 'simples') extraWhere = { numeroEntrant: null }
    else if (type === 'reponses') extraWhere = { numeroEntrant: { not: null } }
    else if (type === 'retires') extraWhere = { OR: [{ retrait: { isNot: null } }, { situation: { nom: { contains: 'Retiré' } } }] }
    else if (type === 'envoyesMail') extraWhere = { modeEnvoi: 'MAIL' }
    else if (type === 'envoyesCoursier') extraWhere = { modeEnvoi: 'COURSIER' }
    else if (type === 'enRetrait') extraWhere = { modeEnvoi: 'RETRAIT' }
    else if (type === 'injoignables') extraWhere = { situation: { nom: { contains: 'njoignable' } } }
    else if (type === 'rappels') extraWhere = { nbrRappels: { gt: 0 } }
    else if (type.startsWith('signataire:')) {
      const sig = type.replace('signataire:', '')
      const config = await prisma.signataire.findMany({ where: { nom: sig }, select: { id: true } })
      extraWhere =
        config.length > 0
          ? { OR: [{ signataire: sig }, { signataireId: { in: config.map((c) => c.id) } }] }
          : { signataire: sig }
    }
    else if (type.startsWith('situation:')) {
      const nom = type.replace('situation:', '')
      const found = await prisma.situation.findFirst({ where: { nom }, select: { id: true } })
      extraWhere = found ? { situationId: found.id } : { situation: { nom } }
    }

    const { AND, ...rest } = baseWhere as Prisma.CourrierWhereInput & { AND?: Prisma.CourrierWhereInput[] }
    const where: Prisma.CourrierWhereInput = {
      ...rest,
      AND: [...(AND ?? [{ deletedAt: null }]), extraWhere],
    }

    const rows = await prisma.courrier.findMany({
      where,
      select: {
        id: true,
        numero: true,
        dateEnvoi: true,
        signataire: true,
        destinataire: true,
        objet: true,
        numeroEntrant: true,
        dateArriveeEntrant: true,
        observation: true,
        modeTransmission: { select: { nom: true, couleur: true } },
        situation: { select: { nom: true, couleur: true } },
        retrait: { select: { dateRetrait: true, nomRetraitant: true, telephone: true } },
      },
      orderBy: { dateEnvoi: 'desc' },
    })

    const stats = await computeExecStats(where)

    return reply.send({ type, total: rows.length, rows, stats })
  })
}

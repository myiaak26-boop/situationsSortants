import { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import { formatDureeCourt, formatDureeJours } from './duree.js'

export interface SituationFiltres {
  periode?: string
  dateDebut?: string
  dateFin?: string
  signataire?: string
  destinataire?: string
  retires?: boolean
  parMail?: boolean
  parCoursier?: boolean
  reponseEntrant?: boolean
  rappels?: boolean
}

const NUMERO_EXCLUS_PATTERN = '_del_'
export const EXCLUSION_LEGACY: Prisma.CourrierWhereInput = { numero: { not: { contains: NUMERO_EXCLUS_PATTERN } } }

const PERIOD_LABELS: Record<string, string> = {
  aujourdhui: "Aujourd'hui",
  hier: 'Hier',
  semaine: 'Cette semaine',
  mois: 'Le mois en cours',
  trimestre: 'Le trimestre en cours',
  annee: 'Cette année',
}

function fmtDateFr(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function periodLabel(periode?: string, debut?: string, fin?: string): string {
  const base = PERIOD_LABELS[periode ?? ''] || 'Toutes périodes'
  if (periode === 'personnalisee' && debut && fin) {
    return `Du ${fmtDateFr(debut)} au ${fmtDateFr(fin)}`
  }
  return base
}

export function parseFilters(q: Record<string, unknown>): SituationFiltres {
  const bool = (v: unknown) => v === '1' || v === 'true'
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '') || undefined
  return {
    periode: str(q.periode),
    dateDebut: str(q.dateDebut),
    dateFin: str(q.dateFin),
    signataire: str(q.signataire),
    destinataire: str(q.destinataire),
    retires: bool(q.retires),
    parMail: bool(q.parMail),
    parCoursier: bool(q.parCoursier),
    reponseEntrant: bool(q.reponseEntrant),
    rappels: bool(q.rappels),
  }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

export function periodRange(f: SituationFiltres): { debut?: Date; fin?: Date } {
  const now = new Date()
  switch (f.periode) {
    case 'aujourdhui':
      return { debut: startOfDay(now), fin: endOfDay(now) }
    case 'hier': {
      const hier = new Date(now)
      hier.setDate(hier.getDate() - 1)
      return { debut: startOfDay(hier), fin: endOfDay(hier) }
    }
    case 'semaine': {
      const jour = now.getDay() === 0 ? 7 : now.getDay()
      const lundi = startOfDay(now)
      lundi.setDate(lundi.getDate() - (jour - 1))
      return { debut: lundi, fin: endOfDay(now) }
    }
    case 'mois':
      return { debut: new Date(now.getFullYear(), now.getMonth(), 1), fin: endOfDay(now) }
    case 'trimestre': {
      const debut = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      return { debut, fin: endOfDay(now) }
    }
    case 'annee':
      return { debut: new Date(now.getFullYear(), 0, 1), fin: endOfDay(now) }
    case 'personnalisee': {
      const debut = f.dateDebut ? new Date(`${f.dateDebut}T00:00:00`) : undefined
      const fin = f.dateFin ? new Date(`${f.dateFin}T23:59:59.999`) : undefined
      if (!debut && !fin) return {}
      return { debut, fin }
    }
    default:
      return {}
  }
}

export async function buildWhere(f: SituationFiltres): Promise<Prisma.CourrierWhereInput> {
  const and: Prisma.CourrierWhereInput[] = []

  const range = periodRange(f)
  if (range.debut || range.fin) {
    const dateFilter: Prisma.DateTimeFilter = {}
    if (range.debut) dateFilter.gte = range.debut
    if (range.fin) dateFilter.lte = range.fin
    and.push({ dateEnvoi: dateFilter })
  }

  if (f.signataire) {
    const config = await prisma.signataire.findMany({
      where: { nom: f.signataire },
      select: { id: true },
    })
    if (config.length > 0) {
      and.push({
        OR: [{ signataire: f.signataire }, { signataireId: { in: config.map((c) => c.id) } }],
      })
    } else {
      and.push({ signataire: f.signataire })
    }
  }
  if (f.destinataire) and.push({ destinataire: { contains: f.destinataire } })
  if (f.retires) {
    and.push({ retrait: { isNot: null } })
  }
  if (f.parMail && !f.parCoursier) and.push({ modeEnvoi: 'MAIL' })
  if (f.parCoursier && !f.parMail) and.push({ modeEnvoi: 'COURSIER' })
  if (f.reponseEntrant) and.push({ numeroEntrant: { not: null } })
  if (f.rappels) and.push({ nbrRappels: { gt: 0 } })

  and.push({ deletedAt: null })
  and.push(EXCLUSION_LEGACY)

  return { AND: and }
}

export interface SituationStats {
  total: number
  courriersSimples: number
  courriersReponses: number
  retires: number
  envoyesMail: number
  envoyesCoursier: number
  reponsesEntrant: number
  rappelsEffectues: number
  tempsMoyenRetraitJours: number | null
  tempsMoyenReponseJours: number | null
  parSignataire: Record<string, number>
}

export interface TrancheDelai {
  libelle: string
  count: number
}

export interface EvolutionPoint {
  libelle: string
  total: number
  retires: number
}

export interface SituationExecStats extends SituationStats {
  aRappeler: number
  livres: number
  nouveaux: number
  reponsesConcernes: number
  retraitsConcernes: number
  tauxRetrait: number | null
  parDestinataire: Record<string, number>
  evolution: EvolutionPoint[]
  repartitionDelais: TrancheDelai[]
  delaiMinJours: number | null
  delaiMaxJours: number | null
}

const TRANCHES: { max: number; libelle: string }[] = [
  { max: 3, libelle: '0-3 j' },
  { max: 7, libelle: '4-7 j' },
  { max: 14, libelle: '8-14 j' },
  { max: 21, libelle: '15-21 j' },
  { max: 30, libelle: '22-30 j' },
  { max: Infinity, libelle: '31 j et +' },
]

function bucketDelai(jours: number): string {
  const t = TRANCHES.find((tr) => jours <= tr.max) ?? TRANCHES[TRANCHES.length - 1]
  return t.libelle
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1, 12).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function weekKey(d: Date): string {
  const base = new Date(d)
  base.setHours(12, 0, 0, 0)
  const day = (base.getDay() + 6) % 7
  base.setDate(base.getDate() - day)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

function weekLabel(iso: string): string {
  const [y, m, dd] = iso.split('-').map(Number)
  const d = new Date(y, m - 1, dd, 12)
  return `Sem. du ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayLabel(iso: string): string {
  const [y, m, dd] = iso.split('-').map(Number)
  return new Date(y, m - 1, dd, 12).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export interface ExecStatsOptions {
  plageJoursResume?: 'jour' | 'semaine' | 'mois'
  spanJours?: number
}

function pickBuckets(spanDays: number): { key: (d: Date) => string; label: (k: string) => string } {
  if (spanDays <= 31) return { key: dayKey, label: dayLabel }
  if (spanDays <= 120) return { key: weekKey, label: weekLabel }
  return { key: monthKey, label: monthLabel }
}

export async function computeExecStats(
  where: Prisma.CourrierWhereInput,
  options: ExecStatsOptions = {},
): Promise<SituationExecStats> {
  const courriers = await prisma.courrier.findMany({
    where,
    select: {
      id: true,
      dateEnvoi: true,
      destinataire: true,
      numeroEntrant: true,
      dateArriveeEntrant: true,
      dureeTraitement: true,
      modeEnvoi: true,
      nbrRappels: true,
      signataire: true,
      retrait: { select: { dateRetrait: true } },
    },
    orderBy: { dateEnvoi: 'asc' },
  })

  const stats: SituationExecStats = {
    total: courriers.length,
    courriersSimples: 0,
    courriersReponses: 0,
    retires: 0,
    envoyesMail: 0,
    envoyesCoursier: 0,
    reponsesEntrant: 0,
    rappelsEffectues: 0,
    tempsMoyenRetraitJours: null,
    tempsMoyenReponseJours: null,
    parSignataire: {},
    aRappeler: 0,
    livres: 0,
    nouveaux: 0,
    reponsesConcernes: 0,
    retraitsConcernes: 0,
    tauxRetrait: null,
    parDestinataire: {},
    evolution: [],
    repartitionDelais: [],
    delaiMinJours: null,
    delaiMaxJours: null,
  }

  let sommeJoursRetrait = 0
  let retraitsComptes = 0
  let sommeJoursReponse = 0
  let reponsesComptees = 0
  let minJours = Infinity
  let maxJours = -Infinity

  const now = new Date()
  let debutSpan = now
  let finSpan = new Date(0)
  for (const c of courriers) {
    if (c.dateEnvoi < debutSpan) debutSpan = c.dateEnvoi
    if (c.dateEnvoi > finSpan) finSpan = c.dateEnvoi
  }
  const spanDays = courriers.length > 0 ? Math.max(1, Math.round((finSpan.getTime() - debutSpan.getTime()) / 86400000)) : 1
  const buckets = pickBuckets(spanDays)
  const evolMap = new Map<string, EvolutionPoint>()

  for (const c of courriers) {
    if (c.numeroEntrant) {
      stats.courriersReponses++
      stats.reponsesEntrant++
      let jours: number | null = c.dureeTraitement
      if (jours === null && c.dateArriveeEntrant) {
        jours = (new Date(c.dateEnvoi).getTime() - new Date(c.dateArriveeEntrant).getTime()) / 86400000
      }
      if (jours !== null && jours >= 0) {
        sommeJoursReponse += jours
        reponsesComptees++
        stats.reponsesConcernes++
        const jArr = Math.floor(jours)
        if (jArr < minJours) minJours = jArr
        if (jArr > maxJours) maxJours = jArr
      }
    } else {
      stats.courriersSimples++
    }

    const estRetire = c.retrait !== null

    if (estRetire) {
      stats.retires++
      if (c.retrait) {
        const jours = Math.floor((new Date(c.retrait.dateRetrait).getTime() - new Date(c.dateEnvoi).getTime()) / 86400000)
        if (jours >= 0) {
          sommeJoursRetrait += jours
          retraitsComptes++
          stats.retraitsConcernes++
        }
      }
    }

    const cle = c.modeEnvoi || ''
    if (cle === 'MAIL') stats.envoyesMail++
    else if (cle === 'COURSIER') stats.envoyesCoursier++

    stats.rappelsEffectues += c.nbrRappels

    const sig = c.signataire || 'Inconnu'
    stats.parSignataire[sig] = (stats.parSignataire[sig] || 0) + 1

    const dest = c.destinataire || 'Non renseigné'
    stats.parDestinataire[dest] = (stats.parDestinataire[dest] || 0) + 1

    const bk = buckets.key(c.dateEnvoi)
    const pt = evolMap.get(bk) || { libelle: buckets.label(bk), total: 0, retires: 0 }
    pt.total++
    if (estRetire) pt.retires++
    evolMap.set(bk, pt)
  }

  if (retraitsComptes > 0) stats.tempsMoyenRetraitJours = Math.round((sommeJoursRetrait / retraitsComptes) * 10) / 10
  if (reponsesComptees > 0) stats.tempsMoyenReponseJours = Math.round((sommeJoursReponse / reponsesComptees) * 10) / 10
  if (stats.total > 0) {
    stats.tauxRetrait = Math.round((stats.retires / stats.total) * 1000) / 10
  }
  if (courriers.length > 0) {
    stats.delaiMinJours = minJours === Infinity ? null : minJours
    stats.delaiMaxJours = maxJours === -Infinity ? null : maxJours
  }

  stats.evolution = [...evolMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)

  const delaiMap = new Map<string, number>()
  for (const c of courriers) {
    let jours: number | null = c.dureeTraitement
    if (jours === null && c.numeroEntrant && c.dateArriveeEntrant) {
      jours = (new Date(c.dateEnvoi).getTime() - new Date(c.dateArriveeEntrant).getTime()) / 86400000
    }
    if (jours === null || jours < 0) continue
    const b = bucketDelai(Math.max(0, Math.floor(jours)))
    delaiMap.set(b, (delaiMap.get(b) || 0) + 1)
  }
  stats.repartitionDelais = [...TRANCHES]
    .map((t) => ({ libelle: t.libelle, count: delaiMap.get(t.libelle) || 0 }))
    .sort((a, b) => {
      const i = (x: string) => TRANCHES.findIndex((t) => t.libelle === x)
      return i(a.libelle) - i(b.libelle)
    })

  return stats
}

export const TABLE_COLUMNS = [
  'numero',
  'dateEnvoi',
  'destinataire',
  'objet',
  'signataire',
  'numeroEntrant',
  'dateRetrait',
  'nomRetraitant',
  'telephone',
  'observation',
] as const

export type TableColumn = (typeof TABLE_COLUMNS)[number]

const SORTABLE: Record<string, Prisma.CourrierOrderByWithRelationInput> = {
  numero: { numero: 'asc' },
  dateEnvoi: { dateEnvoi: 'asc' },
  destinataire: { destinataire: 'asc' },
  objet: { objet: 'asc' },
  signataire: { signataire: 'asc' },
  numeroEntrant: { numeroEntrant: 'asc' },
  dateRetrait: { retrait: { dateRetrait: 'asc' } },
  nomRetraitant: { retrait: { nomRetraitant: 'asc' } },
  telephone: { retrait: { telephone: 'asc' } },
  observation: { observation: 'asc' },
}

export function orderFor(col: TableColumn, dir: 'asc' | 'desc'): Prisma.CourrierOrderByWithRelationInput {
  const base = SORTABLE[col] ?? { dateEnvoi: 'desc' as const }
  const invert = (v: Prisma.SortOrder) => (v === 'asc' ? 'desc' : 'asc')
  if ('retrait' in base) {
    const key = Object.keys(base.retrait!)[0] as keyof Prisma.RetraitOrderByWithRelationInput
    return { retrait: { [key]: dir } } as Prisma.CourrierOrderByWithRelationInput
  }
  const key = Object.keys(base)[0] as TableColumn
  return { [key]: invert(base[key as never] as Prisma.SortOrder) } as Prisma.CourrierOrderByWithRelationInput
}

export interface TableRow {
  id: string
  numero: string
  dateEnvoi: Date
  destinataire: string
  objet: string
  signataire: string
  numeroEntrant: string | null
  dateArriveeEntrant: Date | null
  dureeTraitement: number | null
  retrait: { dateRetrait: Date; nomRetraitant: string; telephone: string | null } | null
  observation: string | null
}

const ROW_SELECT = {
  id: true,
  numero: true,
  dateEnvoi: true,
  destinataire: true,
  objet: true,
  signataire: true,
  numeroEntrant: true,
  dateArriveeEntrant: true,
  dureeTraitement: true,
  observation: true,
  retrait: { select: { dateRetrait: true, nomRetraitant: true, telephone: true } },
} satisfies Prisma.CourrierSelect

export async function fetchTableRows(
  where: Prisma.CourrierWhereInput,
  orderBy: Prisma.CourrierOrderByWithRelationInput,
  page: number,
  pageSize: number,
): Promise<{ total: number; rows: TableRow[] }> {
  const [total, rows] = await Promise.all([
    prisma.courrier.count({ where }),
    prisma.courrier.findMany({
      where,
      select: ROW_SELECT,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return { total, rows: rows as TableRow[] }
}

export async function fetchAllRows(
  where: Prisma.CourrierWhereInput,
  orderBy: Prisma.CourrierOrderByWithRelationInput,
  limit?: number,
): Promise<TableRow[]> {
  return (await prisma.courrier.findMany({
    where,
    select: ROW_SELECT,
    orderBy,
    take: limit,
  })) as TableRow[]
}

import { COLORS } from './theme.js'
import type { SituationExecStats } from '../situation-query.js'

export type KpiId =
  | 'total'
  | 'simples'
  | 'reponses'
  | 'retires'
  | 'livres'
  | 'nouveaux'
  | 'mail'
  | 'coursier'
  | 'aRappeler'
  | 'rappels'

export type GroupBy = 'signataire' | 'destinataire' | null

export type ChartId = 'signataire' | 'evolution' | 'delais' | 'destinataire'

export type AnnexId = 'historique' | 'reponses' | 'retraits' | 'glossaire'

export type TableColId =
  | 'numero'
  | 'dateEnvoi'
  | 'signataire'
  | 'destinataire'
  | 'objet'
  | 'numeroEntrant'
  | 'dateArriveeEntrant'
  | 'dateRetrait'
  | 'nomRetraitant'
  | 'telephone'
  | 'delaiReponse'
  | 'delaiTraitement'
  | 'observation'

export interface KpiDef {
  id: KpiId
  label: string
  glyph: string
  color: string
  value: (s: SituationExecStats) => string
}

export const KPI_DEFS: Record<KpiId, KpiDef> = {
  total: { id: 'total', label: 'Total courriers', glyph: '•', color: COLORS.ink, value: (s) => fmt(s.total) },
  simples: { id: 'simples', label: 'Courriers simples', glyph: '◇', color: COLORS.blue, value: (s) => fmt(s.courriersSimples) },
  reponses: { id: 'reponses', label: 'Courriers réponses', glyph: '↩', color: COLORS.violet, value: (s) => fmt(s.courriersReponses) },
  retires: { id: 'retires', label: 'Retirés', glyph: '✓', color: COLORS.green, value: (s) => fmt(s.retires) },
  livres: { id: 'livres', label: 'Livrés', glyph: '✔', color: COLORS.teal, value: (s) => fmt(s.livres) },
  nouveaux: { id: 'nouveaux', label: 'Nouveaux', glyph: '＋', color: COLORS.blue, value: (s) => fmt(s.nouveaux) },
  mail: { id: 'mail', label: 'Envoyés mail', glyph: '✉', color: COLORS.blue, value: (s) => fmt(s.envoyesMail) },
  coursier: { id: 'coursier', label: 'Envoyés coursier', glyph: '➤', color: COLORS.slate, value: (s) => fmt(s.envoyesCoursier) },
  aRappeler: { id: 'aRappeler', label: 'À rappeler', glyph: '⚠', color: COLORS.red, value: (s) => fmt(s.aRappeler) },
  rappels: { id: 'rappels', label: 'Relances effectuées', glyph: '↻', color: COLORS.amber, value: (s) => fmt(s.rappelsEffectues) },
}

function fmt(n: number): string {
  return n.toLocaleString('fr-FR')
}

export function fmtPct(pc: number): string {
  const v = Math.round(pc * 10) / 10
  return `${Number.isInteger(v) ? String(v) : String(v).replace('.', ',')} %`
}

export interface TableColDef {
  id: TableColId
  header: string
  w: number
}

export const TABLE_COL_DEFS: Record<TableColId, TableColDef> = {
  numero: { id: 'numero', header: 'N°', w: 56 },
  dateEnvoi: { id: 'dateEnvoi', header: 'Date de Sign.', w: 64 },
  signataire: { id: 'signataire', header: 'Signataire', w: 56 },
  destinataire: { id: 'destinataire', header: 'Destinataire', w: 100 },
  objet: { id: 'objet', header: 'Objet', w: 128 },
  numeroEntrant: { id: 'numeroEntrant', header: 'Réponse du courrier N°', w: 72 },
  dateArriveeEntrant: { id: 'dateArriveeEntrant', header: 'Arrivée', w: 64 },
  dateRetrait: { id: 'dateRetrait', header: 'Retrait', w: 46 },
  nomRetraitant: { id: 'nomRetraitant', header: 'Retiré par', w: 58 },
  telephone: { id: 'telephone', header: 'Tél.', w: 48 },
  delaiReponse: { id: 'delaiReponse', header: 'Durée de traitement', w: 64 },
  delaiTraitement: { id: 'delaiTraitement', header: 'Délai avant retrait', w: 42 },
  observation: { id: 'observation', header: 'Obs.', w: 40 },
}

// Colonnes toujours affichées si présentes dans la sélection du type de
// rapport, même quand aucune ligne n'a de valeur (masquage des colonnes
// vides désactivé pour ces colonnes).
export const ALWAYS_VISIBLE_COLS: ReadonlySet<TableColId> = new Set(['numeroEntrant', 'delaiReponse'])

export interface ReportTypeConfig {
  id: string
  label: string
  kpis: KpiId[]
  charts: ChartId[]
  cols: TableColId[]
  groupBy: GroupBy
  annexes: AnnexId[]
  compact?: boolean
  confidentiel?: boolean
}

export const CHART_TITLES: Record<ChartId, string> = {
  signataire: 'Répartition par signataire',
  evolution: 'Évolution des courriers par période',
  delais: 'Répartition des délais de traitement',
  destinataire: 'Répartition par destinataire',
}

// Numérotation des sections graphiques du rapport (section 2, structure fixe).
export const CHART_NUMBERS: Partial<Record<ChartId, string>> = {
  signataire: '2.1',
  delais: '2.2',
}

// Auteur du rapport — valeur FIXE, indépendante de l'utilisateur connecté.
export const PAR_AUTEUR = 'Aboubacar BANGOURA (Chef de Division)'

// Note discrète sous les KPI de la couverture.
export const KPI_NOTE = 'Courriers simples + réponses = total des courriers.'

const DEFAULT_KPIS: KpiId[] = ['total', 'simples', 'reponses', 'retires', 'livres', 'nouveaux', 'aRappeler', 'rappels']
const DEFAULT_CHARTS: ChartId[] = ['signataire', 'delais']
const DEFAULT_COLS: TableColId[] = ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'numeroEntrant', 'delaiReponse']
const DEFAULT_ANNEXES: AnnexId[] = ['historique', 'glossaire']

export const REPORT_TYPES: Record<string, ReportTypeConfig> = {
  generale: {
    id: 'generale',
    label: 'Générale',
    kpis: DEFAULT_KPIS,
    charts: DEFAULT_CHARTS,
    cols: DEFAULT_COLS,
    groupBy: null,
    annexes: DEFAULT_ANNEXES,
  },
  executive: {
    id: 'executive',
    label: 'Exécutive',
    kpis: DEFAULT_KPIS,
    charts: DEFAULT_CHARTS,
    cols: DEFAULT_COLS,
    groupBy: null,
    annexes: DEFAULT_ANNEXES,
    confidentiel: true,
  },
  parSignataire: {
    id: 'parSignataire',
    label: 'Par signataire',
    kpis: ['total', 'simples', 'reponses', 'retires'],
    charts: ['signataire', 'evolution'],
    cols: ['numero', 'dateEnvoi', 'destinataire', 'objet', 'numeroEntrant'],
    groupBy: 'signataire',
    annexes: ['glossaire'],
  },
  parDestinataire: {
    id: 'parDestinataire',
    label: 'Par destinataire',
    kpis: ['total', 'simples', 'reponses', 'retires'],
    charts: ['destinataire', 'evolution'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'objet', 'numeroEntrant'],
    groupBy: 'destinataire',
    annexes: ['glossaire'],
  },
  reponses: {
    id: 'reponses',
    label: 'Courriers réponses',
    kpis: ['total', 'reponses', 'retires'],
    charts: ['evolution'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'numeroEntrant', 'dateArriveeEntrant', 'delaiReponse'],
    groupBy: null,
    annexes: ['reponses', 'glossaire'],
  },
  delais: {
    id: 'delais',
    label: 'Délais de réponse',
    kpis: ['total', 'retires', 'aRappeler'],
    charts: ['delais', 'evolution'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'dateRetrait', 'delaiTraitement'],
    groupBy: null,
    annexes: ['glossaire'],
  },
  retraits: {
    id: 'retraits',
    label: 'Courriers retirés',
    kpis: ['total', 'retires', 'simples', 'reponses'],
    charts: ['delais'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'dateRetrait', 'nomRetraitant', 'telephone', 'delaiTraitement'],
    groupBy: null,
    annexes: ['retraits', 'glossaire'],
  },
  mail: {
    id: 'mail',
    label: 'Envoyés par email',
    kpis: ['total', 'mail', 'retires'],
    charts: ['evolution'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet'],
    groupBy: null,
    annexes: ['glossaire'],
  },
  coursier: {
    id: 'coursier',
    label: 'Envoyés par coursier',
    kpis: ['total', 'coursier', 'retires'],
    charts: ['evolution'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet'],
    groupBy: null,
    annexes: ['glossaire'],
  },
  rappels: {
    id: 'rappels',
    label: 'Avec relances',
    kpis: ['total', 'rappels', 'aRappeler'],
    charts: [],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet'],
    groupBy: null,
    annexes: ['glossaire'],
  },
  personnalisee: {
    id: 'personnalisee',
    label: 'Personnalisée',
    kpis: DEFAULT_KPIS,
    charts: DEFAULT_CHARTS,
    cols: DEFAULT_COLS,
    groupBy: null,
    annexes: DEFAULT_ANNEXES,
  },
}

export function reportConfigFor(typeId: string | null | undefined): ReportTypeConfig {
  return (typeId && REPORT_TYPES[typeId]) || REPORT_TYPES.generale
}

export function visibleKpis(config: ReportTypeConfig, stats: SituationExecStats): KpiId[] {
  return config.kpis.filter((id) => !(id === 'aRappeler' && stats.aRappeler === 0))
}

export type { SituationExecStats }

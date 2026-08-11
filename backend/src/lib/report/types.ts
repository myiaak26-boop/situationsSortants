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
  | 'retraitSecretariat'
  | 'injoignables'
  | 'aRappeler'
  | 'rappels'

export type TemporalId = 'tpsReponse' | 'tpsRetrait' | 'delaiMin' | 'delaiMax'

export type ChartId = 'signataire' | 'situation' | 'mode' | 'evolution' | 'delais' | 'destinataire'

export type GroupBy = 'signataire' | 'situation' | 'destinataire' | null

export type AnnexId = 'historique' | 'reponses' | 'retraits' | 'glossaire'

export type TableColId =
  | 'numero'
  | 'dateEnvoi'
  | 'signataire'
  | 'destinataire'
  | 'objet'
  | 'situation'
  | 'modeTransmission'
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
  retraitSecretariat: { id: 'retraitSecretariat', label: 'Retrait secrétariat', glyph: '▣', color: COLORS.teal, value: (s) => fmt(s.enRetraitSecretariat) },
  injoignables: { id: 'injoignables', label: 'Injoignables', glyph: '✗', color: COLORS.rose, value: (s) => fmt(s.injoignables) },
  aRappeler: { id: 'aRappeler', label: 'À rappeler', glyph: '⚠', color: COLORS.red, value: (s) => fmt(s.aRappeler) },
  rappels: { id: 'rappels', label: 'Relances effectuées', glyph: '↻', color: COLORS.amber, value: (s) => fmt(s.rappelsEffectues) },
}

function fmt(n: number): string {
  return n.toLocaleString('fr-FR')
}

export function fmtJours(n: number): string {
  if (n === 0 || n < 1) return "Moins d'un jour"
  const v = Math.round(n * 10) / 10
  const s = Number.isInteger(v) ? String(v) : String(v).replace('.', ',')
  return `${s} jour${v > 1 ? 's' : ''}`
}

export function fmtPct(pc: number): string {
  const v = Math.round(pc * 10) / 10
  return `${Number.isInteger(v) ? String(v) : String(v).replace('.', ',')} %`
}

export const TEMPORAL_DEFS: Record<TemporalId, { id: TemporalId; label: string; value: (s: SituationExecStats) => string }> = {
  tpsReponse: {
    id: 'tpsReponse',
    label: 'Temps moyen de réponse',
    value: (s) =>
      s.tempsMoyenReponseJours == null
        ? 'Non applicable (aucun courrier concerné)'
        : `${fmtJours(s.tempsMoyenReponseJours)} — ${fmt(s.reponsesConcernes)} courrier${s.reponsesConcernes > 1 ? 's' : ''} concerné${s.reponsesConcernes > 1 ? 's' : ''}`,
  },
  tpsRetrait: {
    id: 'tpsRetrait',
    label: 'Temps moyen avant retrait',
    value: (s) =>
      s.tempsMoyenRetraitJours == null
        ? 'Non applicable (aucun courrier concerné)'
        : `${fmtJours(s.tempsMoyenRetraitJours)} — ${fmt(s.retraitsConcernes)} courrier${s.retraitsConcernes > 1 ? 's' : ''} concerné${s.retraitsConcernes > 1 ? 's' : ''}`,
  },
  delaiMin: { id: 'delaiMin', label: 'Délai de réponse min.', value: (s) => (s.delaiMinJours == null ? 'Non applicable (aucun courrier concerné)' : fmtJours(s.delaiMinJours)) },
  delaiMax: { id: 'delaiMax', label: 'Délai de réponse max.', value: (s) => (s.delaiMaxJours == null ? 'Non applicable (aucun courrier concerné)' : fmtJours(s.delaiMaxJours)) },
}

export interface TableColDef {
  id: TableColId
  header: string
  w: number
}

export const TABLE_COL_DEFS: Record<TableColId, TableColDef> = {
  numero: { id: 'numero', header: 'N°', w: 56 },
  dateEnvoi: { id: 'dateEnvoi', header: "Date de sign.", w: 64 },
  signataire: { id: 'signataire', header: 'Signataire', w: 56 },
  destinataire: { id: 'destinataire', header: 'Destinataire', w: 100 },
  objet: { id: 'objet', header: 'Objet', w: 128 },
  situation: { id: 'situation', header: 'Statut de suivi', w: 84 },
  modeTransmission: { id: 'modeTransmission', header: 'Mode transm.', w: 62 },
  numeroEntrant: { id: 'numeroEntrant', header: 'Réponse', w: 42 },
  dateArriveeEntrant: { id: 'dateArriveeEntrant', header: 'Arrivée', w: 64 },
  dateRetrait: { id: 'dateRetrait', header: 'Retrait', w: 46 },
  nomRetraitant: { id: 'nomRetraitant', header: 'Retiré par', w: 58 },
  telephone: { id: 'telephone', header: 'Tél.', w: 48 },
  delaiReponse: { id: 'delaiReponse', header: 'Délai réponse', w: 42 },
  delaiTraitement: { id: 'delaiTraitement', header: 'Délai avant retrait', w: 42 },
  observation: { id: 'observation', header: 'Obs.', w: 40 },
}

export interface ReportTypeConfig {
  id: string
  label: string
  kpis: KpiId[]
  temporals: TemporalId[]
  charts: ChartId[]
  cols: TableColId[]
  groupBy: GroupBy
  annexes: AnnexId[]
  compact?: boolean
  confidentiel?: boolean
}

export const CHART_TITLES: Record<ChartId, string> = {
  signataire: 'Répartition par signataire',
  situation: 'Répartition par statut de suivi',
  mode: 'Répartition par mode de transmission',
  evolution: 'Évolution des courriers par période',
  delais: 'Répartition des délais de traitement',
  destinataire: 'Répartition par destinataire',
}

const DEFAULT_KPIS: KpiId[] = ['total', 'simples', 'reponses', 'retires', 'livres', 'nouveaux', 'injoignables', 'aRappeler', 'rappels']
const DEFAULT_TEMPORALS: TemporalId[] = ['tpsReponse', 'tpsRetrait', 'delaiMin', 'delaiMax']
const DEFAULT_CHARTS: ChartId[] = ['signataire', 'situation', 'mode', 'evolution', 'delais']
const DEFAULT_COLS: TableColId[] = ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'situation', 'modeTransmission', 'numeroEntrant', 'dateArriveeEntrant', 'dateRetrait']
const DEFAULT_ANNEXES: AnnexId[] = ['historique', 'glossaire']

export const REPORT_TYPES: Record<string, ReportTypeConfig> = {
  generale: {
    id: 'generale',
    label: 'Générale',
    kpis: DEFAULT_KPIS,
    temporals: DEFAULT_TEMPORALS,
    charts: DEFAULT_CHARTS,
    cols: DEFAULT_COLS,
    groupBy: null,
    annexes: DEFAULT_ANNEXES,
  },
  executive: {
    id: 'executive',
    label: 'Exécutive',
    kpis: DEFAULT_KPIS,
    temporals: DEFAULT_TEMPORALS,
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
    temporals: DEFAULT_TEMPORALS,
    charts: ['signataire', 'evolution'],
    cols: ['numero', 'dateEnvoi', 'destinataire', 'objet', 'situation', 'numeroEntrant'],
    groupBy: 'signataire',
    annexes: ['glossaire'],
  },
  parSituation: {
    id: 'parSituation',
    label: 'Par situation',
    kpis: ['total', 'retires', 'injoignables'],
    temporals: [],
    charts: ['situation'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'modeTransmission'],
    groupBy: 'situation',
    annexes: [],
  },
  parDestinataire: {
    id: 'parDestinataire',
    label: 'Par destinataire',
    kpis: ['total', 'simples', 'reponses', 'retires'],
    temporals: ['tpsReponse'],
    charts: ['destinataire', 'evolution'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'objet', 'situation', 'numeroEntrant'],
    groupBy: 'destinataire',
    annexes: ['glossaire'],
  },
  reponses: {
    id: 'reponses',
    label: 'Courriers réponses',
    kpis: ['total', 'reponses', 'retires'],
    temporals: ['tpsReponse'],
    charts: ['situation', 'evolution'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'numeroEntrant', 'dateArriveeEntrant', 'delaiReponse', 'situation'],
    groupBy: null,
    annexes: ['reponses', 'glossaire'],
  },
  delais: {
    id: 'delais',
    label: 'Délais de réponse',
    kpis: ['total', 'retires', 'aRappeler'],
    temporals: ['tpsReponse', 'tpsRetrait', 'delaiMin', 'delaiMax'],
    charts: ['delais', 'evolution'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'dateRetrait', 'delaiTraitement'],
    groupBy: null,
    annexes: ['glossaire'],
  },
  retraits: {
    id: 'retraits',
    label: 'Courriers retirés',
    kpis: ['total', 'retires', 'simples', 'reponses'],
    temporals: ['tpsRetrait', 'delaiMin', 'delaiMax'],
    charts: ['mode', 'delais'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'dateRetrait', 'nomRetraitant', 'telephone', 'delaiTraitement'],
    groupBy: null,
    annexes: ['retraits', 'glossaire'],
  },
  mail: {
    id: 'mail',
    label: 'Envoyés par email',
    kpis: ['total', 'mail', 'retires'],
    temporals: ['tpsRetrait'],
    charts: ['evolution'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'situation'],
    groupBy: null,
    annexes: ['glossaire'],
  },
  coursier: {
    id: 'coursier',
    label: 'Envoyés par coursier',
    kpis: ['total', 'coursier', 'retires'],
    temporals: ['tpsRetrait'],
    charts: ['evolution'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'situation'],
    groupBy: null,
    annexes: ['glossaire'],
  },
  injoignables: {
    id: 'injoignables',
    label: 'Injoignables',
    kpis: ['total', 'injoignables', 'aRappeler'],
    temporals: [],
    charts: [],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'situation', 'telephone'],
    groupBy: null,
    annexes: ['glossaire'],
  },
  rappels: {
    id: 'rappels',
    label: 'Avec relances',
    kpis: ['total', 'rappels', 'aRappeler'],
    temporals: [],
    charts: ['situation'],
    cols: ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'situation'],
    groupBy: null,
    annexes: ['glossaire'],
  },
  personnalisee: {
    id: 'personnalisee',
    label: 'Personnalisée',
    kpis: DEFAULT_KPIS,
    temporals: DEFAULT_TEMPORALS,
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

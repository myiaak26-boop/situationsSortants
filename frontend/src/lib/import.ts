export const FIELD_LABELS: Record<string, string> = {
  numero: 'Numéro',
  dateEnvoi: "Date de signature",
  destinataire: 'Destinataire',
  objet: 'Objet',
  signataire: 'Signataire',
  nombrePages: 'Nombre de pages',
  expediteur: 'Expéditeur',
  dateObservation: "Date d'observation",
  numeroEntrant: 'Réponse au courrier (N°)',
  dateArriveeEntrant: "Date d'arrivée (courrier entrant)",
  dureeTraitement: 'Durée de traitement',
}

export const REQUIRED_FIELDS = ['numero', 'dateEnvoi', 'destinataire', 'objet'] as const
export const OPTIONAL_FIELDS = ['signataire', 'nombrePages', 'expediteur', 'dateObservation', 'numeroEntrant', 'dateArriveeEntrant', 'dureeTraitement'] as const
export const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const

export type FieldKey = (typeof ALL_FIELDS)[number]
export type ColumnMapping = Record<FieldKey, string | null>

export interface SheetMeta {
  name: string
  rows: number
  cols: number
}

export interface InspectResponse {
  token: string
  fileName: string
  size: number
  modifiedAt: string | null
  maxSizeMo: number
  sheets: SheetMeta[]
}

export interface SheetResponse {
  columns: string[]
  totalRows: number
  preview: unknown[][]
  detectedMapping: ColumnMapping
}

export interface DupFile {
  numero: string
  lignes: number[]
}

export interface RowError {
  ligne: number
  type: 'numero_manquant' | 'date_invalide' | 'nombre_pages_invalide'
  message: string
}

export type LigneStatut = 'NOUVEAU' | 'EXISTANT' | 'A_VERIFIER'

export type DureeDecision = 'importer' | 'conserver' | 'a_verifier'

export interface PreviewLigne {
  ligne: number
  numero: string
  dateEnvoi: string | null
  signataire: string
  signataireReconnu: boolean
  destinataire: string
  objet: string
  numeroEntrant: string | null
  dureeTraitement: string | null
  dureeExcel: number | null
  dureeBase: number | null
  dureeDecision: DureeDecision
  statut: LigneStatut
  message: string
}

export interface ValidationReport {
  valid: boolean
  colonnesManquantes: string[]
  total: number
  vides: number
  prets: number
  doublonsFichier: DupFile[]
  doublonsBase: { numero: string }[]
  erreurs: RowError[]
  erreurCritique: boolean
  lignes: PreviewLigne[]
}

export interface ProgressSnapshot {
  status: 'running' | 'done' | 'error' | 'cancelled'
  processed: number
  total: number
  importes: number
  ignores: number
  maj: number
  erreurs: number
  cancelRequested: boolean
}

export interface FinalReport {
  status: 'done' | 'error' | 'cancelled'
  error?: string
  total: number
  importes: number
  ignores: number
  maj: number
  erreurs: number
  details: string[]
  dureeMs: number
  fileName: string
  sheetName: string
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data && typeof (data as { error?: string }).error === 'string' && (data as { error: string }).error) || 'Erreur serveur')
  }
  return data
}

export async function inspectFile(file: File): Promise<InspectResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/import/inspect', { method: 'POST', body: form })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data && typeof (data as { error?: string }).error === 'string' && (data as { error: string }).error) || 'Erreur serveur')
  }
  return data as InspectResponse
}

export async function fetchSheet(token: string, sheetName: string): Promise<SheetResponse> {
  return (await postJson('/api/import/sheet', { token, sheetName })) as SheetResponse
}

export async function validateRows(
  token: string,
  sheetName: string,
  mapping: ColumnMapping,
): Promise<ValidationReport> {
  return (await postJson('/api/import/validate', { token, sheetName, mapping })) as ValidationReport
}

export async function startImport(
  token: string,
  sheetName: string,
  mapping: ColumnMapping,
  duplicatePolicy: 'ignore' | 'update',
): Promise<{ jobId: string; total: number }> {
  return (await postJson('/api/import/execute', { token, sheetName, mapping, duplicatePolicy })) as {
    jobId: string
    total: number
  }
}

export async function fetchProgress(jobId: string): Promise<ProgressSnapshot> {
  const res = await fetch(`/api/import/progress/${jobId}`)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && (data as { error?: string }).error) || 'Erreur serveur')
  return data as ProgressSnapshot
}

export async function cancelImport(jobId: string): Promise<void> {
  await fetch(`/api/import/cancel/${jobId}`, { method: 'POST' })
}

export async function fetchResult(jobId: string): Promise<FinalReport> {
  const res = await fetch(`/api/import/result/${jobId}`)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && (data as { error?: string }).error) || 'Erreur serveur')
  return data as FinalReport
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${bytes} o`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
}

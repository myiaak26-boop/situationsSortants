import XLSX from 'xlsx'
import { prisma } from './prisma.js'
import { CellMeta, formatDureeJours, normalizeDuration } from './duree.js'

// Diagnostic temporaire de la durée de traitement (voir SPEC §14) : activé via
// DEX_DEBUG_DUREE=1 dans l'environnement, désactivé par défaut en production.
const DEBUG_DUREE = process.env.DEX_DEBUG_DUREE === '1'

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

const ALIASES: Record<FieldKey, string[]> = {
  numero: ['Numéro', 'N°', 'No', 'No.', 'Référence', 'Réf', 'Numéro courrier'],
  dateEnvoi: ["Date d'Envoie", "Date d'Envoi", "Date d'envoi", "Date d'envois", 'Date Expédition', "Date d'Expédition", 'Date Signataire', 'Date de signature'],
  destinataire: ['Nom destinataire', 'Destinataire', 'Nom du destinataire', 'Destinataire nom'],
  objet: ['Objet'],
  signataire: ['Signataire', 'Signé par', 'Signe par'],
  nombrePages: ['Nombre de Page', 'Nombre de pages', 'Nbre pages', 'Pages'],
  expediteur: ['Expéditeur', 'Émetteur', 'Service expéditeur', 'Expéditeur service'],
  dateObservation: ["Date d'Observation", "Date d'observation", 'Date observation'],
  numeroEntrant: ['Réponse au courrier (N°)', 'Reponse au courrier (N°)', 'N° réponse', 'N° Réponse', 'Numéro entrant', 'N° courrier entrant', 'N° courrier entrant', "Numéro du courrier à l'arrivée", 'Numero du courrier a l arrivee', "Numéro courrier à l'arrivée", 'Numéro de courrier à l arrivée', "N° du courrier à l'arrivée"],
  dateArriveeEntrant: ["Date d'arrivée du courrier entrant", "Date d'arrivée courrier entrant", "Date d'arrivée", 'Date arrivée', 'Date arrivée courrier entrant', 'Date de réception', 'Date réception'],
  dureeTraitement: ['Durée de traitement', 'Duree de traitement', 'Durée', 'Durée du traitement', 'Délai de traitement'],
}

const REQUIRED_MESSAGE: Record<string, string> = {
  numero: 'Numéro',
  dateEnvoi: "Date de signature",
  destinataire: 'Destinataire',
  objet: 'Objet',
}

export interface SheetMatrix {
  columns: string[]
  rows: unknown[][]
  // Numéro de ligne Excel (1-based, en-tête = 1) de chaque ligne non vide,
  // parallèle à `rows` — permet de relire les métadonnées de cellule
  // (format date, formule) dans la feuille d'origine.
  rowNumbers: number[]
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/[^\w°.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cellToString(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v).trim()
}

function isRowEmpty(row: unknown[]): boolean {
  return row.every((v) => cellToString(v) === '')
}

export function buildMatrix(sheet: XLSX.WorkSheet): SheetMatrix {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true })
  const columns: string[] = []
  const seen = new Set<string>()
  for (const c of matrix[0] || []) {
    const name = cellToString(c)
    let key = name
    let i = 2
    while (seen.has(normalizeKey(key))) {
      key = `${name}_${i++}`
    }
    if (key !== '') seen.add(normalizeKey(key))
    columns.push(name)
  }
  const rows: unknown[][] = []
  const rowNumbers: number[] = []
  ;(matrix.slice(1) || []).forEach((r, i) => {
    if (!isRowEmpty(r)) {
      rows.push(r)
      rowNumbers.push(i + 2)
    }
  })
  return { columns, rows, rowNumbers }
}

export function sheetToRecords(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const { columns, rows } = buildMatrix(sheet)
  return rows.map((row) => {
    const record: Record<string, unknown> = {}
    columns.forEach((col, i) => {
      record[col] = row[i] ?? ''
    })
    return record
  })
}

function isRecordEmpty(record: Record<string, unknown>): boolean {
  return Object.values(record).every((v) => cellToString(v) === '')
}

function firstHeaderMatching(columns: string[], aliasKeys: string[]): string | null {
  const normCols = columns.map(normalizeKey)
  for (const alias of aliasKeys) {
    const nk = normalizeKey(alias)
    const idx = normCols.indexOf(nk)
    if (idx !== -1) return columns[idx]
  }
  return null
}

export function detectMapping(columns: string[]): ColumnMapping {
  const mapping: ColumnMapping = { numero: null, dateEnvoi: null, destinataire: null, objet: null, signataire: null, nombrePages: null, expediteur: null, dateObservation: null, numeroEntrant: null, dateArriveeEntrant: null, dureeTraitement: null }
  const used = new Set<string>()

  for (const field of ALL_FIELDS) {
    const aliasKeys = ALIASES[field]
    for (const alias of aliasKeys) {
      const nk = normalizeKey(alias)
      const normCols = columns.map(normalizeKey)
      const idx = normCols.indexOf(nk)
      if (idx !== -1 && !used.has(columns[idx])) {
        mapping[field] = columns[idx]
        used.add(columns[idx])
        break
      }
    }
  }
  return mapping
}

export function resolveMapping(mapping: ColumnMapping, columns: string[]): Record<FieldKey, number> {
  const normCols = columns.map(normalizeKey)
  const resolved: Record<FieldKey, number> = { numero: -1, dateEnvoi: -1, destinataire: -1, objet: -1, signataire: -1, nombrePages: -1, expediteur: -1, dateObservation: -1, numeroEntrant: -1, dateArriveeEntrant: -1, dureeTraitement: -1 }
  for (const field of ALL_FIELDS) {
    const header = mapping[field]
    if (!header) continue
    const idx = normCols.indexOf(normalizeKey(header))
    resolved[field] = idx
  }
  return resolved
}

export function mappingErrors(mapping: ColumnMapping): string[] {
  const missing: string[] = []
  for (const field of REQUIRED_FIELDS) {
    if (!mapping[field]) missing.push(REQUIRED_MESSAGE[field])
  }
  return missing
}

function excelSerialToDate(serial: number): Date | null {
  if (!isFinite(serial) || serial < 1) return null
  const msPerDay = 86400000
  const utcDay = new Date(Math.round((serial - 25569) * msPerDay))
  if (isNaN(utcDay.getTime())) return null
  return new Date(utcDay.getUTCFullYear(), utcDay.getUTCMonth(), utcDay.getUTCDate())
}

export function numeroKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.-]/g, '')
    .trim()
}

const FR_MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, 'janv.': 1,
  fevrier: 2, 'février': 2, fevr: 2, 'févr': 2, 'févr.': 2, 'fevr.': 2,
  mars: 3,
  avril: 4, avr: 4, 'avr.': 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7, 'juil.': 7,
  aout: 8, 'août': 8,
  septembre: 9, sept: 9, 'sept.': 9,
  octobre: 10, oct: 10, 'oct.': 10,
  novembre: 11, nov: 11, 'nov.': 11,
  decembre: 12, 'décembre': 12, dec: 12, 'déc': 12, 'déc.': 12, 'dec.': 12,
}

function tryParseFrTextual(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\s+([a-zA-Zàâäéèêëîïôöùûüçœ\-\.]+)\s+(\d{4})$/)
  if (!m) return null
  const month = FR_MONTHS[m[2].toLowerCase().trim()]
  if (!month) return null
  const day = Number(m[1])
  const year = Number(m[3])
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) return dt
  return null
}

export function parseDateValue(v: unknown): Date | null {
  if (v === undefined || v === null || v === '') return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  if (typeof v === 'number' && isFinite(v)) {
    return excelSerialToDate(v)
  }
  const s = String(v).trim()
  if (!s) return null

  // Formats français d'abord (jj/mm/aaaa, jj-mm-aaaa, jj.mm.aaaa, années à 2 chiffres)
  const fr = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (fr) {
    const [, dd, mm, yyyy] = fr
    const y = Number(yyyy) < 100 ? 2000 + Number(yyyy) : Number(yyyy)
    const dt = new Date(y, Number(mm) - 1, Number(dd))
    if (dt.getFullYear() === y && dt.getMonth() === Number(mm) - 1 && dt.getDate() === Number(dd)) return dt
    return null
  }

  // Dates textuelles françaises : « 5 mars 2024 », « 5 mars 2024 » (+ variantes courtes)
  const textual = tryParseFrTextual(s)
  if (textual) return textual

  // Format ISO (aaaa-mm-jj, avec ou sans heure)
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):?(\d{2})?(?::?(\d{2}))?)?$/)
  if (iso) {
    const [, y, mo, d] = iso
    const hour = iso[4] ? Number(iso[4]) : 0
    const min = iso[5] ? Number(iso[5]) : 0
    const sec = iso[6] ? Number(iso[6]) : 0
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), hour, min, sec)
    if (dt.getFullYear() === Number(y) && dt.getMonth() === Number(mo) - 1 && dt.getDate() === Number(d)) return dt
    return null
  }

  // Dernier recours : interprétation du moteur JS (formats exotiques)
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function isValidPageCount(v: unknown): boolean {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return isFinite(n) && Number.isInteger(n) && n > 0
}

function pageCountValue(v: unknown): number | null {
  if (v === undefined || v === null || cellToString(v) === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return isFinite(n) && Number.isInteger(n) && n > 0 ? n : null
}

function valueAt(row: unknown[], idx: number): unknown {
  if (idx < 0 || idx >= row.length) return undefined
  return row[idx]
}

export interface PreparedRow {
  ligne: number
  numero: string
  dateEnvoi: Date
  destinataire: string
  objet: string
  signataire: string
  signataireId: string | null
  numeroEntrant: string | null
  dateArriveeEntrant: Date | null
  nombrePages: number | null
  expediteur: string | null
  dateObservation: Date | null
  dureeTraitement: number | null
}

export type DureeDecision = 'importer' | 'conserver' | 'a_verifier'

export interface RowError {
  ligne: number
  type: 'numero_manquant' | 'date_invalide' | 'nombre_pages_invalide'
  message: string
}

export type LigneStatut = 'NOUVEAU' | 'EXISTANT' | 'A_VERIFIER'

export interface PreviewLigne {
  ligne: number
  numero: string
  dateEnvoi: string | null
  signataire: string
  signataireReconnu: boolean
  destinataire: string
  objet: string
  numeroEntrant: string | null
  // Valeur brute lue dans Excel (affichée telle quelle)
  dureeTraitement: string | null
  // Valeur normalisée depuis Excel (jours) — affichée en « Durée Excel »
  dureeExcel: number | null
  // Valeur actuelle en base (jours) — affichée en « Durée DEX »
  dureeBase: number | null
  // Décision d'import : Importer / Conserver DEX / À vérifier
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
  doublonsFichier: { numero: string; lignes: number[] }[]
  doublonsBase: { numero: string }[]
  erreurs: RowError[]
  erreurCritique: boolean
  lignes: PreviewLigne[]
}

export function validateRows(
  records: Record<string, unknown>[],
  mapping: ColumnMapping,
  existingByKey: Map<string, string>,
  signataires?: { code: string; nom: string }[],
  existingDureeByKey?: Map<string, number | null>,
): ValidationReport {
  const missing = mappingErrors(mapping)
  const columns = records.length > 0 ? Object.keys(records[0]) : []
  const resolved = resolveMapping(mapping, columns)
  const emptyRows = records.filter(isRecordEmpty).length
  const total = records.length - emptyRows

  const seen = new Map<string, number[]>()
  const doublonsBase: { numero: string }[] = []
  const erreurs: RowError[] = []
  const pretsNumeros = new Set<string>()
  const lignes: PreviewLigne[] = []

  const dureeBaseOf = (numero: string): number | null => {
    const raw = existingDureeByKey?.get(numeroKey(numero))
    return raw === undefined || raw === null ? null : normalizeDuration(raw)
  }
  const dureeDecisionOf = (excel: number | null, base: number | null): DureeDecision => {
    if (excel === null) return 'conserver'
    if (base === null) return 'importer'
    return Math.abs(excel - base) < 1e-6 ? 'conserver' : 'a_verifier'
  }
  const dureeInfoOf = (numero: string, raw: unknown): { dureeExcel: number | null; dureeBase: number | null; dureeDecision: DureeDecision } => {
    const dureeExcel = normalizeDuration(raw)
    const dureeBase = dureeBaseOf(numero)
    return { dureeExcel, dureeBase, dureeDecision: dureeDecisionOf(dureeExcel, dureeBase) }
  }

  const sigCodes = new Set((signataires ?? []).map((s) => s.code.trim().toUpperCase()))
  const sigNoms = new Set((signataires ?? []).map((s) => normalizeKey(s.nom)))
  const isSignataireReconnu = (v: string): boolean => {
    const raw = v.trim()
    if (!raw) return true
    const upper = raw.toUpperCase()
    if (sigCodes.has(upper)) return true
    if (sigNoms.has(normalizeKey(raw))) return true
    const idx = upper.indexOf(' ')
    return idx > 0 && sigCodes.has(upper.slice(0, idx))
  }

  let i = 0
  for (const row of records) {
    const ligne = i + 2
    i++
    if (isRecordEmpty(row)) continue

    const values = Object.values(row)
    const numero = cellToString(valueAt(values, resolved.numero))
    if (!numero) {
      erreurs.push({ ligne, type: 'numero_manquant', message: 'Numéro manquant' })
      const dureeRawNumeroManquant = valueAt(values, resolved.dureeTraitement)
      lignes.push({ ligne, numero: '', dateEnvoi: null, signataire: '', signataireReconnu: true, destinataire: '', objet: '', numeroEntrant: null, dureeTraitement: cellToString(dureeRawNumeroManquant) || null, dureeExcel: normalizeDuration(dureeRawNumeroManquant), dureeBase: null, dureeDecision: 'conserver', statut: 'A_VERIFIER', message: 'Numéro manquant' })
      continue
    }
    const key = numeroKey(numero)

    const dateV = valueAt(values, resolved.dateEnvoi)
    let dateEnvoiIso: string | null = null
    if (resolved.dateEnvoi !== -1) {
      const d = parseDateValue(dateV)
      if (!d) {
        erreurs.push({ ligne, type: 'date_invalide', message: `Date de signature invalide` })
        const dureeRawDate = valueAt(values, resolved.dureeTraitement)
        lignes.push({ ligne, numero, dateEnvoi: null, signataire: cellToString(valueAt(values, resolved.signataire)), signataireReconnu: isSignataireReconnu(cellToString(valueAt(values, resolved.signataire))), destinataire: cellToString(valueAt(values, resolved.destinataire)), objet: cellToString(valueAt(values, resolved.objet)), numeroEntrant: cellToString(valueAt(values, resolved.numeroEntrant)) || null, dureeTraitement: cellToString(dureeRawDate) || null, dureeExcel: normalizeDuration(dureeRawDate), dureeBase: dureeBaseOf(numero), dureeDecision: dureeDecisionOf(normalizeDuration(dureeRawDate), dureeBaseOf(numero)), statut: 'A_VERIFIER', message: 'Date de signature invalide' })
        continue
      }
      dateEnvoiIso = d.toISOString()
    }

    const pagesV = valueAt(values, resolved.nombrePages)
    if (resolved.nombrePages !== -1 && cellToString(pagesV) !== '' && !isValidPageCount(pagesV)) {
      erreurs.push({ ligne, type: 'nombre_pages_invalide', message: `Nombre de pages invalide (« ${cellToString(pagesV)} »)` })
      const dureeRawPages = valueAt(values, resolved.dureeTraitement)
      lignes.push({ ligne, numero, dateEnvoi: dateEnvoiIso, signataire: cellToString(valueAt(values, resolved.signataire)), signataireReconnu: isSignataireReconnu(cellToString(valueAt(values, resolved.signataire))), destinataire: cellToString(valueAt(values, resolved.destinataire)), objet: cellToString(valueAt(values, resolved.objet)), numeroEntrant: cellToString(valueAt(values, resolved.numeroEntrant)) || null, dureeTraitement: cellToString(dureeRawPages) || null, dureeExcel: normalizeDuration(dureeRawPages), dureeBase: dureeBaseOf(numero), dureeDecision: dureeDecisionOf(normalizeDuration(dureeRawPages), dureeBaseOf(numero)), statut: 'A_VERIFIER', message: `Nombre de pages invalide (« ${cellToString(pagesV)} »)` })
      continue
    }

    const signataireValue = cellToString(valueAt(values, resolved.signataire))
    const signataireReconnu = isSignataireReconnu(signataireValue)
    const dureeRaw = valueAt(values, resolved.dureeTraitement)
    const dureeNorm = normalizeDuration(dureeRaw)
    const dureeBase = dureeBaseOf(numero)
    const ligneInfo: PreviewLigne = {
      ligne,
      numero,
      dateEnvoi: dateEnvoiIso,
      signataire: signataireValue || 'Non renseigné',
      signataireReconnu,
      destinataire: cellToString(valueAt(values, resolved.destinataire)) || 'Non renseigné',
      objet: cellToString(valueAt(values, resolved.objet)) || 'Sans objet',
      numeroEntrant: cellToString(valueAt(values, resolved.numeroEntrant)) || null,
      dureeTraitement: cellToString(dureeRaw) || null,
      dureeExcel: dureeNorm,
      dureeBase,
      dureeDecision: dureeDecisionOf(dureeNorm, dureeBase),
      statut: 'NOUVEAU',
      message: '',
    }

    if (existingByKey.has(key) || pretsNumeros.has(key)) {
      if (existingByKey.has(key)) {
        doublonsBase.push({ numero })
        ligneInfo.statut = 'EXISTANT'
        ligneInfo.message = 'Déjà présent dans la base'
      } else {
        const list = seen.get(key) || []
        list.push(ligne)
        seen.set(key, list)
        ligneInfo.statut = 'A_VERIFIER'
        ligneInfo.message = 'Numéro dupliqué dans le fichier'
      }
    } else {
      pretsNumeros.add(key)
    }
    if (signataireValue && !signataireReconnu) {
      ligneInfo.statut = 'A_VERIFIER'
      ligneInfo.message = 'Signataire non reconnu'
    }
    lignes.push(ligneInfo)
  }

  const doublonsFichier = [...seen.entries()].map(([key, lignes]) => ({ numero: key, lignes }))

  return {
    valid: missing.length === 0,
    colonnesManquantes: missing,
    total,
    vides: emptyRows,
    prets: Math.max(0, total - doublonsFichier.length - doublonsBase.length - erreurs.length),
    doublonsFichier,
    doublonsBase,
    erreurs,
    erreurCritique: missing.length > 0,
    lignes,
  }
}

export interface ImportOutcome {
  total: number
  importes: number
  ignores: number
  maj: number
  erreurs: number
  details: string[]
}

export interface ExecuteContext {
  records: Record<string, unknown>[]
  mapping: ColumnMapping
  duplicatePolicy: 'ignore' | 'update'
  fileName: string
  userId: string
  userName: string
  situationId: string
  modeTransmissionId: string
  modeCle: string | null
  batchSize: number
  existingByKey: Map<string, string>
  deletedByKey?: Map<string, string>
  // Feuille Excel d'origine + numéros de ligne réels (parallèles à `records`) :
  // permet de vérifier le format de cellule avant de convertir une durée
  // numérique (une cellule formatée comme une date n'est PAS une durée).
  sheet?: XLSX.WorkSheet
  sheetRowNumbers?: number[]
  onProgress?: (processed: number, importes: number, ignores: number, maj: number, erreurs: number) => void
  isCancelled?: () => boolean
}

function cellMetaAt(sheet: XLSX.WorkSheet | undefined, excelRow: number | undefined, colIdx: number): CellMeta | null {
  if (!sheet || !excelRow) return null
  const cell = sheet[XLSX.utils.encode_cell({ r: excelRow - 1, c: colIdx })]
  if (!cell) return null
  return { t: cell.t, z: cell.z }
}

function dureeEquals(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b
  return Math.abs(a - b) < 1e-6
}

export async function executeImport(ctx: ExecuteContext): Promise<ImportOutcome> {
  const { records, mapping, duplicatePolicy, fileName, userId, situationId, modeTransmissionId, modeCle, batchSize, onProgress, isCancelled } = ctx
  const deletedByKey = ctx.deletedByKey ?? new Map<string, string>()
  const columns = records.length > 0 ? Object.keys(records[0]) : []
  const resolved = resolveMapping(mapping, columns)
  const now = new Date()
  const details: string[] = []
  const MAX_DETAILS = 200

  const toCreate: PreparedRow[] = []
  const toUpdate: PreparedRow[] = []
  const toRevive: PreparedRow[] = []
  const seen = new Set<string>()
  let ignores = 0
  let erreurs = 0
  let total = 0

  const signataires = await prisma.signataire.findMany({ select: { id: true, code: true, nom: true } })
  const signataireByCode = new Map(signataires.map((s) => [s.code.trim().toUpperCase(), { id: s.id, code: s.code }]))
  const signataireByNom = new Map(signataires.map((s) => [normalizeKey(s.nom), { id: s.id, code: s.code }]))
  const resolveSignataire = (nom: string): { id: string; code: string } | null => {
    const raw = nom.trim()
    if (!raw) return null
    const upper = raw.toUpperCase()
    if (signataireByCode.has(upper)) return signataireByCode.get(upper)!
    const byNom = signataireByNom.get(normalizeKey(raw))
    if (byNom) return byNom
    const idx = upper.indexOf(' ')
    if (idx > 0 && signataireByCode.has(upper.slice(0, idx))) return signataireByCode.get(upper.slice(0, idx))!
    return null
  }

  const pushDetail = (d: string) => {
    if (details.length < MAX_DETAILS) details.push(d)
  }

  let i = 0
  for (const row of records) {
    if (isRecordEmpty(row)) continue
    const ligne = i + 2
    i++
    total++

    const values = Object.values(row)
    const numero = cellToString(valueAt(values, resolved.numero))
    if (!numero) {
      erreurs++
      pushDetail(`Ligne ${ligne} : Numéro manquant`)
      continue
    }
    const key = numeroKey(numero)
    const dateEnvoi = parseDateValue(valueAt(values, resolved.dateEnvoi))
    if (!dateEnvoi) {
      erreurs++
      pushDetail(`Ligne ${ligne} : Date de signature invalide (« ${cellToString(valueAt(values, resolved.dateEnvoi))} »)`)
      continue
    }
    const pagesV = valueAt(values, resolved.nombrePages)
    if (resolved.nombrePages !== -1 && cellToString(pagesV) !== '' && !isValidPageCount(pagesV)) {
      erreurs++
      pushDetail(`Ligne ${ligne} : Nombre de pages invalide (« ${cellToString(pagesV)} »)`)
      continue
    }

    const dateArriveeEntrant = parseDateValue(valueAt(values, resolved.dateArriveeEntrant))
    const dateObservation = parseDateValue(valueAt(values, resolved.dateObservation))
    const dureeRawV = valueAt(values, resolved.dureeTraitement)
    const dureeMeta = cellMetaAt(ctx.sheet, ctx.sheetRowNumbers?.[i], resolved.dureeTraitement)
    const dureeTraitement = normalizeDuration(dureeRawV, dureeMeta)
    if (DEBUG_DUREE && resolved.dureeTraitement !== -1 && cellToString(dureeRawV) !== '' && dureeTraitement !== null) {
      console.log('[duree]', JSON.stringify({
        numero,
        rawDuration: dureeRawV,
        rawType: typeof dureeRawV,
        cellFormat: dureeMeta?.z ?? null,
        normalizedDuration: dureeTraitement,
        storedDuration: dureeTraitement,
      }))
    }
    const rawSignataire = cellToString(valueAt(values, resolved.signataire)) || 'Non renseigné'
    const sig = resolveSignataire(rawSignataire)

    const prepared: PreparedRow = {
      ligne,
      numero,
      dateEnvoi,
      destinataire: cellToString(valueAt(values, resolved.destinataire)) || 'Non renseigné',
      objet: cellToString(valueAt(values, resolved.objet)) || 'Sans objet',
      signataire: sig ? sig.code : rawSignataire,
      signataireId: sig ? sig.id : null,
      numeroEntrant: cellToString(valueAt(values, resolved.numeroEntrant)) || null,
      dateArriveeEntrant,
      nombrePages: pageCountValue(valueAt(values, resolved.nombrePages)),
      expediteur: cellToString(valueAt(values, resolved.expediteur)) || null,
      dateObservation,
      dureeTraitement,
    }

    const baseNumero = ctx.existingByKey.get(key)
    if (baseNumero !== undefined || seen.has(key)) {
      if (duplicatePolicy === 'update' && baseNumero !== undefined) {
        toUpdate.push({ ...prepared, numero: baseNumero })
      } else {
        ignores++
      }
      seen.add(key)
      continue
    }
    if (deletedByKey.has(key)) {
      toRevive.push({ ...prepared, numero: deletedByKey.get(key)! })
      seen.add(key)
      continue
    }
    toCreate.push(prepared)
    seen.add(key)
  }

  let importes = 0
  let maj = 0
  let processedCount = 0

  for (let b = 0; b < toCreate.length; b += batchSize) {
    if (isCancelled?.()) break
    const batch = toCreate.slice(b, b + batchSize)
    const tx = batch.map((r) =>
      prisma.courrier.create({
        data: {
          numero: r.numero,
          dateEnvoi: r.dateEnvoi,
          destinataire: r.destinataire,
          objet: r.objet,
          signataire: r.signataire,
          signataireId: r.signataireId,
          numeroEntrant: r.numeroEntrant,
          dateArriveeEntrant: r.dateArriveeEntrant,
          nombrePages: r.nombrePages,
          expediteur: r.expediteur,
          dateObservation: r.dateObservation,
          dureeTraitement: r.dureeTraitement,
          situationId,
          modeTransmissionId,
          modeEnvoi: modeCle,
          createdById: userId,
          createdAt: now,
          updatedAt: now,
        },
      }),
    )
    const created = await prisma.$transaction(tx, { timeout: 300_000, maxWait: 60_000 })
    importes += created.length
    await prisma.historiqueAction.createMany({
      data: created.map((c) => ({
        courrierId: c.id,
        action: 'IMPORT',
        commentaire: `Importé via fichier ${fileName}`,
        userId,
        fromSituationId: situationId,
        toSituationId: situationId,
        createdAt: now,
      })),
    })
    processedCount += batch.length
    onProgress?.(processedCount, importes, ignores, maj, erreurs)
  }

  for (let b = 0; b < toRevive.length; b += batchSize) {
    if (isCancelled?.()) break
    const batch = toRevive.slice(b, b + batchSize)
    const existingDuree = await prisma.courrier.findMany({
      where: { numero: { in: batch.map((r) => r.numero) } },
      select: { numero: true, dureeTraitement: true },
    })
    const dureeByNumero = new Map(existingDuree.map((c) => [c.numero, normalizeDuration(c.dureeTraitement)]))
    const tx = batch.map((r) => {
      const base = dureeByNumero.get(r.numero) ?? null
      if (!dureeEquals(base, r.dureeTraitement) && r.dureeTraitement !== null) {
        pushDetail(`Ligne ${r.ligne} (${r.numero}) : durée Excel (${formatDureeJours(r.dureeTraitement)}) ≠ base (${formatDureeJours(base)}) — conserver la base, modification à vérifier`)
      }
      return prisma.courrier.updateMany({
        where: { numero: r.numero },
        data: {
          dateEnvoi: r.dateEnvoi,
          destinataire: r.destinataire,
          objet: r.objet,
          signataire: r.signataire,
          signataireId: r.signataireId,
          numeroEntrant: r.numeroEntrant,
          dateArriveeEntrant: r.dateArriveeEntrant,
          nombrePages: r.nombrePages,
          expediteur: r.expediteur,
          dateObservation: r.dateObservation,
          // La durée est écrasée uniquement si Excel en fournit une ; une
          // valeur vide dans Excel ne remplace jamais une durée existante.
          dureeTraitement: r.dureeTraitement ?? base,
          situationId,
          modeTransmissionId,
          modeEnvoi: modeCle,
          deletedAt: null,
          deletedById: null,
          updatedAt: now,
        },
      })
    })
    await prisma.$transaction(tx, { timeout: 300_000, maxWait: 60_000 })
    importes += batch.length
    const revived = await prisma.courrier.findMany({ where: { numero: { in: batch.map((r) => r.numero) } }, select: { id: true } })
    await prisma.historiqueAction.createMany({
      data: revived.map((c) => ({
        courrierId: c.id,
        action: 'IMPORT',
        commentaire: `Réimporté via fichier ${fileName} (courrier préalablement supprimé)`,
        userId,
        fromSituationId: situationId,
        toSituationId: situationId,
        createdAt: now,
      })),
    })
    processedCount += batch.length
    onProgress?.(processedCount, importes, ignores, maj, erreurs)
  }

  for (let b = 0; b < toUpdate.length; b += batchSize) {
    if (isCancelled?.()) break
    const batch = toUpdate.slice(b, b + batchSize)
    const existingDuree = await prisma.courrier.findMany({
      where: { numero: { in: batch.map((r) => r.numero) }, deletedAt: null },
      select: { numero: true, dureeTraitement: true },
    })
    const dureeByNumero = new Map(existingDuree.map((c) => [c.numero, normalizeDuration(c.dureeTraitement)]))
    const tx = batch.map((r) => {
      const base = dureeByNumero.get(r.numero) ?? null
      if (!dureeEquals(base, r.dureeTraitement) && r.dureeTraitement !== null && base !== null) {
        pushDetail(`Ligne ${r.ligne} (${r.numero}) : durée Excel (${formatDureeJours(r.dureeTraitement)}) ≠ base (${formatDureeJours(base)}) — base conservée, modification à vérifier`)
      }
      return prisma.courrier.updateMany({
        where: { numero: r.numero },
        data: {
          dateEnvoi: r.dateEnvoi,
          destinataire: r.destinataire,
          objet: r.objet,
          signataire: r.signataire,
          signataireId: r.signataireId,
          numeroEntrant: r.numeroEntrant,
          dateArriveeEntrant: r.dateArriveeEntrant,
          nombrePages: r.nombrePages,
          expediteur: r.expediteur,
          dateObservation: r.dateObservation,
          // Une durée Excel vide ne remplace jamais une durée existante ;
          // une durée Excel différente ne l'écrase pas non plus (à vérifier).
          ...(base == null && r.dureeTraitement != null ? { dureeTraitement: r.dureeTraitement } : {}),
          updatedAt: now,
        },
      })
    })
    await prisma.$transaction(tx, { timeout: 300_000, maxWait: 60_000 })
    maj += batch.length
    processedCount += batch.length
    onProgress?.(processedCount, importes, ignores, maj, erreurs)
  }

  const finalIgnores = ignores

  return {
    total,
    importes,
    ignores: finalIgnores,
    maj,
    erreurs,
    details,
  }
}

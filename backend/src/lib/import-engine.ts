import XLSX from 'xlsx'
import { prisma } from './prisma.js'

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
}

export const REQUIRED_FIELDS = ['numero', 'dateEnvoi', 'destinataire', 'objet'] as const
export const OPTIONAL_FIELDS = ['signataire', 'nombrePages', 'expediteur', 'dateObservation', 'numeroEntrant', 'dateArriveeEntrant'] as const
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
  numeroEntrant: ['Réponse au courrier (N°)', 'Reponse au courrier (N°)', 'N° réponse', 'N° Réponse', 'Numéro entrant', 'N° courrier entrant', 'N° courrier entrant'],
  dateArriveeEntrant: ["Date d'arrivée du courrier entrant", "Date d'arrivée courrier entrant", "Date d'arrivée", 'Date arrivée', 'Date arrivée courrier entrant', 'Date de réception', 'Date réception'],
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
  const rows = (matrix.slice(1) || []).filter((r) => !isRowEmpty(r))
  return { columns, rows }
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
  const mapping: ColumnMapping = { numero: null, dateEnvoi: null, destinataire: null, objet: null, signataire: null, nombrePages: null, expediteur: null, dateObservation: null, numeroEntrant: null, dateArriveeEntrant: null }
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
  const resolved: Record<FieldKey, number> = { numero: -1, dateEnvoi: -1, destinataire: -1, objet: -1, signataire: -1, nombrePages: -1, expediteur: -1, dateObservation: -1, numeroEntrant: -1, dateArriveeEntrant: -1 }
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
}

export interface RowError {
  ligne: number
  type: 'numero_manquant' | 'date_invalide' | 'nombre_pages_invalide'
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
}

export function validateRows(records: Record<string, unknown>[], mapping: ColumnMapping, existingByKey: Map<string, string>): ValidationReport {
  const missing = mappingErrors(mapping)
  const columns = records.length > 0 ? Object.keys(records[0]) : []
  const resolved = resolveMapping(mapping, columns)
  const emptyRows = records.filter(isRecordEmpty).length
  const total = records.length - emptyRows

  const seen = new Map<string, number[]>()
  const doublonsBase: { numero: string }[] = []
  const erreurs: RowError[] = []
  const pretsNumeros = new Set<string>()

  let i = 0
  for (const row of records) {
    const ligne = i + 2
    i++
    if (isRecordEmpty(row)) continue

    const values = Object.values(row)
    const numero = cellToString(valueAt(values, resolved.numero))
    if (!numero) {
      erreurs.push({ ligne, type: 'numero_manquant', message: 'Numéro manquant' })
      continue
    }
    const key = numeroKey(numero)

    const dateV = valueAt(values, resolved.dateEnvoi)
    if (resolved.dateEnvoi !== -1 && !parseDateValue(dateV)) {
      erreurs.push({ ligne, type: 'date_invalide', message: `Date de signature invalide` })
      continue
    }

    const pagesV = valueAt(values, resolved.nombrePages)
    if (resolved.nombrePages !== -1 && cellToString(pagesV) !== '' && !isValidPageCount(pagesV)) {
      erreurs.push({ ligne, type: 'nombre_pages_invalide', message: `Nombre de pages invalide (« ${cellToString(pagesV)} »)` })
      continue
    }

    if (existingByKey.has(key) || pretsNumeros.has(key)) {
      if (existingByKey.has(key)) doublonsBase.push({ numero })
      else {
        const list = seen.get(key) || []
        list.push(ligne)
        seen.set(key, list)
      }
      continue
    }
    pretsNumeros.add(key)
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
  onProgress?: (processed: number, importes: number, ignores: number, maj: number, erreurs: number) => void
  isCancelled?: () => boolean
}

export async function executeImport(ctx: ExecuteContext): Promise<ImportOutcome> {
  const { records, mapping, duplicatePolicy, fileName, userId, situationId, modeTransmissionId, modeCle, batchSize, onProgress, isCancelled } = ctx
  const columns = records.length > 0 ? Object.keys(records[0]) : []
  const resolved = resolveMapping(mapping, columns)
  const now = new Date()
  const details: string[] = []
  const MAX_DETAILS = 200

  const toCreate: PreparedRow[] = []
  const toUpdate: PreparedRow[] = []
  const seen = new Set<string>()
  let ignores = 0
  let erreurs = 0
  let total = 0

  const signataires = await prisma.signataire.findMany({ select: { id: true, code: true } })
  const signataireByCode = new Map(signataires.map((s) => [s.code.toUpperCase(), s.id]))
  const resolveSignataireId = (nom: string): string | null => {
    const code = nom.trim().toUpperCase()
    if (signataireByCode.has(code)) return signataireByCode.get(code)!
    const idx = code.indexOf(' ')
    return idx > 0 && signataireByCode.has(code.slice(0, idx)) ? signataireByCode.get(code.slice(0, idx))! : null
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

    const prepared: PreparedRow = {
      ligne,
      numero,
      dateEnvoi,
      destinataire: cellToString(valueAt(values, resolved.destinataire)) || 'Non renseigné',
      objet: cellToString(valueAt(values, resolved.objet)) || 'Sans objet',
      signataire: cellToString(valueAt(values, resolved.signataire)) || 'Non renseigné',
      signataireId: resolveSignataireId(cellToString(valueAt(values, resolved.signataire))) || null,
      numeroEntrant: cellToString(valueAt(values, resolved.numeroEntrant)) || null,
      dateArriveeEntrant,
      nombrePages: pageCountValue(valueAt(values, resolved.nombrePages)),
      expediteur: cellToString(valueAt(values, resolved.expediteur)) || null,
      dateObservation,
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
          situationId,
          modeTransmissionId,
          modeEnvoi: modeCle,
          createdById: userId,
          createdAt: now,
          updatedAt: now,
        },
      }),
    )
    const created = await prisma.$transaction(tx)
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

  for (let b = 0; b < toUpdate.length; b += batchSize) {
    if (isCancelled?.()) break
    const batch = toUpdate.slice(b, b + batchSize)
    const tx = batch.map((r) =>
      prisma.courrier.updateMany({
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
          situationId,
          modeTransmissionId,
          modeEnvoi: modeCle,
          updatedAt: now,
        },
      }),
    )
    await prisma.$transaction(tx)
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

import { FastifyInstance } from 'fastify'
import * as XLSX from 'xlsx'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'
import {
  ALL_FIELDS,
  ColumnMapping,
  ImportOutcome,
  buildMatrix,
  detectMapping,
  executeImport,
  numeroKey,
  validateRows,
} from '../lib/import-engine.js'

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls']
const SESSION_TTL_MS = 30 * 60 * 1000
const MAX_DETAILS_RESPONSE = 200

interface Session {
  token: string
  fileName: string
  size: number
  createdAt: number
  workbook: XLSX.WorkBook
  matrices: Map<string, ReturnType<typeof buildMatrix>>
}

interface Job {
  id: string
  status: 'running' | 'done' | 'error' | 'cancelled'
  token: string
  sheetName: string
  fileName: string
  processed: number
  total: number
  importes: number
  ignores: number
  maj: number
  erreurs: number
  details: string[]
  cancelRequested: boolean
  startedAt: number
  finishedAt?: number
  result?: ImportOutcome
  error?: string
}

const sessions = new Map<string, Session>()
const jobs = new Map<string, Job>()

function sweepSessions() {
  const now = Date.now()
  for (const [token, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(token)
  }
}

function getSession(token: string): Session | null {
  sweepSessions()
  const s = sessions.get(token)
  if (!s || Date.now() - s.createdAt > SESSION_TTL_MS) return null
  return s
}

function getRows(session: Session, sheetName: string): { records: Record<string, unknown>[]; rowNumbers: number[] } {
  const cached = session.matrices.get(sheetName)
  const matrix = cached ?? buildMatrix(session.workbook.Sheets[sheetName])
  if (!cached) session.matrices.set(sheetName, matrix)
  const columns = matrix.columns
  const records = matrix.rows.map((row) => {
    const record: Record<string, unknown> = {}
    columns.forEach((col, i) => {
      record[col] = row[i] ?? ''
    })
    return record
  })
  return { records, rowNumbers: matrix.rowNumbers }
}

function errorDetailList(details: string[]): string[] {
  return details.length > MAX_DETAILS_RESPONSE
    ? [...details.slice(0, MAX_DETAILS_RESPONSE), `… et ${details.length - MAX_DETAILS_RESPONSE} autres erreurs`]
    : details
}

function looksLikeXlsx(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b
}

function looksLikeXls(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0
}

export async function importRoutes(app: FastifyInstance) {
  app.post('/api/import/inspect', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.IMPORT)
    if (!user) return
    const part = await req.file()
    if (!part) {
      return reply.status(400).send({ error: 'Aucun fichier fourni' })
    }

    const fileName = part.filename || 'fichier.xlsx'
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return reply.status(400).send({ error: `Format non supporté : « ${ext || '(aucune extension)'} ». Formats acceptés : .xlsx, .xls` })
    }

    const maxSizeParam = await prisma.parametre.findUnique({ where: { cle: 'import.maxSizeMo' } })
    const maxSizeMo = Math.max(1, parseInt(maxSizeParam?.valeur || '20', 10) || 20)
    const maxSize = maxSizeMo * 1024 * 1024

    const buffer = await part.toBuffer()
    const size = buffer.length
    if (size > maxSize) {
      return reply.status(413).send({
        error: `Fichier trop volumineux (${(size / 1024 / 1024).toFixed(1)} Mo). Taille maximale : ${maxSizeMo} Mo`,
      })
    }

    if (buffer.length === 0) {
      return reply.status(400).send({ error: 'Le fichier est vide' })
    }
    if (!looksLikeXlsx(buffer) && !looksLikeXls(buffer)) {
      return reply.status(400).send({ error: 'Fichier corrompu ou invalide : signature inconnue' })
    }

    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } catch {
      return reply.status(400).send({ error: 'Fichier corrompu ou illisible' })
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return reply.status(400).send({ error: 'Le classeur ne contient aucune feuille' })
    }

    const token = randomUUID()
    sessions.set(token, { token, fileName, size, createdAt: Date.now(), workbook, matrices: new Map() })

    const sheets = workbook.SheetNames.map((name) => {
      const m = buildMatrix(workbook.Sheets[name])
      return { name, rows: m.rows.length, cols: m.columns.length }
    })

    return reply.send({
      token,
      fileName,
      size,
      modifiedAt: null,
      maxSizeMo,
      sheets,
    })
  })

  app.post('/api/import/sheet', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.IMPORT)
    if (!user) return
    const body = req.body as { token: string; sheetName: string }
    const session = getSession(body?.token)
    if (!session) return reply.status(404).send({ error: 'Session expirée, veuillez réimporter le fichier' })

    const sheet = session.workbook.Sheets[body?.sheetName]
    if (!sheet) return reply.status(400).send({ error: 'Feuille introuvable' })

    const matrix = buildMatrix(sheet)
    session.matrices.set(body.sheetName, matrix)

    return reply.send({
      columns: matrix.columns,
      totalRows: matrix.rows.length,
      preview: matrix.rows.slice(0, 20),
      detectedMapping: detectMapping(matrix.columns),
    })
  })

  app.post('/api/import/validate', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.IMPORT)
    if (!user) return
    const body = req.body as { token: string; sheetName: string; mapping: ColumnMapping }
    const session = getSession(body?.token)
    if (!session) return reply.status(404).send({ error: 'Session expirée, veuillez réimporter le fichier' })
    if (!session.workbook.Sheets[body?.sheetName]) return reply.status(400).send({ error: 'Feuille introuvable' })
    if (!body?.mapping) return reply.status(400).send({ error: 'Correspondance des colonnes manquante' })

    for (const field of ALL_FIELDS) {
      if (body.mapping[field] === undefined) body.mapping[field] = null
    }

    const { records } = getRows(session, body.sheetName)
    const existing = await prisma.courrier.findMany({
      where: { deletedAt: null },
      select: { numero: true, dureeTraitement: true },
    })
    const existingByKey = new Map(existing.map((c) => [numeroKey(c.numero), c.numero]))
    const existingDureeByKey = new Map(existing.map((c) => [numeroKey(c.numero), c.dureeTraitement]))
    const signataires = await prisma.signataire.findMany({ select: { code: true, nom: true } })

    return reply.send(validateRows(records, body.mapping, existingByKey, signataires, existingDureeByKey))
  })

  app.post('/api/import/execute', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.IMPORT)
    if (!user) return
    const body = req.body as { token: string; sheetName: string; mapping: ColumnMapping; duplicatePolicy?: 'ignore' | 'update' }
    const session = getSession(body?.token)
    if (!session) return reply.status(404).send({ error: 'Session expirée, veuillez réimporter le fichier' })
    if (!session.workbook.Sheets[body?.sheetName]) return reply.status(400).send({ error: 'Feuille introuvable' })

    const duplicatePolicy = body.duplicatePolicy === 'update' ? 'update' : 'ignore'

    const job: Job = {
      id: randomUUID(),
      status: 'running',
      token: session.token,
      sheetName: body.sheetName,
      fileName: session.fileName,
      processed: 0,
      total: 0,
      importes: 0,
      ignores: 0,
      maj: 0,
      erreurs: 0,
      details: [],
      cancelRequested: false,
      startedAt: Date.now(),
    }
    jobs.set(job.id, job)

    req.raw.on('close', () => {
      if (job.status === 'running') job.cancelRequested = true
    })

    void (async () => {
      try {
        const situation = await prisma.situation.findFirst({ where: { estInitial: true } })
        if (!situation) throw new Error('Aucune situation initiale configurée')

        const mode = await prisma.modeTransmission.findFirst({
          where: { actif: true },
          orderBy: { ordre: 'asc' },
        })
        if (!mode) throw new Error('Aucun mode de transmission configuré')

        const batchParam = await prisma.parametre.findUnique({ where: { cle: 'import.batchSize' } })
        const batchSize = Math.max(50, parseInt(batchParam?.valeur || '250', 10) || 250)

        const { records, rowNumbers } = getRows(session, body.sheetName)
        const existing = await prisma.courrier.findMany({ where: { deletedAt: null }, select: { numero: true } })
        const existingByKey = new Map(existing.map((c) => [numeroKey(c.numero), c.numero]))
        const deleted = await prisma.courrier.findMany({ where: { deletedAt: { not: null } }, select: { numero: true } })
        const deletedByKey = new Map(deleted.map((c) => [numeroKey(c.numero), c.numero]))

        job.total = records.filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== '')).length

        const outcome = await executeImport({
          records,
          mapping: body.mapping,
          duplicatePolicy,
          fileName: session.fileName,
          userId: user.id,
          userName: user.name,
          situationId: situation.id,
          modeTransmissionId: mode.id,
          modeCle: mode.cle || null,
          batchSize,
          existingByKey,
          deletedByKey,
          sheet: session.workbook.Sheets[body.sheetName],
          sheetRowNumbers: rowNumbers,
          onProgress: (processed, importes, ignores, maj, erreurs) => {
            job.processed = processed
            job.importes = importes
            job.ignores = ignores
            job.maj = maj
            job.erreurs = erreurs
          },
          isCancelled: () => job.cancelRequested,
        })

        job.importes = outcome.importes
        job.ignores = outcome.ignores
        job.maj = outcome.maj
        job.erreurs = outcome.erreurs
        job.processed = job.total
        job.details = outcome.details
        job.finishedAt = Date.now()

        const resultat = job.cancelRequested ? 'cancelled' : outcome.erreurs > 0 || outcome.ignores > 0 ? 'partial' : 'success'

        await prisma.importLog.create({
          data: {
            fileName: session.fileName,
            userId: user.id,
            userName: user.name,
            nbLignes: outcome.total,
            nbImportes: outcome.importes,
            nbIgnores: outcome.ignores,
            nbMaj: outcome.maj,
            nbErreurs: outcome.erreurs,
            dureeMs: job.finishedAt - job.startedAt,
            resultat,
          },
        })

        await prisma.auditLog.create({
          data: {
            action: 'IMPORT',
            entity: 'Import',
            entityId: job.id,
            details: `${session.fileName} : ${outcome.importes} importés, ${outcome.ignores} ignorés, ${outcome.maj} mis à jour, ${outcome.erreurs} erreurs`,
            userId: user.id,
          },
        })

        job.status = job.cancelRequested ? 'cancelled' : 'done'
        job.result = outcome
      } catch (err) {
        job.status = 'error'
        job.error = err instanceof Error ? err.message : 'Erreur interne pendant l\'import'
        job.finishedAt = Date.now()
        app.log.error(err)
      } finally {
        sessions.delete(session.token)
      }
    })()

    return reply.send({ jobId: job.id, total: job.total })
  })

  app.get('/api/import/progress/:jobId', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.IMPORT)
    if (!user) return
    const { jobId } = req.params as { jobId: string }
    const job = jobs.get(jobId)
    if (!job) return reply.status(404).send({ error: 'Tâche introuvable ou expirée' })
    return reply.send({
      status: job.status,
      processed: job.processed,
      total: job.total,
      importes: job.importes,
      ignores: job.ignores,
      maj: job.maj,
      erreurs: job.erreurs,
      cancelRequested: job.cancelRequested,
    })
  })

  app.post('/api/import/cancel/:jobId', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.IMPORT)
    if (!user) return
    const { jobId } = req.params as { jobId: string }
    const job = jobs.get(jobId)
    if (!job) return reply.status(404).send({ error: 'Tâche introuvable ou expirée' })
    if (job.status === 'running') {
      job.cancelRequested = true
      return reply.send({ success: true, message: 'Annulation demandée' })
    }
    return reply.send({ success: false, message: 'La tâche est déjà terminée' })
  })

  app.get('/api/import/result/:jobId', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.IMPORT)
    if (!user) return
    const { jobId } = req.params as { jobId: string }
    const job = jobs.get(jobId)
    if (!job) return reply.status(404).send({ error: 'Tâche introuvable ou expirée' })
    if (job.status === 'running') return reply.status(409).send({ error: 'Tâche en cours' })
    return reply.send({
      status: job.status,
      error: job.error,
      total: job.result?.total ?? job.total,
      importes: job.result?.importes ?? job.importes,
      ignores: job.result?.ignores ?? job.ignores,
      maj: job.result?.maj ?? job.maj,
      erreurs: job.result?.erreurs ?? job.erreurs,
      details: errorDetailList(job.result?.details ?? []),
      dureeMs: (job.finishedAt ?? Date.now()) - job.startedAt,
      fileName: job.fileName,
      sheetName: job.sheetName,
    })
  })

  app.get('/api/import/history', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.IMPORT)
    if (!user) return
    const query = req.query as { limit?: string }
    const limit = Math.min(parseInt(query.limit || '20', 10), 100)
    const logs = await prisma.importLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
    return logs
  })
}

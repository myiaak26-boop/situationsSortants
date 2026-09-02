import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission, type SessionUser } from '../lib/auth.js'
import { writeAudit } from '../lib/audit.js'
import type { Courrier } from '@prisma/client'

const SORT_COLUMNS: Record<string, string> = {
  numero: 'numero',
  dateEnvoi: 'dateEnvoi',
  signataire: 'signataire',
  destinataire: 'destinataire',
  objet: 'objet',
  createdAt: 'createdAt',
}

const COMPUTED_SORTS = new Set(['delai', 'dateRetrait'])

function delaiJours(c: Courrier & { retrait?: { dateRetrait: Date } | null }): number {
  const envoi = c.dateEnvoi.getTime()
  const fin = c.retrait ? c.retrait.dateRetrait.getTime() : Date.now()
  return Math.floor((fin - envoi) / 86400000)
}

function buildWhere(q: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { deletedAt: null }

  const search = q.search?.trim()
  if (search) {
    where.OR = [
      { numero: { contains: search } },
      { destinataire: { contains: search } },
      { objet: { contains: search } },
      { signataire: { contains: search } },
      { numeroEntrant: { contains: search } },
    ]
  }

  if (q.signataire) where.signataire = q.signataire

  const dateFilter: Record<string, Date> = {}
  if (q.dateDebut) dateFilter.gte = new Date(`${q.dateDebut}T00:00:00`)
  if (q.dateFin) dateFilter.lte = new Date(`${q.dateFin}T23:59:59`)
  if (dateFilter.gte || dateFilter.lte) where.dateEnvoi = dateFilter

  return where
}

function courrierIncludes() {
  return {
    createdBy: { select: { id: true, name: true } },
    deletedBy: { select: { id: true, name: true } },
    retrait: true,
    historiqueActions: {
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' as const },
      take: 1,
    },
  }
}

function courrierListIncludes() {
  return {
    createdBy: { select: { id: true, name: true } },
    deletedBy: { select: { id: true, name: true } },
    retrait: true,
  }
}

async function attachLastActions(rows: Array<{ id: string } & Record<string, unknown>>) {
  if (rows.length === 0) return
  const ids = rows.map((r) => r.id)
  const found = new Map<string, { createdAt: Date; action: string }>()
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const actions = await prisma.historiqueAction.findMany({
      where: { courrierId: { in: chunk } },
      orderBy: { createdAt: 'desc' },
      select: { courrierId: true, createdAt: true, action: true },
    })
    for (const a of actions) {
      if (!found.has(a.courrierId)) found.set(a.courrierId, { createdAt: a.createdAt, action: a.action })
    }
  }
  for (const row of rows) {
    const last = found.get(row.id)
    ;(row as Record<string, unknown>).historiqueActions = last ? [{ createdAt: last.createdAt, action: last.action }] : []
  }
}

const OFFICIAL_FIELDS = ['numero', 'dateEnvoi', 'signataire', 'destinataire', 'objet', 'numeroEntrant'] as const

export async function courrierRoutes(app: FastifyInstance) {
  app.get('/api/courriers/meta', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.COURRIER_READ)
    if (!user) return
    const [signataires, legacy] = await Promise.all([
      prisma.signataire.findMany({
        select: { id: true, code: true, nom: true, actif: true, ordre: true },
        orderBy: [{ actif: 'desc' }, { ordre: 'asc' }, { nom: 'asc' }],
      }),
      prisma.courrier.findMany({
        select: { signataire: true },
        distinct: ['signataire'],
        where: { deletedAt: null },
      }),
    ])
    const seen = new Set<string>()
    const signataireOptions: { id: string; nom: string }[] = []
    for (const s of signataires) {
      if (!seen.has(s.nom)) {
        seen.add(s.nom)
        signataireOptions.push({ id: s.id, nom: s.nom })
      }
    }
    for (const c of legacy) {
      const n = c.signataire
      if (n && !seen.has(n)) {
        seen.add(n)
        signataireOptions.push({ id: `legacy-${n}`, nom: n })
      }
    }
    signataireOptions.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    return {
      signataires,
      signataireOptions,
    }
  })

  app.get('/api/courriers', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.COURRIER_READ)
    if (!user) return
    const q = req.query as Record<string, string | undefined>
    const where = buildWhere(q)

    const page = q.page ? Math.max(1, parseInt(q.page, 10)) : null
    const pageSize = q.pageSize ? Math.min(100000, Math.max(1, parseInt(q.pageSize, 10))) : null
    const paged = page !== null && pageSize !== null

    const sortBy = SORT_COLUMNS[q.sortBy || 'numero'] || 'numero'
    const sortDir = q.sortDir === 'asc' ? 'asc' : 'desc'
    const computedSort = COMPUTED_SORTS.has(q.sortBy || '')

    if (!computedSort) {
      const orderBy = { [sortBy]: sortDir }
      const [total, rows] = await Promise.all([
        prisma.courrier.count({ where }),
        prisma.courrier.findMany({
          where,
          include: courrierListIncludes(),
          orderBy,
          skip: paged ? (page - 1) * pageSize : undefined,
          take: paged ? pageSize : undefined,
        }),
      ])
      await attachLastActions(rows)
      if (!paged) return rows
      return { items: rows, total, page, pageSize }
    }

    const rows = await prisma.courrier.findMany({ where, include: courrierListIncludes() })
    await attachLastActions(rows)
    rows.sort((a, b) => {
      if (q.sortBy === 'dateRetrait') {
        const da = a.retrait?.dateRetrait?.getTime() ?? -1
        const db = b.retrait?.dateRetrait?.getTime() ?? -1
        return sortDir === 'asc' ? da - db : db - da
      }
      const da = delaiJours(a)
      const db = delaiJours(b)
      return sortDir === 'asc' ? da - db : db - da
    })

    if (!paged) return rows
    const total = rows.length
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize }
  })

  app.get('/api/courriers/:id', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.COURRIER_READ)
    if (!user) return
    const { id } = req.params as { id: string }
    const courrier = await prisma.courrier.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        deletedBy: { select: { id: true, name: true } },
        retrait: true,
        historiqueActions: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!courrier) {
      return reply.status(404).send({ error: 'Courrier introuvable' })
    }
    return courrier
  })

  app.post('/api/courriers', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.COURRIER_CREATE)
    if (!user) return

    const parametre = await prisma.parametre.findUnique({ where: { cle: 'courrier.creationManuelle' } })
    if (!parametre || parametre.valeur === 'false') {
      return reply.status(403).send({ error: 'La création manuelle de courriers est désactivée dans les paramètres' })
    }

    const body = req.body as {
      numero?: string
      dateEnvoi?: string
      signataire?: string
      signataireId?: string | null
      destinataire?: string
      objet?: string
      numeroEntrant?: string | null
      dateArriveeEntrant?: string | null
      observation?: string | null
      modeEnvoi?: string | null
    }

    const numero = body.numero?.trim()
    const dateEnvoi = body.dateEnvoi ? new Date(body.dateEnvoi) : new Date()
    if (!numero) return reply.status(400).send({ error: 'Le numéro est requis' })
    if (!body.destinataire?.trim() || !body.objet?.trim()) {
      return reply.status(400).send({ error: 'Champs requis : destinataire, objet' })
    }
    if (isNaN(dateEnvoi.getTime())) {
      return reply.status(400).send({ error: "La date de signature est invalide" })
    }
    const dateArriveeEntrant = body.dateArriveeEntrant ? new Date(body.dateArriveeEntrant) : null
    if (body.dateArriveeEntrant && isNaN(dateArriveeEntrant!.getTime())) {
      return reply.status(400).send({ error: "La date d'arrivée (courrier entrant) est invalide" })
    }

    const existing = await prisma.courrier.findUnique({ where: { numero } })
    if (existing) return reply.status(409).send({ error: `Le numéro ${numero} existe déjà` })

    let signataireId: string | null = body.signataireId || null
    let signataireNom = body.signataire?.trim() || ''
    if (signataireId) {
      const signataire = await prisma.signataire.findUnique({ where: { id: signataireId } })
      if (!signataire) return reply.status(400).send({ error: 'Signataire introuvable' })
      signataireNom = signataire.nom
    }
    if (!signataireNom) return reply.status(400).send({ error: 'Champs requis : signataire, destinataire, objet' })

    const courrier = await prisma.$transaction(async (tx) => {
      const created = await tx.courrier.create({
        data: {
          numero,
          dateEnvoi,
          signataire: signataireNom,
          signataireId,
          destinataire: body.destinataire!.trim(),
          objet: body.objet!.trim(),
          numeroEntrant: body.numeroEntrant?.trim() || null,
          dateArriveeEntrant,
          observation: body.observation?.trim() || null,
          modeEnvoi: body.modeEnvoi?.trim() || null,
          createdById: user.id,
        },
        include: courrierIncludes(),
      })

      await tx.historiqueAction.create({
        data: {
          courrierId: created.id,
          action: 'Création manuelle',
          commentaire: 'Courrier créé manuellement',
          userId: user.id,
        },
      })

      await writeAudit(
        req,
        user,
        {
          action: 'CREATE',
          entity: 'Courrier',
          entityId: created.id,
          details: `Création du courrier ${numero}`,
          nouvelleValeur: JSON.stringify({ numero, dateEnvoi, signataire: body.signataire, destinataire: body.destinataire, objet: body.objet }),
        },
        tx,
      )

      return created
    })

    return reply.status(201).send(courrier)
  })

  app.put('/api/courriers/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const courrier = await prisma.courrier.findUnique({ where: { id }, include: { retrait: true } })
    if (!courrier) return reply.status(404).send({ error: 'Courrier introuvable' })

    const body = req.body as {
      numero?: string
      dateEnvoi?: string
      signataire?: string
      signataireId?: string | null
      destinataire?: string
      objet?: string
      numeroEntrant?: string | null
      dateArriveeEntrant?: string | null
      observation?: string | null
      retrait?: {
        nomRetraitant?: string
        telephone?: string | null
        dateRetrait?: string
        observation?: string | null
      }
    }

    const officialChanges: Record<string, string | null> = {}
    if (body.numero !== undefined && body.numero.trim() !== courrier.numero) officialChanges.numero = body.numero.trim()
    if (body.dateEnvoi !== undefined && new Date(body.dateEnvoi).getTime() !== courrier.dateEnvoi.getTime()) officialChanges.dateEnvoi = body.dateEnvoi
    if (body.signataire !== undefined && body.signataire.trim() !== courrier.signataire) officialChanges.signataire = body.signataire.trim()
    if (body.signataireId !== undefined && (body.signataireId || null) !== courrier.signataireId) {
      officialChanges.signataireId = body.signataireId || null
    }
    if (body.destinataire !== undefined && body.destinataire.trim() !== courrier.destinataire) officialChanges.destinataire = body.destinataire.trim()
    if (body.objet !== undefined && body.objet.trim() !== courrier.objet) officialChanges.objet = body.objet.trim()
    if (body.numeroEntrant !== undefined && (body.numeroEntrant?.trim() || null) !== courrier.numeroEntrant) officialChanges.numeroEntrant = body.numeroEntrant?.trim() || null
    if (body.dateArriveeEntrant !== undefined) {
      const newDate = body.dateArriveeEntrant ? new Date(body.dateArriveeEntrant) : null
      if (body.dateArriveeEntrant && isNaN(newDate!.getTime())) {
        return reply.status(400).send({ error: "La date d'arrivée (courrier entrant) est invalide" })
      }
      if ((newDate?.getTime() ?? null) !== (courrier.dateArriveeEntrant?.getTime() ?? null)) {
        officialChanges.dateArriveeEntrant = newDate ? newDate.toISOString() : null
      }
    }

    const user: SessionUser | null = await requirePermission(
      req,
      reply,
      Object.keys(officialChanges).length > 0 ? PERMS.COURRIER_EDIT_OFFICIAL : PERMS.COURRIER_WRITE,
    )
    if (!user) return

    const editableChanges: Record<string, unknown> = {}
    if (body.observation !== undefined && (body.observation?.trim() || null) !== courrier.observation) {
      editableChanges.observation = body.observation?.trim() || null
    }
    if (body.retrait) {
      const r = courrier.retrait
      if (body.retrait.nomRetraitant !== undefined && body.retrait.nomRetraitant.trim() !== (r?.nomRetraitant ?? '')) {
        editableChanges.nomRetraitant = body.retrait.nomRetraitant.trim()
      }
      if (body.retrait.telephone !== undefined && (body.retrait.telephone?.trim() || null) !== (r?.telephone ?? null)) {
        editableChanges.telephone = body.retrait.telephone?.trim() || null
      }
      if (body.retrait.dateRetrait !== undefined) {
        const newDate = body.retrait.dateRetrait ? new Date(body.retrait.dateRetrait) : null
        if ((newDate?.getTime() ?? null) !== (r?.dateRetrait.getTime() ?? null)) {
          const user = await requirePermission(req, reply, PERMS.COURRIER_EDIT_OFFICIAL)
          if (!user) return
          editableChanges.dateRetrait = newDate
        }
      }
      if (body.retrait.observation !== undefined && (body.retrait.observation?.trim() || null) !== (r?.observation ?? null)) {
        editableChanges.retraitObservation = body.retrait.observation?.trim() || null
      }
    }

    if (Object.keys(officialChanges).length === 0 && Object.keys(editableChanges).length === 0) {
      return reply.send(courrier)
    }

    if (body.numero && body.numero.trim() !== courrier.numero) {
      const taken = await prisma.courrier.findUnique({ where: { numero: body.numero.trim() } })
      if (taken) return reply.status(409).send({ error: `Le numéro ${body.numero.trim()} existe déjà` })
    }

    const result = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {}
      if (officialChanges.numero !== undefined) data.numero = officialChanges.numero
      if (officialChanges.dateEnvoi !== undefined) data.dateEnvoi = new Date(officialChanges.dateEnvoi as string)
      if (officialChanges.signataire !== undefined) data.signataire = officialChanges.signataire
      if (officialChanges.signataireId !== undefined) {
        const newSignataireId = officialChanges.signataireId
        if (newSignataireId) {
          const signataire = await tx.signataire.findUnique({ where: { id: newSignataireId } })
          if (!signataire) throw new Error('Signataire introuvable')
          data.signataireId = signataire.id
          if (officialChanges.signataire === undefined) data.signataire = signataire.nom
        } else {
          data.signataireId = null
        }
      }
      if (officialChanges.destinataire !== undefined) data.destinataire = officialChanges.destinataire
      if (officialChanges.objet !== undefined) data.objet = officialChanges.objet
      if (officialChanges.numeroEntrant !== undefined) data.numeroEntrant = officialChanges.numeroEntrant
      if (officialChanges.dateArriveeEntrant !== undefined) {
        data.dateArriveeEntrant = officialChanges.dateArriveeEntrant ? new Date(officialChanges.dateArriveeEntrant as string) : null
      }
      if (editableChanges.observation !== undefined) data.observation = editableChanges.observation

      const updated = await tx.courrier.update({ where: { id }, data, include: courrierIncludes() })

      if (officialChanges.signataireId !== undefined && officialChanges.signataireId !== null) {
        const oldNom = courrier.signataire || 'Non renseigné'
        await tx.historiqueAction.create({
          data: {
            courrierId: id,
            action: 'Changement de signataire',
            commentaire: `Signataire modifié via CRUD : ${oldNom} → ${updated.signataire}`,
            userId: user.id,
          },
        })
      }

      if (Object.keys(editableChanges).some((k) => k !== 'observation')) {
        const retraitData: Record<string, unknown> = {}
        if (editableChanges.nomRetraitant !== undefined) retraitData.nomRetraitant = editableChanges.nomRetraitant
        if (editableChanges.telephone !== undefined) retraitData.telephone = editableChanges.telephone
        if (editableChanges.dateRetrait !== undefined) retraitData.dateRetrait = editableChanges.dateRetrait
        if (editableChanges.retraitObservation !== undefined) retraitData.observation = editableChanges.retraitObservation

        if (courrier.retrait) {
          await tx.retrait.update({ where: { courrierId: id }, data: retraitData })
        } else if (retraitData.nomRetraitant) {
          await tx.retrait.create({
            data: {
              courrierId: id,
              nomRetraitant: String(retraitData.nomRetraitant),
              telephone: retraitData.telephone ? String(retraitData.telephone) : null,
              observation: retraitData.observation ? String(retraitData.observation) : null,
              retireParId: user.id,
            },
          })
        }
      }

      const details = [
        ...Object.keys(officialChanges).map((k) => `${k}`),
        ...Object.keys(editableChanges).map((k) => k === 'retraitObservation' ? 'retrait.observation' : k),
      ]

      const champs: { label: string; avant: unknown; apres: unknown }[] = []
      const mapOfficial: Record<string, keyof typeof courrier> = {
        numero: 'numero',
        dateEnvoi: 'dateEnvoi',
        signataire: 'signataire',
        signataireId: 'signataireId',
        destinataire: 'destinataire',
        objet: 'objet',
        numeroEntrant: 'numeroEntrant',
        dateArriveeEntrant: 'dateArriveeEntrant',
      }
      for (const k of Object.keys(officialChanges)) {
        const key = mapOfficial[k]
        champs.push({ label: k, avant: courrier[key], apres: officialChanges[k] })
      }
      const mapRetrait: Record<string, string> = {
        nomRetraitant: 'retrait.nomRetraitant',
        telephone: 'retrait.telephone',
        dateRetrait: 'retrait.dateRetrait',
        retraitObservation: 'retrait.observation',
      }
      for (const k of Object.keys(editableChanges)) {
        const r = courrier.retrait
        let avant: unknown
        if (k === 'observation') avant = courrier.observation
        else if (k === 'nomRetraitant') avant = r?.nomRetraitant ?? ''
        else if (k === 'telephone') avant = r?.telephone ?? null
        else if (k === 'dateRetrait') avant = r?.dateRetrait ?? null
        else avant = r?.observation ?? null
        champs.push({ label: mapRetrait[k] || k, avant, apres: editableChanges[k] })
      }

      await writeAudit(
        req,
        user,
        {
          action: 'UPDATE',
          entity: 'Courrier',
          entityId: id,
          details: `Modification du courrier ${updated.numero} : ${details.join(', ')}`,
          ancienneValeur: JSON.stringify(champs.reduce((acc, c) => ({ ...acc, [c.label]: c.avant }), {})),
          nouvelleValeur: JSON.stringify(champs.reduce((acc, c) => ({ ...acc, [c.label]: c.apres }), {})),
        },
        tx,
      )

      return updated
    })

    return reply.send(result)
  })

  app.delete('/api/courriers/:id', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.COURRIER_DELETE)
    if (!user) return
    if (!user.isSuperAdmin) {
      return reply.status(403).send({ error: 'Seul un Super Administrateur peut supprimer un courrier' })
    }

    const { id } = req.params as { id: string }
    const courrier = await prisma.courrier.findUnique({ where: { id } })
    if (!courrier) return reply.status(404).send({ error: 'Courrier introuvable' })
    if (courrier.deletedAt) return reply.status(400).send({ error: 'Ce courrier est déjà supprimé' })

    await prisma.$transaction(async (tx) => {
      await tx.courrier.update({
        where: { id },
        data: { deletedAt: new Date(), deletedById: user.id },
      })
      await writeAudit(
        req,
        user,
        {
          action: 'DELETE',
          entity: 'Courrier',
          entityId: id,
          details: `Suppression logique du courrier ${courrier.numero}`,
          ancienneValeur: JSON.stringify({ numero: courrier.numero, objet: courrier.objet }),
        },
        tx,
      )
    })

    return reply.send({ success: true, message: 'Courrier supprimé' })
  })
}

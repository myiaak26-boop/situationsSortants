import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'
import { writeAudit } from '../lib/audit.js'

/**
 * Administration du moteur de workflow :
 *  - modes de transmission
 *  - situations (couleurs, icônes, situation initiale / finales)
 *  - transitions (par mode)
 * Rien n'est codé en dur : le moteur lit uniquement cette configuration.
 */

function requireWorkflowAdmin(req: FastifyRequest, reply: FastifyReply) {
  return requirePermission(req, reply, PERMS.WORKFLOW_MANAGE)
}

export async function workflowAdminRoutes(app: FastifyInstance) {
  // ── Vue complète pour l'éditeur ─────────────────────────────────────
  app.get('/api/workflow/admin', async (req, reply) => {
    const user = await requireWorkflowAdmin(req, reply)
    if (!user) return
    const [modes, situations, transitions] = await Promise.all([
      prisma.modeTransmission.findMany({
        include: { _count: { select: { courriers: true, transitions: true } } },
        orderBy: { ordre: 'asc' },
      }),
      prisma.situation.findMany({ orderBy: { ordre: 'asc' } }),
      prisma.transition.findMany({ orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }] }),
    ])
    return { modes, situations, transitions }
  })

  // ── Modes de transmission ──────────────────────────────────────────
  app.get('/api/workflow/modes', async (req, reply) => {
    const user = await requireWorkflowAdmin(req, reply)
    if (!user) return
    const modes = await prisma.modeTransmission.findMany({
      include: { _count: { select: { courriers: true, transitions: true } } },
      orderBy: { ordre: 'asc' },
    })
    return modes
  })

  app.post('/api/workflow/modes', async (req, reply) => {
    const user = await requireWorkflowAdmin(req, reply)
    if (!user) return
    const body = req.body as {
      nom?: string
      description?: string | null
      couleur?: string
      icone?: string | null
      cle?: string | null
      ordre?: number
      actif?: boolean
    }
    if (!body.nom?.trim()) return reply.status(400).send({ error: 'Le nom du mode est requis' })

    const existing = await prisma.modeTransmission.findUnique({ where: { nom: body.nom.trim() } })
    if (existing) return reply.status(409).send({ error: 'Ce mode existe déjà' })

    const mode = await prisma.modeTransmission.create({
      data: {
        nom: body.nom.trim(),
        description: body.description?.trim() || null,
        couleur: body.couleur || '#6B7280',
        icone: body.icone?.trim() || null,
        cle: body.cle?.trim() || null,
        ordre: body.ordre ?? 0,
        actif: body.actif ?? true,
      },
    })
    await writeAudit(req, user, {
      action: 'WORKFLOW_CONFIG',
      entity: 'ModeTransmission',
      entityId: mode.id,
      details: `Création du mode « ${mode.nom} »`,
      nouvelleValeur: mode.nom,
    })
    return reply.status(201).send(mode)
  })

  app.put('/api/workflow/modes/:id', async (req, reply) => {
    const user = await requireWorkflowAdmin(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const body = req.body as {
      nom?: string
      description?: string | null
      couleur?: string
      icone?: string | null
      cle?: string | null
      ordre?: number
      actif?: boolean
    }
    const mode = await prisma.modeTransmission.findUnique({ where: { id } })
    if (!mode) return reply.status(404).send({ error: 'Mode introuvable' })

    if (body.nom?.trim() && body.nom.trim() !== mode.nom) {
      const taken = await prisma.modeTransmission.findUnique({ where: { nom: body.nom.trim() } })
      if (taken) return reply.status(409).send({ error: 'Ce nom est déjà utilisé' })
    }

    const updated = await prisma.modeTransmission.update({
      where: { id },
      data: {
        nom: body.nom?.trim() || mode.nom,
        description: body.description !== undefined ? body.description?.trim() || null : mode.description,
        couleur: body.couleur || mode.couleur,
        icone: body.icone !== undefined ? body.icone?.trim() || null : mode.icone,
        cle: body.cle !== undefined ? body.cle?.trim() || null : mode.cle,
        ordre: body.ordre ?? mode.ordre,
        actif: body.actif ?? mode.actif,
      },
    })
    await writeAudit(req, user, {
      action: 'WORKFLOW_CONFIG',
      entity: 'ModeTransmission',
      entityId: id,
      details: `Modification du mode « ${updated.nom} »`,
      ancienneValeur: JSON.stringify({ nom: mode.nom, actif: mode.actif, couleur: mode.couleur }),
      nouvelleValeur: JSON.stringify({ nom: updated.nom, actif: updated.actif, couleur: updated.couleur }),
    })
    return reply.send(updated)
  })

  app.delete('/api/workflow/modes/:id', async (req, reply) => {
    const user = await requireWorkflowAdmin(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const mode = await prisma.modeTransmission.findUnique({
      where: { id },
      include: { _count: { select: { courriers: true, transitions: true } } },
    })
    if (!mode) return reply.status(404).send({ error: 'Mode introuvable' })
    if (mode._count.courriers > 0) {
      return reply.status(409).send({
        error: `Impossible de supprimer « ${mode.nom} » : ${mode._count.courriers} courrier(s) y sont rattachés`,
      })
    }
    await prisma.$transaction(async (tx) => {
      await tx.transition.deleteMany({ where: { modeTransmissionId: id } })
      await tx.modeTransmission.delete({ where: { id } })
      await writeAudit(
        req,
        user,
        {
          action: 'WORKFLOW_CONFIG',
          entity: 'ModeTransmission',
          entityId: id,
          details: `Suppression du mode « ${mode.nom} » et de ses ${mode._count.transitions} transition(s)`,
          ancienneValeur: mode.nom,
        },
        tx,
      )
    })
    return reply.send({ success: true })
  })

  // ── Situations ─────────────────────────────────────────────────────
  app.post('/api/workflow/situations', async (req, reply) => {
    const user = await requireWorkflowAdmin(req, reply)
    if (!user) return
    const body = req.body as {
      nom?: string
      ordre?: number
      couleur?: string
      icone?: string | null
      estInitial?: boolean
      estFinal?: boolean
    }
    if (!body.nom?.trim()) return reply.status(400).send({ error: 'Le nom de la situation est requis' })

    const existing = await prisma.situation.findUnique({ where: { nom: body.nom.trim() } })
    if (existing) return reply.status(409).send({ error: 'Cette situation existe déjà' })

    const situation = await prisma.$transaction(async (tx) => {
      if (body.estInitial) {
        await tx.situation.updateMany({ where: { estInitial: true }, data: { estInitial: false } })
      }
      return tx.situation.create({
        data: {
          nom: body.nom!.trim(),
          ordre: body.ordre ?? 0,
          couleur: body.couleur || '#6B7280',
          icone: body.icone?.trim() || null,
          estInitial: body.estInitial ?? false,
          estFinal: body.estFinal ?? false,
        },
      })
    })
    await writeAudit(req, user, {
      action: 'WORKFLOW_CONFIG',
      entity: 'Situation',
      entityId: situation.id,
      details: `Création de la situation « ${situation.nom} »`,
      nouvelleValeur: situation.nom,
    })
    return reply.status(201).send(situation)
  })

  app.put('/api/workflow/situations/:id', async (req, reply) => {
    const user = await requireWorkflowAdmin(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const body = req.body as {
      nom?: string
      ordre?: number
      couleur?: string
      icone?: string | null
      estInitial?: boolean
      estFinal?: boolean
    }
    const situation = await prisma.situation.findUnique({ where: { id } })
    if (!situation) return reply.status(404).send({ error: 'Situation introuvable' })

    if (body.nom?.trim() && body.nom.trim() !== situation.nom) {
      const taken = await prisma.situation.findUnique({ where: { nom: body.nom.trim() } })
      if (taken) return reply.status(409).send({ error: 'Ce nom est déjà utilisé' })
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.estInitial) {
        await tx.situation.updateMany({ where: { estInitial: true }, data: { estInitial: false } })
      }
      return tx.situation.update({
        where: { id },
        data: {
          nom: body.nom?.trim() || situation.nom,
          ordre: body.ordre ?? situation.ordre,
          couleur: body.couleur || situation.couleur,
          icone: body.icone !== undefined ? body.icone?.trim() || null : situation.icone,
          estInitial: body.estInitial ?? situation.estInitial,
          estFinal: body.estFinal ?? situation.estFinal,
        },
      })
    })
    await writeAudit(req, user, {
      action: 'WORKFLOW_CONFIG',
      entity: 'Situation',
      entityId: id,
      details: `Modification de la situation « ${updated.nom} »`,
      ancienneValeur: JSON.stringify({ nom: situation.nom, estInitial: situation.estInitial, estFinal: situation.estFinal }),
      nouvelleValeur: JSON.stringify({ nom: updated.nom, estInitial: updated.estInitial, estFinal: updated.estFinal }),
    })
    return reply.send(updated)
  })

  app.delete('/api/workflow/situations/:id', async (req, reply) => {
    const user = await requireWorkflowAdmin(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const situation = await prisma.situation.findUnique({ where: { id } })
    if (!situation) return reply.status(404).send({ error: 'Situation introuvable' })

    const [nbCourriers, nbTransitions] = await Promise.all([
      prisma.courrier.count({ where: { situationId: id } }),
      prisma.transition.count({
        where: { OR: [{ fromSituationId: id }, { toSituationId: id }] },
      }),
    ])
    if (nbCourriers > 0 || nbTransitions > 0) {
      return reply.status(409).send({
        error: `Situation « ${situation.nom} » utilisée par ${nbCourriers} courrier(s) et ${nbTransitions} transition(s)`,
      })
    }
    await prisma.situation.delete({ where: { id } })
    await writeAudit(req, user, {
      action: 'WORKFLOW_CONFIG',
      entity: 'Situation',
      entityId: id,
      details: `Suppression de la situation « ${situation.nom} »`,
      ancienneValeur: situation.nom,
    })
    return reply.send({ success: true })
  })

  // ── Transitions ────────────────────────────────────────────────────
  app.post('/api/workflow/transitions', async (req, reply) => {
    const user = await requireWorkflowAdmin(req, reply)
    if (!user) return
    const body = req.body as {
      modeTransmissionId?: string
      fromSituationId?: string
      toSituationId?: string
      nom?: string
      description?: string | null
      type?: string
      alerte?: boolean
      demandeRetrait?: boolean
      estRappel?: boolean
      ordre?: number
    }
    if (!body.modeTransmissionId || !body.fromSituationId || !body.toSituationId || !body.nom?.trim()) {
      return reply.status(400).send({ error: 'Champs requis : mode, situation source, situation cible, nom' })
    }
    if (body.fromSituationId === body.toSituationId) {
      return reply.status(400).send({ error: 'La situation source et la situation cible doivent être différentes' })
    }

    const existing = await prisma.transition.findUnique({
      where: {
        modeTransmissionId_fromSituationId_toSituationId: {
          modeTransmissionId: body.modeTransmissionId,
          fromSituationId: body.fromSituationId,
          toSituationId: body.toSituationId,
        },
      },
    })
    if (existing) return reply.status(409).send({ error: 'Cette transition existe déjà pour ce mode' })

    const transition = await prisma.transition.create({
      data: {
        modeTransmissionId: body.modeTransmissionId,
        fromSituationId: body.fromSituationId,
        toSituationId: body.toSituationId,
        nom: body.nom.trim(),
        description: body.description?.trim() || null,
        type: body.type || 'MANUAL',
        alerte: body.alerte ?? false,
        demandeRetrait: body.demandeRetrait ?? false,
        estRappel: body.estRappel ?? false,
        ordre: body.ordre ?? 0,
      },
    })
    await writeAudit(req, user, {
      action: 'WORKFLOW_CONFIG',
      entity: 'Transition',
      entityId: transition.id,
      details: `Création de la transition « ${transition.nom} »`,
      nouvelleValeur: transition.nom,
    })
    return reply.status(201).send(transition)
  })

  app.put('/api/workflow/transitions/:id', async (req, reply) => {
    const user = await requireWorkflowAdmin(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const body = req.body as {
      modeTransmissionId?: string
      fromSituationId?: string
      toSituationId?: string
      nom?: string
      description?: string | null
      type?: string
      alerte?: boolean
      demandeRetrait?: boolean
      estRappel?: boolean
      ordre?: number
    }
    const transition = await prisma.transition.findUnique({ where: { id } })
    if (!transition) return reply.status(404).send({ error: 'Transition introuvable' })

    if (
      body.modeTransmissionId &&
      body.fromSituationId &&
      body.toSituationId &&
      (body.modeTransmissionId !== transition.modeTransmissionId ||
        body.fromSituationId !== transition.fromSituationId ||
        body.toSituationId !== transition.toSituationId)
    ) {
      const taken = await prisma.transition.findUnique({
        where: {
          modeTransmissionId_fromSituationId_toSituationId: {
            modeTransmissionId: body.modeTransmissionId,
            fromSituationId: body.fromSituationId,
            toSituationId: body.toSituationId,
          },
        },
      })
      if (taken) return reply.status(409).send({ error: 'Cette transition existe déjà pour ce mode' })
    }

    const updated = await prisma.transition.update({
      where: { id },
      data: {
        modeTransmissionId: body.modeTransmissionId ?? transition.modeTransmissionId,
        fromSituationId: body.fromSituationId ?? transition.fromSituationId,
        toSituationId: body.toSituationId ?? transition.toSituationId,
        nom: body.nom?.trim() || transition.nom,
        description: body.description !== undefined ? body.description?.trim() || null : transition.description,
        type: body.type || transition.type,
        alerte: body.alerte ?? transition.alerte,
        demandeRetrait: body.demandeRetrait ?? transition.demandeRetrait,
        estRappel: body.estRappel ?? transition.estRappel,
        ordre: body.ordre ?? transition.ordre,
      },
    })
    await writeAudit(req, user, {
      action: 'WORKFLOW_CONFIG',
      entity: 'Transition',
      entityId: id,
      details: `Modification de la transition « ${updated.nom} »`,
      ancienneValeur: JSON.stringify({ nom: transition.nom, modeTransmissionId: transition.modeTransmissionId }),
      nouvelleValeur: JSON.stringify({ nom: updated.nom, modeTransmissionId: updated.modeTransmissionId }),
    })
    return reply.send(updated)
  })

  app.delete('/api/workflow/transitions/:id', async (req, reply) => {
    const user = await requireWorkflowAdmin(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const transition = await prisma.transition.findUnique({ where: { id } })
    if (!transition) return reply.status(404).send({ error: 'Transition introuvable' })

    await prisma.transition.delete({ where: { id } })
    await writeAudit(req, user, {
      action: 'WORKFLOW_CONFIG',
      entity: 'Transition',
      entityId: id,
      details: `Suppression de la transition « ${transition.nom} »`,
      ancienneValeur: transition.nom,
    })
    return reply.send({ success: true })
  })
}
import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'
import { writeAudit } from '../lib/audit.js'

/**
 * Moteur de workflow dynamique.
 *
 * Les boutons disponibles ne dépendent que de :
 *   - modeTransmissionId du courrier
 *   - situationId actuelle du courrier
 *
 * Le graphe (situations + transitions) est entièrement paramétrable :
 * aucune situation ni transition n'est codée en dur ici.
 */

function courrierDetailInclude() {
  return {
    situation: true,
    modeTransmission: true,
    createdBy: { select: { id: true, name: true } },
    deletedBy: { select: { id: true, name: true } },
    retrait: true,
    historiqueActions: {
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' as const },
    },
  }
}

interface RetraitPayload {
  nomRetraitant?: string
  telephone?: string | null
  observation?: string | null
}

export async function workflowRoutes(app: FastifyInstance) {
  // Actions disponibles pour un courrier (selon son mode + sa situation actuelle)
  app.get('/api/courriers/:id/transitions', async (req, reply) => {
    const { id } = req.params as { id: string }
    const courrier = await prisma.courrier.findUnique({
      where: { id },
      include: { situation: true, modeTransmission: true, retrait: true },
    })
    if (!courrier) return reply.status(404).send({ error: 'Courrier introuvable' })

    if (courrier.deletedAt || courrier.situation.estFinal || courrier.retrait) return reply.send([])
    if (!courrier.modeTransmissionId || !courrier.modeTransmission?.actif) return reply.send([])

    const transitions = await prisma.transition.findMany({
      where: {
        modeTransmissionId: courrier.modeTransmissionId,
        fromSituationId: courrier.situationId,
      },
      include: { toSituation: true },
      orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
    })

    return reply.send(
      transitions.map((t) => ({
        id: t.id,
        nom: t.nom,
        description: t.description,
        toSituationNom: t.toSituation.nom,
        toSituationCouleur: t.toSituation.couleur,
        toSituationEstFinal: t.toSituation.estFinal,
        demandeRetrait: t.demandeRetrait,
        estRappel: t.estRappel,
        modeNom: courrier.modeTransmission?.nom ?? null,
      })),
    )
  })

  // Exécute une transition — toute la logique métier du workflow
  app.post('/api/courriers/:id/transition', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.COURRIER_UPDATE_SITUATION)
    if (!user) return
    const { id } = req.params as { id: string }
    const { transitionId, commentaire, observation, retrait } = req.body as {
      transitionId: string
      commentaire?: string | null
      observation?: string | null
      retrait?: RetraitPayload | null
    }

    const courrier = await prisma.courrier.findUnique({
      where: { id },
      include: { situation: true, modeTransmission: true, retrait: true },
    })
    if (!courrier) return reply.status(404).send({ error: 'Courrier introuvable' })
    if (courrier.deletedAt) return reply.status(400).send({ error: 'Courrier supprimé' })
    if (courrier.retrait) return reply.status(400).send({ error: 'Ce courrier est déjà retiré' })
    if (!courrier.modeTransmissionId || !courrier.modeTransmission?.actif) {
      return reply.status(400).send({ error: 'Aucun mode de transmission actif pour ce courrier' })
    }

    const transition = await prisma.transition.findUnique({
      where: { id: transitionId },
      include: { toSituation: true },
    })
    if (!transition) return reply.status(404).send({ error: 'Transition introuvable' })
    if (transition.modeTransmissionId !== courrier.modeTransmissionId) {
      return reply.status(400).send({ error: 'Transition non disponible pour ce mode de transmission' })
    }
    if (transition.fromSituationId !== courrier.situationId) {
      return reply.status(400).send({ error: 'Transition non disponible pour la situation actuelle' })
    }

    const libelles: string[] = []

    if (transition.demandeRetrait) {
      const nomRetraitant = retrait?.nomRetraitant?.trim()
      if (!nomRetraitant) {
        return reply.status(400).send({ error: 'Le nom de la personne ayant retiré est requis', demandeRetrait: true })
      }
      libelles.push(`Retiré par ${nomRetraitant}${retrait?.telephone?.trim() ? ` - ${retrait.telephone.trim()}` : ''}`)
      if (retrait?.observation?.trim()) libelles.push(retrait.observation.trim())
    } else {
      const obs = (observation ?? commentaire)?.trim()
      if (obs) libelles.push(obs)
    }

    const isRappel = transition.estRappel
    const nouveauCompteur = isRappel ? courrier.nbrRappels + 1 : null

    const updated = await prisma.$transaction(async (tx) => {
      if (transition.demandeRetrait) {
        await tx.retrait.create({
          data: {
            courrierId: id,
            nomRetraitant: retrait!.nomRetraitant!.trim(),
            telephone: retrait?.telephone?.trim() || null,
            observation: retrait?.observation?.trim() || null,
            retireParId: user.id,
          },
        })
      }

      await tx.courrier.update({
        where: { id },
        data: {
          situationId: transition.toSituationId,
          ...(nouveauCompteur !== null ? { nbrRappels: nouveauCompteur } : {}),
        },
      })

      await tx.historiqueAction.create({
        data: {
          courrierId: id,
          transitionId: transition.id,
          fromSituationId: courrier.situationId,
          toSituationId: transition.toSituationId,
          action: transition.nom,
          commentaire: libelles.join(' — ') || null,
          userId: user.id,
        },
      })

      const detailsRappel = isRappel ? ` (rappel n°${nouveauCompteur})` : ''
      await writeAudit(
        req,
        user,
        {
          action: 'WORKFLOW',
          entity: 'Courrier',
          entityId: id,
          details: `${transition.nom}${detailsRappel}: ${courrier.situation.nom} → ${transition.toSituation.nom}`,
          ancienneValeur: courrier.situation.nom,
          nouvelleValeur: transition.toSituation.nom,
        },
        tx,
      )

      return tx.courrier.findUnique({ where: { id }, include: courrierDetailInclude() })
    })

    return reply.send(updated)
  })
}

export type { RetraitPayload }
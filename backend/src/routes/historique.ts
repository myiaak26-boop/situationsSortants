import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'

export async function historiqueRoutes(app: FastifyInstance) {
  app.get('/api/historique', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.COURRIER_HISTORY)
    if (!user) return
    const query = req.query as {
      search?: string
      action?: string
      startDate?: string
      endDate?: string
    }

    const where: Record<string, unknown> = {}

    if (query.search) {
      where.OR = [
        { action: { contains: query.search } },
        { commentaire: { contains: query.search } },
        { courrier: { numero: { contains: query.search } } },
        { courrier: { destinataire: { contains: query.search } } },
        { user: { name: { contains: query.search } } },
      ]
    }

    if (query.action) {
      where.action = query.action
    }

    if (query.startDate || query.endDate) {
      const createdAt: Record<string, Date> = {}
      if (query.startDate) createdAt.gte = new Date(query.startDate)
      if (query.endDate) createdAt.lte = new Date(query.endDate)
      where.createdAt = createdAt
    }

    const actions = await prisma.historiqueAction.findMany({
      where: where as any,
      include: {
        user: { select: { id: true, name: true } },
        courrier: { select: { id: true, numero: true, destinataire: true } },
        fromSituation: { select: { nom: true, couleur: true } },
        toSituation: { select: { nom: true, couleur: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const uniqueActions = await prisma.historiqueAction.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    })

    return {
      actions,
      filters: {
        actionTypes: uniqueActions.map((a) => a.action),
      },
    }
  })
}

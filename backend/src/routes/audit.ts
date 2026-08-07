import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'

export async function auditRoutes(app: FastifyInstance) {
  app.get('/api/audit', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.AUDIT_READ)
    if (!user) return
    const query = req.query as {
      search?: string
      entity?: string
      action?: string
      entityId?: string
      page?: string
      limit?: string
    }

    const where: Record<string, unknown> = {}

    if (query.search) {
      where.OR = [
        { action: { contains: query.search } },
        { entity: { contains: query.search } },
        { details: { contains: query.search } },
        { user: { name: { contains: query.search } } },
      ]
    }

    if (query.entity) where.entity = query.entity
    if (query.action) where.action = query.action
    if (query.entityId) where.entityId = query.entityId

    const page = parseInt(query.page || '1', 10)
    const limit = Math.min(parseInt(query.limit || '50', 10), 100)
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: where as any,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where: where as any }),
    ])

    const distinctEntities = await prisma.auditLog.groupBy({
      by: ['entity'],
      _count: { entity: true },
      orderBy: { _count: { entity: 'desc' } },
    })

    const distinctActions = await prisma.auditLog.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    })

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      filters: {
        entities: distinctEntities.map((e) => ({ value: e.entity, count: e._count.entity })),
        actions: distinctActions.map((a) => ({ value: a.action, count: a._count.action })),
      },
    }
  })
}

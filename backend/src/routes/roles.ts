import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'

export async function roleRoutes(app: FastifyInstance) {
  app.get('/api/roles', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.ROLE_READ)
    if (!user) return
    const roles = await prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    })
    return roles
  })

  app.get('/api/roles/:id', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.ROLE_READ)
    if (!user) return
    const { id } = req.params as { id: string }
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })
    if (!role) return reply.status(404).send({ error: 'Rôle introuvable' })
    return role
  })

  app.post('/api/roles', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.ROLE_WRITE)
    if (!user) return
    const body = req.body as { name: string; description?: string; permissions?: string[] }
    if (!body.name?.trim()) {
      return reply.status(400).send({ error: 'Le nom du rôle est requis' })
    }
    const existing = await prisma.role.findUnique({ where: { name: body.name.trim() } })
    if (existing) return reply.status(409).send({ error: 'Ce rôle existe déjà' })

    const role = await prisma.role.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        permissions: JSON.stringify(body.permissions || []),
      },
    })
    return role
  })

  app.put('/api/roles/:id', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.ROLE_WRITE)
    if (!user) return
    const { id } = req.params as { id: string }
    const body = req.body as { name?: string; description?: string; permissions?: string[] }

    const existing = await prisma.role.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Rôle introuvable' })

    if (body.name && body.name.trim() !== existing.name) {
      const nameTaken = await prisma.role.findUnique({ where: { name: body.name.trim() } })
      if (nameTaken) return reply.status(409).send({ error: 'Ce nom est déjà utilisé' })
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        description: body.description !== undefined ? (body.description?.trim() || null) : undefined,
        permissions: body.permissions ? JSON.stringify(body.permissions) : undefined,
      },
    })
    return role
  })

  app.delete('/api/roles/:id', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.ROLE_DELETE)
    if (!user) return
    const { id } = req.params as { id: string }
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })
    if (!role) return reply.status(404).send({ error: 'Rôle introuvable' })
    if (role._count.users > 0) {
      return reply.status(400).send({ error: 'Impossible de supprimer un rôle attaché à des utilisateurs' })
    }
    await prisma.role.delete({ where: { id } })
    return { success: true }
  })
}

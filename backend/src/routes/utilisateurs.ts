import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'
import { hashPassword } from '../lib/password.js'

const defaultPassword = process.env.DEX_USER_DEFAULT_PASSWORD || 'Dex1234'

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  roleId: true,
  active: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true, description: true } },
  _count: { select: { courriers: true } },
} as const

export async function utilisateurRoutes(app: FastifyInstance) {
  app.get('/api/utilisateurs', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.UTILISATEUR_READ)
    if (!user) return
    const users = await prisma.user.findMany({
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    })
    return users
  })

  app.get('/api/utilisateurs/roles', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.UTILISATEUR_READ)
    if (!user) return
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } })
    return roles
  })

  app.get('/api/utilisateurs/:id', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.UTILISATEUR_READ)
    if (!user) return
    const { id } = req.params as { id: string }
    const found = await prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    })
    if (!found) return reply.status(404).send({ error: 'Utilisateur introuvable' })
    return found
  })

  app.post('/api/utilisateurs', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.UTILISATEUR_WRITE)
    if (!user) return
    const body = req.body as {
      email: string
      name: string
      roleId: string
      avatar?: string
    }

    if (!body.email || !body.name || !body.roleId) {
      return reply.status(400).send({ error: 'Champs requis : email, name, roleId' })
    }
    const email = body.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply.status(400).send({ error: 'Adresse email invalide' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return reply.status(409).send({ error: 'Cet email est déjà utilisé' })

    const role = await prisma.role.findUnique({ where: { id: body.roleId } })
    if (!role) return reply.status(400).send({ error: 'Rôle introuvable' })
    if (role.permissions.includes('*') && !user.isSuperAdmin) {
      return reply.status(403).send({ error: 'Seul un super administrateur peut attribuer ce rôle' })
    }

    const created = await prisma.user.create({
      data: {
        email,
        name: body.name,
        roleId: body.roleId,
        avatar: body.avatar,
        passwordHash: hashPassword(defaultPassword),
      },
      select: SAFE_USER_SELECT,
    })
    return created
  })

  app.put('/api/utilisateurs/:id', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.UTILISATEUR_WRITE)
    if (!user) return
    const { id } = req.params as { id: string }
    const body = req.body as {
      email?: string
      name?: string
      roleId?: string
      active?: boolean
      avatar?: string
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      include: { role: { select: { id: true, name: true, permissions: true } } },
    })
    if (!existing) return reply.status(404).send({ error: 'Utilisateur introuvable' })

    let email: string | undefined
    if (body.email) {
      email = body.email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply.status(400).send({ error: 'Adresse email invalide' })
      }
      if (email !== existing.email) {
        const emailTaken = await prisma.user.findUnique({ where: { email } })
        if (emailTaken) return reply.status(409).send({ error: 'Cet email est déjà utilisé' })
      }
    }

    if (body.active === false && existing.id === user.id) {
      return reply.status(400).send({ error: 'Vous ne pouvez pas désactiver votre propre compte' })
    }

    // Garde anti-escalade : un non-super-admin ne peut ni modifier un compte
    // super administrateur, ni attribuer le rôle super administrateur.
    const estSuperAdmin = (permissions: string) => permissions.includes('*')
    if (!user.isSuperAdmin && estSuperAdmin(existing.role.permissions)) {
      return reply.status(403).send({ error: 'Un compte super administrateur ne peut être modifié que par un super administrateur' })
    }
    if (body.roleId && body.roleId !== existing.roleId) {
      const roleCible = await prisma.role.findUnique({ where: { id: body.roleId } })
      if (!roleCible) return reply.status(400).send({ error: 'Rôle introuvable' })
      if (estSuperAdmin(roleCible.permissions) && !user.isSuperAdmin) {
        return reply.status(403).send({ error: 'Seul un super administrateur peut attribuer ce rôle' })
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        email: email ?? body.email,
        name: body.name,
        roleId: body.roleId,
        active: body.active,
        avatar: body.avatar,
      },
      select: SAFE_USER_SELECT,
    })
    return updated
  })

  app.delete('/api/utilisateurs/:id', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.UTILISATEUR_DELETE)
    if (!user) return
    const { id } = req.params as { id: string }
    if (id === user.id) {
      return reply.status(400).send({ error: 'Vous ne pouvez pas supprimer votre propre compte' })
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      include: { role: { select: { permissions: true } } },
    })
    if (!existing) return reply.status(404).send({ error: 'Utilisateur introuvable' })

    const estSuperAdmin = (permissions: string) => permissions.includes('*')
    if (!user.isSuperAdmin && estSuperAdmin(existing.role.permissions)) {
      return reply.status(403).send({ error: 'Un compte super administrateur ne peut être supprimé que par un super administrateur' })
    }
    if (estSuperAdmin(existing.role.permissions)) {
      const nbSuperAdmin = await prisma.user.count({ where: { role: { permissions: { contains: '*' } } } })
      if (nbSuperAdmin <= 1) {
        return reply.status(400).send({ error: 'Impossible de supprimer le dernier compte super administrateur' })
      }
    }

    try {
      await prisma.user.delete({ where: { id } })
    } catch (err) {
      // FK : courriers créés, historique, retraits, imports, audits…
      if ((err as { code?: string }).code === 'P2003') {
        return reply.status(409).send({
          error: "Cet utilisateur a des données liées (courriers, historique, retraits). Désactivez-le plutôt que de le supprimer.",
        })
      }
      throw err
    }
    return { success: true }
  })
}

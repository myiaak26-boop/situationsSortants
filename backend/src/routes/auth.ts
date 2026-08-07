import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { createSession, destroySession, getSessionUserId } from '../lib/session-store.js'
import { clientIp, getCurrentUser, readSessionToken } from '../lib/auth.js'

async function writeAudit(action: string, details: string, userId: string | null, ip: string) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity: 'Auth',
        entityId: userId ?? 'unknown',
        details,
        ip,
        userId: userId ?? '',
      },
    })
  } catch {
    // l'audit ne doit pas bloquer le login
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = req.body as { email?: string; password?: string }
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = typeof body?.password === 'string' ? body.password : ''
      const ip = clientIp(req)

      if (!email || !password) {
        return reply.status(400).send({ error: 'Email et mot de passe requis' })
      }

      const user = await prisma.user.findUnique({ where: { email } })

      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        await writeAudit('LOGIN_ECHEC', `Échec de connexion pour ${email}`, user?.id ?? null, ip)
        return reply.status(401).send({ error: 'Identifiants invalides' })
      }
      if (!user.active) {
        return reply.status(403).send({ error: 'Compte désactivé' })
      }

      const token = createSession(user.id)
      await writeAudit('LOGIN_SUCCESS', `Connexion de ${user.email}`, user.id, ip)
      return { token, user: { id: user.id, name: user.name, email: user.email, roleId: user.roleId } }
    },
  )

  app.post('/api/auth/logout', async (req, reply) => {
    const token = readSessionToken(req)
    if (token) destroySession(token)
    return { ok: true }
  })

  app.post(
    '/api/auth/set-password',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const user = await getCurrentUser(req)
      if (!user) return reply.status(401).send({ error: 'Non authentifié' })

      const body = req.body as { currentPassword?: string; newPassword?: string }
      const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
      const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

      if (newPassword.length < 6) {
        return reply.status(400).send({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' })
      }

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
      if (!dbUser) return reply.status(401).send({ error: 'Non authentifié' })
      if (dbUser.passwordHash && !verifyPassword(currentPassword, dbUser.passwordHash)) {
        await writeAudit('CHANGEMENT_MDP_ECHEC', `Mot de passe actuel invalide pour ${user.email}`, user.id, clientIp(req))
        return reply.status(400).send({ error: 'Mot de passe actuel incorrect' })
      }

      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } })
      await writeAudit('CHANGEMENT_MDP', `Changement de mot de passe de ${user.email}`, user.id, clientIp(req))
      return { ok: true }
    },
  )

  app.get('/api/auth/me', async (req, reply) => {
    const user = await getCurrentUser(req)
    if (!user) return reply.status(401).send({ error: 'Non authentifié' })
    return user
  })

  app.post(
    '/api/admin/reset-password',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = req.body as { userId?: string; password?: string }
      const targetId = body?.userId
      const newPassword = body?.password

      if (!targetId || !newPassword || newPassword.length < 6) {
        return reply.status(400).send({ error: 'userId et mot de passe (6+ caractères) requis' })
      }

      const user = await getCurrentUser(req)
      if (!user) return reply.status(401).send({ error: 'Non authentifié' })
      if (!user.isSuperAdmin) return reply.status(403).send({ error: 'Réservé aux super administrateurs' })

      const target = await prisma.user.findUnique({ where: { id: targetId } })
      if (!target) return reply.status(404).send({ error: 'Utilisateur introuvable' })

      await prisma.user.update({ where: { id: targetId }, data: { passwordHash: hashPassword(newPassword) } })
      await writeAudit('RESET_MDP', `Réinitialisation du mot de passe de ${target.email}`, user.id, clientIp(req))
      return { ok: true }
    },
  )
}
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { requirePermission, PERMS } from '../lib/auth.js'
import { seedDatabase } from '../lib/seed.js'

export async function adminRoutes(app: FastifyInstance) {
  app.post(
    '/api/admin/reset',
    { config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, PERMS.PARAMETRE_WRITE)
      if (!user) return
      if (!user.isSuperAdmin) {
        return reply.status(403).send({ error: 'Réservé aux super administrateurs' })
      }

      const body = req.body as { confirm?: boolean }
      if (body?.confirm !== true) {
        return reply.status(400).send({ error: 'Confirmation requise : envoyer { "confirm": true }' })
      }

    try {
      await prisma.$transaction([
        prisma.retrait.deleteMany(),
        prisma.historiqueAction.deleteMany(),
        prisma.courrier.deleteMany(),
        prisma.auditLog.deleteMany(),
        prisma.importLog.deleteMany(),
        prisma.situationLog.deleteMany(),
        prisma.transition.deleteMany(),
        prisma.situation.deleteMany(),
        prisma.modeTransmission.deleteMany(),
        prisma.signataire.deleteMany(),
        prisma.parametre.deleteMany(),
        prisma.user.deleteMany(),
        prisma.role.deleteMany(),
      ])

      await seedDatabase(prisma)

      const adminUser = await prisma.user.findUnique({ where: { email: 'admin@dex.local' } })

      await prisma.auditLog.create({
        data: {
          action: 'RESET_BASE_DE_DONNEES',
          entity: 'System',
          entityId: 'all',
          details: 'Réinitialisation complète de la base de données',
          ip: '',
          userId: adminUser?.id ?? user.id,
        },
      })

      return { ok: true, message: 'Base de données réinitialisée', userId: adminUser?.id ?? null }
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: "Échec de la réinitialisation de la base de données" })
    }
  })
}

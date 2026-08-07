import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'

export async function parametreRoutes(app: FastifyInstance) {
  app.get('/api/parametres', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.PARAMETRE_READ)
    if (!user) return
    const params = await prisma.parametre.findMany({ orderBy: { cle: 'asc' } })
    return params
  })

  app.put('/api/parametres/:id', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.PARAMETRE_WRITE)
    if (!user) return
    const { id } = req.params as { id: string }
    const body = req.body as { valeur: string }

    if (body.valeur === undefined || body.valeur === null) {
      return reply.status(400).send({ error: 'La valeur est requise' })
    }

    const existing = await prisma.parametre.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Paramètre introuvable' })

    const updated = await prisma.parametre.update({
      where: { id },
      data: { valeur: String(body.valeur) },
    })
    return updated
  })
}

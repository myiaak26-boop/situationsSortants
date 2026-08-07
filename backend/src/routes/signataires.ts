import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PERMS, requirePermission } from '../lib/auth.js'

export async function signataireRoutes(app: FastifyInstance) {
  // GET /api/signataires — liste tous les signataires
  app.get('/api/signataires', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.COURRIER_READ)
    if (!user) return
    const signataires = await prisma.signataire.findMany({
      orderBy: { ordre: 'asc' },
    })
    return signataires
  })

  // POST /api/signataires — créer un signataire
  app.post('/api/signataires', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.PARAMETRE_WRITE)
    if (!user) return
    const body = req.body as { code?: string; nom?: string; ordre?: number }
    const code = body.code?.trim().toUpperCase()
    const nom = body.nom?.trim()
    if (!code) return reply.status(400).send({ error: 'Le code est requis' })
    if (!nom) return reply.status(400).send({ error: 'Le nom est requis' })
    const existing = await prisma.signataire.findUnique({ where: { code } })
    if (existing) return reply.status(409).send({ error: `Le code « ${code} » existe déjà` })
    const signataire = await prisma.signataire.create({
      data: { code, nom, ordre: body.ordre ?? 0, actif: true },
    })
    return reply.status(201).send(signataire)
  })

  // PUT /api/signataires/:id — modifier un signataire
  app.put('/api/signataires/:id', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.PARAMETRE_WRITE)
    if (!user) return
    const { id } = req.params as { id: string }
    const body = req.body as { code?: string; nom?: string; actif?: boolean; ordre?: number }
    const existing = await prisma.signataire.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Signataire introuvable' })
    const data: Record<string, unknown> = {}
    if (body.nom !== undefined) data.nom = body.nom.trim()
    if (body.code !== undefined) {
      const newCode = body.code.trim().toUpperCase()
      if (newCode !== existing.code) {
        const taken = await prisma.signataire.findUnique({ where: { code: newCode } })
        if (taken) return reply.status(409).send({ error: `Le code « ${newCode} » existe déjà` })
        data.code = newCode
      }
    }
    if (body.actif !== undefined) data.actif = body.actif
    if (body.ordre !== undefined) data.ordre = body.ordre
    const updated = await prisma.signataire.update({ where: { id }, data })
    return reply.send(updated)
  })

  // DELETE /api/signataires/:id — supprimer (désactiver) un signataire
  app.delete('/api/signataires/:id', async (req, reply) => {
    const user = await requirePermission(req, reply, PERMS.PARAMETRE_WRITE)
    if (!user) return
    const { id } = req.params as { id: string }
    const existing = await prisma.signataire.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Signataire introuvable' })
    // Vérifier si des courriers utilisent ce signataire
    const count = await prisma.courrier.count({ where: { signataireId: id, deletedAt: null } })
    if (count > 0) {
      // Désactiver plutôt que supprimer
      await prisma.signataire.update({ where: { id }, data: { actif: false } })
      return reply.send({ success: true, message: `Signataire désactivé (${count} courrier(s) associé(s))` })
    }
    await prisma.signataire.delete({ where: { id } })
    return reply.send({ success: true, message: 'Signataire supprimé' })
  })
}

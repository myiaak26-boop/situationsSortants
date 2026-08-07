import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { existsSync } from 'fs'
import { join } from 'path'
import 'dotenv/config'
import { authRoutes } from './routes/auth.js'
import { importRoutes } from './routes/import.js'
import { courrierRoutes } from './routes/courriers.js'
import { workflowRoutes } from './routes/workflow.js'
import { workflowAdminRoutes } from './routes/workflow-admin.js'
import { historiqueRoutes } from './routes/historique.js'
import { situationRoutes } from './routes/situations.js'
import { statistiquesRoutes } from './routes/statistiques.js'
import { utilisateurRoutes } from './routes/utilisateurs.js'
import { roleRoutes } from './routes/roles.js'
import { parametreRoutes } from './routes/parametres.js'
import { auditRoutes } from './routes/audit.js'
import { signataireRoutes } from './routes/signataires.js'
import { adminRoutes } from './routes/admin.js'
import { getCurrentUser } from './lib/auth.js'

const app = Fastify({ logger: true })

const defaultOrigins = ['http://localhost:5173', 'http://localhost:5175']
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const allowedOrigins =
  configuredOrigins.length > 0
    ? configuredOrigins
    : process.env.NODE_ENV === 'production'
      ? true
      : defaultOrigins

await app.register(cors, {
  origin: allowedOrigins,
})

await app.register(rateLimit, {
  global: true,
  max: 600,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({ statusCode: 429, error: 'Trop de requêtes. Réessayez dans une minute.' }),
})

await app.register(multipart, {
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
})

app.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

app.get('/api/session', async (req, reply) => {
  const user = await getCurrentUser(req)
  if (!user) return reply.status(401).send({ error: 'Non authentifié' })
  return user
})

await authRoutes(app)
await importRoutes(app)
await courrierRoutes(app)
await workflowRoutes(app)
await workflowAdminRoutes(app)
await historiqueRoutes(app)
await situationRoutes(app)
await statistiquesRoutes(app)
await utilisateurRoutes(app)
await roleRoutes(app)
await parametreRoutes(app)
await auditRoutes(app)
await signataireRoutes(app)
await adminRoutes(app)

const publicDir =
  process.env.PUBLIC_DIR ||
  [join(process.cwd(), 'frontend/dist'), join(process.cwd(), '../frontend/dist')].find(existsSync)
if (publicDir) {
  await app.register(fastifyStatic, { root: publicDir, prefix: '/' })
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Route API introuvable' })
    }
    return reply.sendFile('index.html')
  })
}

const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' })
    console.log('🚀 Server running on http://localhost:3000')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()


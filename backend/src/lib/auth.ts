import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from './prisma.js'
import { getSessionUserId } from './session-store.js'

export const PERMS = {
  COURRIER_READ: 'courrier:read',
  COURRIER_WRITE: 'courrier:write',
  COURRIER_CREATE: 'courrier:create',
  COURRIER_EDIT_OFFICIAL: 'courrier:edit-official',
  COURRIER_UPDATE_SITUATION: 'courrier:update-situation',
  COURRIER_DELETE: 'courrier:delete',
  COURRIER_HISTORY: 'courrier:history',
  COURRIER_PRINT: 'courrier:print',
  WORKFLOW_MANAGE: 'workflow:manage',
  IMPORT: 'import',
  SITUATION_READ: 'situation:read',
  SITUATION_EXPORT: 'situation:export',
  STATISTIQUE_READ: 'statistique:read',
  UTILISATEUR_READ: 'utilisateur:read',
  UTILISATEUR_WRITE: 'utilisateur:write',
  UTILISATEUR_DELETE: 'utilisateur:delete',
  ROLE_READ: 'role:read',
  ROLE_WRITE: 'role:write',
  ROLE_DELETE: 'role:delete',
  PARAMETRE_READ: 'parametre:read',
  PARAMETRE_WRITE: 'parametre:write',
  AUDIT_READ: 'audit:read',
} as const

export type Permission = (typeof PERMS)[keyof typeof PERMS]

export interface SessionUser {
  id: string
  name: string
  email: string
  active: boolean
  roleId: string
  roleName: string
  permissions: string[]
  isSuperAdmin: boolean
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  active: true,
  roleId: true,
  role: { select: { name: true, permissions: true } },
} as const

export async function getCurrentUser(req: FastifyRequest): Promise<SessionUser | null> {
  const token = readSessionToken(req)
  if (!token) return null
  const userId = getSessionUserId(token)
  if (!userId) return null
  const user = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT })

  if (!user || !user.active) return null

  let permissions: string[] = []
  try {
    permissions = JSON.parse(user.role.permissions)
  } catch {
    permissions = []
  }

  const isSuperAdmin = permissions.includes('*')

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    active: user.active,
    roleId: user.roleId,
    roleName: user.role.name,
    permissions,
    isSuperAdmin,
  }
}

export function readSessionToken(req: FastifyRequest): string | null {
  const auth = req.headers.authorization as string | undefined
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  const header = req.headers['x-session-token'] as string | undefined
  return header?.trim() || null
}

export function hasPermission(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false
  if (user.permissions.includes('*')) return true
  return user.permissions.includes(permission)
}

export async function requirePermission(
  req: FastifyRequest,
  reply: FastifyReply,
  permission: Permission,
): Promise<SessionUser | null> {
  const user = await getCurrentUser(req)
  if (!user) {
    reply.status(401).send({ error: 'Non authentifié' })
    return null
  }
  if (!hasPermission(user, permission)) {
    reply.status(403).send({ error: 'Permission insuffisante' })
    return null
  }
  return user
}

export function clientIp(req: FastifyRequest): string {
  return (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip || ''
}

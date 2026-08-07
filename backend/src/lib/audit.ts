import type { FastifyRequest } from 'fastify'
import { prisma } from './prisma.js'
import type { Prisma } from '@prisma/client'
import { clientIp, type SessionUser } from './auth.js'

export interface AuditInput {
  action: string
  entity: string
  entityId: string
  details?: string | null
  ancienneValeur?: string | null
  nouvelleValeur?: string | null
}

export async function writeAudit(
  req: FastifyRequest,
  user: SessionUser,
  input: AuditInput,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma
  return client.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      details: input.details ?? null,
      ancienneValeur: input.ancienneValeur ?? null,
      nouvelleValeur: input.nouvelleValeur ?? null,
      ip: clientIp(req),
      userId: user.id,
    },
  })
}

export function diffJson(ancien: unknown, nouveau: unknown): { ancienneValeur: string; nouvelleValeur: string } | null {
  if (ancien === nouveau || (ancien == null && nouveau == null)) return null
  return {
    ancienneValeur: ancien == null ? '' : typeof ancien === 'string' ? ancien : JSON.stringify(ancien),
    nouvelleValeur: nouveau == null ? '' : typeof nouveau === 'string' ? nouveau : JSON.stringify(nouveau),
  }
}
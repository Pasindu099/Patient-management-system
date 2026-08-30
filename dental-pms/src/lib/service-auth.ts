import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

// Non-human principal for the future AI finance/inventory agent. No agent
// exists yet — this is purely the auth capability it will need. Scopes are
// deliberately confined to finance/inventory; clinical routes never check
// this and a service account has no path to patient data (PDPA boundary).
export type AgentScope = 'finance:read' | 'finance:propose' | 'inventory:read' | 'inventory:propose'

// Generates a new raw key (shown once) and its bcrypt hash (stored).
export function generateApiKey(): { rawKey: string; keyHash: string } {
  const rawKey = 'sk_' + crypto.randomBytes(24).toString('hex')
  const keyHash = bcrypt.hashSync(rawKey, 12)
  return { rawKey, keyHash }
}

export interface ServicePrincipal {
  serviceAccountId: string
  name: string
  scopes: string[]
}

// Verifies the `Authorization: Bearer <key>` header against stored service
// accounts. bcrypt hashes can't be looked up by value, so this checks
// against all active accounts — fine at this scale (a handful of agents).
export async function authenticateServiceAccount(req: NextRequest): Promise<ServicePrincipal | null> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const rawKey = header.slice('Bearer '.length).trim()
  if (!rawKey.startsWith('sk_')) return null

  const accounts = await prisma.serviceAccount.findMany({ where: { isActive: true } })
  for (const account of accounts) {
    if (bcrypt.compareSync(rawKey, account.keyHash)) {
      await prisma.serviceAccount.update({ where: { id: account.id }, data: { lastUsedAt: new Date() } })
      return { serviceAccountId: account.id, name: account.name, scopes: account.scopes }
    }
  }
  return null
}

export function hasScope(principal: ServicePrincipal, scope: AgentScope): boolean {
  return principal.scopes.includes(scope)
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { generateApiKey } from '@/lib/service-auth'
import { z } from 'zod'

const VALID_SCOPES = ['finance:read', 'finance:propose', 'inventory:read', 'inventory:propose']

export async function GET() {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const accounts = await prisma.serviceAccount.findMany({
    select: { id: true, name: true, scopes: true, isActive: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(accounts)
}

const schema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.enum(VALID_SCOPES as [string, ...string[]])).min(1),
})

// POST — creates a service account and returns the raw key ONCE. It is
// never retrievable again (only the bcrypt hash is stored).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const { rawKey, keyHash } = generateApiKey()
  const account = await prisma.serviceAccount.create({
    data: { name: parsed.data.name, scopes: parsed.data.scopes, keyHash },
  })

  await prisma.auditLog.create({
    data: {
      userId:   session.user.id,
      action:   'CREATE',
      resource: 'service_account',
      resourceId: account.id,
      details:  { name: parsed.data.name, scopes: parsed.data.scopes },
    },
  })

  return NextResponse.json({ id: account.id, name: account.name, scopes: account.scopes, apiKey: rawKey }, { status: 201 })
}

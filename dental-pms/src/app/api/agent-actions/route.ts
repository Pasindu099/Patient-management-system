import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { authenticateServiceAccount, hasScope } from '@/lib/service-auth'
import { z } from 'zod'

const ACTION_SCOPES: Record<string, 'finance:propose' | 'inventory:propose'> = {
  create_expense:        'finance:propose',
  mark_salary_paid:      'finance:propose',
  create_purchase_order: 'inventory:propose',
}

const schema = z.object({
  actionType: z.string().min(1),
  payload:    z.record(z.any()),
})

// POST /api/agent-actions — a service account proposes a write. It is only
// ever queued here as PENDING; nothing executes automatically. Admin
// reviews and approves/rejects from the admin panel (GET/PATCH below).
export async function POST(req: NextRequest) {
  const agent = await authenticateServiceAccount(req)
  if (!agent) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  const { actionType, payload } = parsed.data

  const requiredScope = ACTION_SCOPES[actionType]
  if (!requiredScope || !hasScope(agent, requiredScope)) {
    return NextResponse.json({ error: `This action requires scope "${requiredScope ?? 'unknown'}"` }, { status: 403 })
  }

  const action = await prisma.agentAction.create({
    data: { serviceAccountId: agent.serviceAccountId, actionType, payload, status: 'PENDING' },
  })
  return NextResponse.json(action, { status: 201 })
}

// GET /api/agent-actions?status — admin review queue
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const status = new URL(req.url).searchParams.get('status')

  const actions = await prisma.agentAction.findMany({
    where: status ? { status } : {},
    include: { serviceAccount: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json(actions)
}

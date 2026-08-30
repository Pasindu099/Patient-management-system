import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { z } from 'zod'

const schema = z.object({ status: z.enum(['APPROVED', 'REJECTED']) })

// PATCH /api/agent-actions/[id] — admin approves or rejects a pending
// action. Approving only flips the status; a future agent/worker is
// responsible for actually executing it and stamping executedAt/resultRefId.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const existing = await prisma.agentAction.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: 'This action has already been reviewed' }, { status: 409 })
  }

  const action = await prisma.agentAction.update({
    where: { id },
    data: { status: parsed.data.status, reviewedById: session.user.id, reviewedAt: new Date() },
  })

  await prisma.auditLog.create({
    data: {
      userId:   session.user.id,
      action:   'UPDATE',
      resource: 'agent_action',
      resourceId: id,
      details:  { status: parsed.data.status, actionType: existing.actionType },
    },
  })

  return NextResponse.json(action)
}

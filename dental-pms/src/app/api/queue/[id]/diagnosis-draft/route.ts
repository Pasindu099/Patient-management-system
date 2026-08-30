import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { can } from '@/lib/permissions'

// Nurse-assist tooth chart, scoped to one queue item (the patient currently
// in a doctor's chair). Only DOCTOR (clinical.visit) or NURSE/HEAD_NURSE
// (clinical.diagnosis) may read or write it — no other role touches clinical data here.
function canAccess(role: string) {
  return can(role, 'clinical.visit') || can(role, 'clinical.diagnosis')
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canAccess(session.user.role)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const { id } = await params
  const draft = await prisma.diagnosisDraft.findUnique({
    where: { queueItemId: id },
    include: { updatedBy: { select: { name: true } } },
  })

  return NextResponse.json({
    toothFindings: draft?.toothFindings ?? {},
    updatedAt: draft?.updatedAt ?? null,
    updatedByName: draft?.updatedBy?.name ?? null,
  })
}

const putSchema = z.object({
  toothFindings: z.record(z.any()),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canAccess(session.user.role)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const { id } = await params
  const parsed = putSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  const queueItem = await prisma.receptionQueueItem.findUnique({
    where: { id },
    select: { id: true, status: true },
  })
  if (!queueItem) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
  if (!['ASSIGNED', 'IN_CHAIR'].includes(queueItem.status)) {
    return NextResponse.json({ error: 'This patient is no longer being examined' }, { status: 400 })
  }

  const draft = await prisma.diagnosisDraft.upsert({
    where: { queueItemId: id },
    create: {
      queueItemId: id,
      toothFindings: parsed.data.toothFindings,
      updatedById: session.user.id,
    },
    update: {
      toothFindings: parsed.data.toothFindings,
      updatedById: session.user.id,
    },
    include: { updatedBy: { select: { name: true } } },
  })

  return NextResponse.json({
    toothFindings: draft.toothFindings,
    updatedAt: draft.updatedAt,
    updatedByName: draft.updatedBy.name,
  })
}

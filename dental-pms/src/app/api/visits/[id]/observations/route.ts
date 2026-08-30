import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { z } from 'zod'

// GET /api/visits/[id]/observations — live feed for the visit
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const { id } = await params

  const observations = await prisma.visitObservation.findMany({
    where: { visitId: id },
    include: {
      author: { select: { id: true, name: true, role: true } },
      onBehalfOfDoctor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(observations)
}

const schema = z.object({
  text: z.string().min(1),
  onBehalfOfDoctorId: z.string().optional().nullable(),
})

// POST /api/visits/[id]/observations — append-only entry. A nurse scribing
// for a doctor sets onBehalfOfDoctorId; the doctor's own entries omit it.
// Append-only by design: no PATCH/DELETE, so a nurse and doctor can both
// write to an active visit from different devices without write conflicts.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!can(session.user.role, 'clinical.scribe') && !can(session.user.role, 'clinical.visit')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }
  const { id } = await params

  const visit = await prisma.visit.findUnique({ where: { id }, select: { lockedAt: true, patientId: true } })
  if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
  if (visit.lockedAt) {
    return NextResponse.json({ error: 'This visit has ended and can no longer be edited.' }, { status: 409 })
  }

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const observation = await prisma.visitObservation.create({
    data: {
      visitId: id,
      authorId: session.user.id,
      onBehalfOfDoctorId: parsed.data.onBehalfOfDoctorId || null,
      text: parsed.data.text,
    },
    include: {
      author: { select: { id: true, name: true, role: true } },
      onBehalfOfDoctor: { select: { id: true, name: true } },
    },
  })

  await prisma.auditLog.create({
    data: {
      userId:     session.user.id,
      patientId:  visit.patientId,
      action:     'CREATE',
      resource:   'visit_observation',
      resourceId: observation.id,
      details:    { visitId: id, onBehalfOfDoctorId: parsed.data.onBehalfOfDoctorId || null },
    },
  })

  return NextResponse.json(observation, { status: 201 })
}

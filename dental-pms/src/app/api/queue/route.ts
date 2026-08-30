import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { can, isDoctorRole } from '@/lib/permissions'
import { QUEUE_OPEN_STATUSES } from '@/lib/queue'
import { periodForTime, getOrCreateSession } from '@/lib/sessions'

const openStatuses = QUEUE_OPEN_STATUSES

const createSchema = z.object({
  patientId: z.string().optional().nullable(),
  branchId: z.string().min(1),
  queueNumber: z.number().int().positive().optional().nullable(),
  assignedDoctorId: z.string().optional().nullable(),
  appointmentId: z.string().optional().nullable(),
  source: z.string().default('WALK_IN'),
  patientType: z.string().optional().default('UNKNOWN'),
  intakeStatus: z.string().optional().default('NO_INTAKE'),
  displayName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  priority: z.number().int().optional().default(0),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId')
  const includeClosed = searchParams.get('includeClosed') === 'true'

  const where: any = {}
  if (branchId) where.branchId = branchId
  if (!includeClosed) where.status = { in: openStatuses }
  // A doctor may only ever see their own or unassigned queue items — this is
  // enforced here, not left to the client's optional `mine` flag, since an
  // assigned patient's diagnosis/bill must stay visible only to that doctor.
  if (isDoctorRole(session.user.role)) {
    where.OR = [{ assignedDoctorId: null }, { assignedDoctorId: session.user.id }]
  }

  const items = await prisma.receptionQueueItem.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { queueNumber: 'asc' }, { arrivedAt: 'asc' }],
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          patientNumber: true,
          phone: true,
          nicNumber: true,
          dateOfBirth: true,
          gender: true,
        },
      },
      intakeSubmission: {
        select: {
          id: true,
          source: true,
          reviewStatus: true,
          matchConfidence: true,
          firstName: true,
          lastName: true,
          phone: true,
          patientNumber: true,
          dateOfBirth: true,
          gender: true,
          reason: true,
          allergies: true,
          medicalWarnings: true,
          createdAt: true,
        },
      },
      branch: { select: { id: true, name: true } },
      assignedDoctor: { select: { id: true, name: true } },
      appointment: { select: { id: true, appointmentNumber: true, startTime: true, type: true } },
    },
  })

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!can(session.user.role, 'queue.reception')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  if (!d.patientId && !d.queueNumber) {
    return NextResponse.json({ error: 'Enter a token number or select a patient' }, { status: 400 })
  }
  if (d.patientId) {
    const existing = await prisma.receptionQueueItem.findFirst({
      where: {
        patientId: d.patientId,
        branchId: d.branchId,
        status: { in: openStatuses },
      },
      select: { id: true },
    })
    if (existing) return NextResponse.json({ error: 'Patient is already in the queue' }, { status: 409 })
  }

  const now = new Date()
  const period = periodForTime(now)
  const clinicSession = period ? await getOrCreateSession(prisma, d.branchId, now, period) : null

  // Token numbers reset per session, not per day: appointment patients get
  // priority (higher `priority` value) and are numbered separately from
  // walk-ins so the ordered list keeps appointment slot-time order.
  const requestedQueueNumber = d.queueNumber ?? null
  if (requestedQueueNumber && clinicSession) {
    const existingToken = await prisma.receptionQueueItem.findFirst({
      where: {
        sessionId: clinicSession.id,
        queueNumber: requestedQueueNumber,
        status: { in: openStatuses },
      },
      select: { id: true },
    })
    if (existingToken) return NextResponse.json({ error: `Token ${requestedQueueNumber} is already in the queue` }, { status: 409 })
  }

  const lastInSession = !requestedQueueNumber && clinicSession
    ? await prisma.receptionQueueItem.findFirst({
        where: { sessionId: clinicSession.id },
        orderBy: { queueNumber: 'desc' },
        select: { queueNumber: true },
      })
    : null

  const item = await prisma.receptionQueueItem.create({
    data: {
      patientId: d.patientId || null,
      branchId: d.branchId,
      appointmentId: d.appointmentId || null,
      assignedDoctorId: d.assignedDoctorId || null,
      sessionId: clinicSession?.id ?? null,
      queueNumber: requestedQueueNumber ?? (lastInSession?.queueNumber ?? 0) + 1,
      source: d.source,
      patientType: d.patientId ? 'EXISTING' : d.patientType,
      intakeStatus: d.patientId ? 'MATCHED' : d.intakeStatus,
      displayName: d.displayName || null,
      contactPhone: d.contactPhone || null,
      reason: d.reason || null,
      notes: d.notes || null,
      priority: d.source === 'APPOINTMENT' ? 1 : d.priority,
    },
  })

  if (d.appointmentId) {
    await prisma.appointment.update({
      where: { id: d.appointmentId },
      data: { arrivedAt: new Date(), status: 'CONFIRMED' },
    })
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      patientId: d.patientId || null,
      action: 'CREATE',
      resource: 'reception_queue',
      resourceId: item.id,
      details: {
        source: d.source,
        assignedDoctorId: d.assignedDoctorId || null,
        queueNumber: item.queueNumber,
        patientType: d.patientId ? 'EXISTING' : d.patientType,
      },
    },
  })

  return NextResponse.json(item, { status: 201 })
}

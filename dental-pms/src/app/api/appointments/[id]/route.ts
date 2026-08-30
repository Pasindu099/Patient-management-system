import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { status, cancellationReason, arrivedAt, completedAt, startTime, durationMins } = body

  const validStatuses = ['SCHEDULED','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','RESCHEDULED']
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const data: any = {}
  if (status)             data.status             = status
  if (cancellationReason) data.cancellationReason = cancellationReason
  if (arrivedAt)          data.arrivedAt          = new Date(arrivedAt)
  if (completedAt)        data.completedAt        = new Date(completedAt)
  if (status === 'CONFIRMED') data.confirmedAt    = new Date()

  // Reschedule: move the appointment to a new time slot
  if (startTime) {
    const existing = await prisma.appointment.findUnique({
      where: { id },
      select: { durationMins: true, providerId: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const start = new Date(startTime)
    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Invalid start time' }, { status: 400 })
    }
    const mins = Number(durationMins) || existing.durationMins

    const conflict = await prisma.appointment.findFirst({
      where: {
        id: { not: id },
        providerId: existing.providerId,
        startTime: start,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    })
    if (conflict) {
      return NextResponse.json({ error: 'The doctor already has an appointment at that time' }, { status: 409 })
    }

    data.startTime    = start
    data.endTime      = new Date(start.getTime() + mins * 60_000)
    data.durationMins = mins
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data,
    include: {
      patient:  { select: { firstName: true, lastName: true } },
      provider: { select: { name: true } },
    },
  })

  await prisma.auditLog.create({
    data: {
      userId:     session.user.id,
      patientId:  appointment.patientId,
      action:     'UPDATE',
      resource:   'appointment',
      resourceId: appointment.id,
      details:    { statusChange: status },
    },
  })

  return NextResponse.json(appointment)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const { id } = await params

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient:  true,
      provider: { select: { id: true, name: true, role: true } },
      branch:   true,
      clinicalNotes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      invoiceItems:  { include: { invoice: true } },
    },
  })

  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(appointment)
}

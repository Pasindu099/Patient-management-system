import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

const NO_SHOW_GRACE_MINUTES = 20

// POST /api/sessions/sweep — 20-minute no-show rule: any SCHEDULED/CONFIRMED
// appointment whose slot time has passed by more than the grace period, and
// which never checked in (no linked queue item), is marked NO_SHOW and its
// appointment-capacity slot is released for walk-ins.
//
// Called by a scheduled task (Task Scheduler / cron) hitting this endpoint,
// or manually via the "Run now" button on the reception Today Board.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'queue.reception')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cutoff = new Date(Date.now() - NO_SHOW_GRACE_MINUTES * 60_000)

  const overdue = await prisma.appointment.findMany({
    where: {
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      startTime: { lte: cutoff },
      arrivedAt: null,
    },
    select: { id: true, appointmentNumber: true, patientId: true, sessionId: true },
  })

  if (overdue.length === 0) {
    return NextResponse.json({ noShowCount: 0, appointments: [] })
  }

  await prisma.$transaction(
    overdue.map(a =>
      prisma.appointment.update({
        where: { id: a.id },
        data: { status: 'NO_SHOW' },
      })
    )
  )

  await prisma.auditLog.createMany({
    data: overdue.map(a => ({
      userId:     session.user.id,
      patientId:  a.patientId,
      action:     'UPDATE',
      resource:   'appointment',
      resourceId: a.id,
      details:    { statusChange: 'NO_SHOW', reason: `No check-in within ${NO_SHOW_GRACE_MINUTES} minutes` },
    })),
  })

  return NextResponse.json({
    noShowCount: overdue.length,
    appointments: overdue.map(a => a.appointmentNumber),
  })
}

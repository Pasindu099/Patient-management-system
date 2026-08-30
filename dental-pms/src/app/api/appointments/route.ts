import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { isDoctorRole } from '@/lib/permissions'
import { periodForTime, isDoctorRostered, getOrCreateSession, sessionUsage } from '@/lib/sessions'
import { sendEmail, appointmentConfirmationEmail } from '@/lib/email'

const createSchema = z.object({
  patientId:     z.string().min(1),
  providerId:    z.string().min(1),
  branchId:      z.string().min(1),
  type:          z.string().min(1),
  startTime:     z.string(),
  durationMins:  z.number().int().min(10).max(360),
  chair:         z.string().optional(),
  reason:        z.string().optional(),
  notes:         z.string().optional(),
  bookingSource: z.string().default('RECEPTIONIST'),
})

function generateApptNumber() {
  return `APT-${String(Math.floor(Math.random() * 900000) + 100000)}`
}

function slotDayKey(date: Date) {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()]
}

function slotTimeKey(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const branchId   = searchParams.get('branchId')
  const providerId = searchParams.get('providerId')
  const date       = searchParams.get('date')   // YYYY-MM-DD
  const weekStart  = searchParams.get('weekStart')

  let startOfRange: Date
  let endOfRange:   Date

  if (weekStart) {
    startOfRange = new Date(weekStart)
    startOfRange.setHours(0, 0, 0, 0)
    endOfRange = new Date(startOfRange)
    endOfRange.setDate(startOfRange.getDate() + 7)
  } else if (date) {
    startOfRange = new Date(date)
    startOfRange.setHours(0, 0, 0, 0)
    endOfRange = new Date(date)
    endOfRange.setHours(23, 59, 59, 999)
  } else {
    // Default: today
    startOfRange = new Date()
    startOfRange.setHours(0, 0, 0, 0)
    endOfRange = new Date()
    endOfRange.setHours(23, 59, 59, 999)
  }

  const where: any = {
    startTime: { gte: startOfRange, lte: endOfRange },
  }
  if (branchId) where.branchId = branchId
  // A doctor can only ever query their own appointments — enforced here so
  // passing another doctor's providerId can't be used to read their patients.
  if (isDoctorRole(session.user.role)) {
    where.providerId = session.user.id
  } else if (providerId) {
    where.providerId = providerId
  }

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { startTime: 'asc' },
    include: {
      patient:  { select: { id: true, firstName: true, lastName: true, patientNumber: true, phone: true, nicNumber: true } },
      provider: { select: { id: true, name: true } },
      branch:   { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(appointments)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body   = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  const startTime = new Date(d.startTime)
  const endTime   = new Date(startTime.getTime() + d.durationMins * 60 * 1000)

  // v2 sessions: the appointment must fall inside a session, the doctor must
  // be on the roster, and the session's appointment allocation must have room
  const period = periodForTime(startTime)
  if (!period) {
    return NextResponse.json({
      error: 'Outside session hours. Sessions run 9:00 AM – 2:00 PM and 4:00 PM – 9:00 PM.',
    }, { status: 400 })
  }
  if (!isDoctorRole(session.user.role)) {
    const offeredSlot = await prisma.onlineSlot.findFirst({
      where: {
        doctorId: d.providerId,
        dayOfWeek: slotDayKey(startTime),
        startTime: slotTimeKey(startTime),
        isActive: true,
      },
      select: { id: true },
    })
    if (!offeredSlot) {
      return NextResponse.json({
        error: 'This doctor has not offered that appointment time. Choose one of the available times.',
      }, { status: 409 })
    }
  }
  const hasRosterConfigured = await prisma.doctorBranchAvailability.count({
    where: { doctorId: d.providerId, branchId: d.branchId, isActive: true },
  })
  const rostered = hasRosterConfigured > 0
    ? await isDoctorRostered(prisma, d.providerId, d.branchId, startTime, period)
    : true
  if (!rostered) {
    return NextResponse.json({
      error: 'This doctor is not scheduled at this branch for that session. Choose another doctor/time or update the roster.',
    }, { status: 409 })
  }
  const clinicSession = await getOrCreateSession(prisma, d.branchId, startTime, period)
  if (!clinicSession.isOpen) {
    return NextResponse.json({ error: 'This session is closed for bookings.' }, { status: 409 })
  }
  const usage = await sessionUsage(prisma, clinicSession.id)
  if (usage.appointment >= clinicSession.appointmentCapacity) {
    return NextResponse.json({
      error: `This session's appointment slots are full (${clinicSession.appointmentCapacity}). The patient can still walk in.`,
    }, { status: 409 })
  }

  // Check for conflicts
  const conflict = await prisma.appointment.findFirst({
    where: {
      providerId: d.providerId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      OR: [
        { startTime: { gte: startTime, lt: endTime } },
        { endTime:   { gt: startTime, lte: endTime } },
        { startTime: { lte: startTime }, endTime: { gte: endTime } },
      ],
    },
    select: { appointmentNumber: true, startTime: true },
  })

  if (conflict) {
    return NextResponse.json({
      error: `This time slot conflicts with appointment ${conflict.appointmentNumber}. Please choose a different time.`,
    }, { status: 409 })
  }

  let appointmentNumber = generateApptNumber()
  while (await prisma.appointment.findUnique({ where: { appointmentNumber } })) {
    appointmentNumber = generateApptNumber()
  }

  const appointment = await prisma.appointment.create({
    data: {
      appointmentNumber,
      patientId:     d.patientId,
      providerId:    d.providerId,
      branchId:      d.branchId,
      type:          d.type as any,
      status:        'SCHEDULED',
      bookingSource: d.bookingSource as any,
      startTime,
      endTime,
      durationMins:  d.durationMins,
      chair:         d.chair || null,
      reason:        d.reason || null,
      notes:         d.notes  || null,
      sessionId:     clinicSession.id,
      slotKind:      'APPOINTMENT',
    },
    include: {
      patient:  { select: { firstName: true, lastName: true, email: true } },
      provider: { select: { name: true } },
      branch:   { select: { name: true, address: true, phone: true } },
    },
  })

  // Confirmation email to the patient, when we hold an address for them.
  // Never allowed to fail the booking — the appointment is already saved.
  if (appointment.patient.email) {
    const mail = appointmentConfirmationEmail({
      patientName:       `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      appointmentNumber: appointment.appointmentNumber,
      doctorName:        appointment.provider?.name ?? 'your dentist',
      branchName:        appointment.branch?.name ?? '',
      branchAddress:     appointment.branch?.address,
      branchPhone:       appointment.branch?.phone,
      startTime,
      reason:            d.reason || null,
    })
    const sent = await sendEmail({ to: appointment.patient.email, ...mail })
    if (!sent.success && !sent.skipped) {
      console.error('[API/appointments] confirmation email failed:', sent.error)
    }
  }

  // Update patient last visit
  await prisma.patient.update({
    where: { id: d.patientId },
    data:  { lastVisitDate: startTime },
  })

  await prisma.auditLog.create({
    data: {
      userId:     session.user.id,
      patientId:  d.patientId,
      action:     'CREATE',
      resource:   'appointment',
      resourceId: appointment.id,
    },
  })

  return NextResponse.json(appointment, { status: 201 })
}

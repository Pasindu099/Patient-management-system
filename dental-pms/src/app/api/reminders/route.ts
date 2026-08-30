import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TEMPLATES, sendSMS, sendWhatsApp } from '@/lib/sms'
import { can } from '@/lib/permissions'

// ─── POST /api/reminders ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth()
  // Sending a single reminder reaches a patient just as the bulk GET does, so
  // it takes the same permission. Previously this checked only that the caller
  // was logged in, which let any role message a patient.
  if (!session || !can(session.user.role, 'reminders.send')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const { appointmentId, type, channel } = await req.json()

  if (!appointmentId || !type) {
    return NextResponse.json({ error: 'appointmentId and type are required' }, { status: 400 })
  }

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true, preferredLanguage: true, communicationPref: true } },
      branch:  { select: { name: true } },
    },
  })

  if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })

  const patient  = appt.patient
  const lang     = (patient.preferredLanguage === 'si' ? 'si' : 'en') as 'si' | 'en'
  const name     = `${patient.firstName} ${patient.lastName}`
  const clinic   = appt.branch?.name ?? 'DentalCare'
  const date     = new Date(appt.startTime).toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long' })
  const time     = new Date(appt.startTime).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })

  let message: string
  if (type === 'appointment_24h') {
    message = TEMPLATES.appointment_24h[lang](name, date, time, clinic)
  } else if (type === 'appointment_2h') {
    message = TEMPLATES.appointment_2h[lang](name, time, clinic)
  } else {
    return NextResponse.json({ error: 'Unknown reminder type' }, { status: 400 })
  }

  const useChannel = channel ?? patient.communicationPref ?? 'whatsapp'
  const phone      = patient.phone

  if (!phone) return NextResponse.json({ error: 'Patient has no phone number' }, { status: 400 })

  let result: { success: boolean; error?: string }

  if (useChannel === 'sms') {
    result = await sendSMS(phone, message)
  } else if (useChannel === 'whatsapp') {
    result = await sendWhatsApp(phone, message)
  } else {
    result = { success: false, error: 'Unknown channel' }
  }

  // Update appointment reminder tracking
  if (result.success) {
    const updateData: any = {}
    if (type === 'appointment_24h') updateData.reminder24hSentAt = new Date()
    if (type === 'appointment_2h')  updateData.reminder2hSentAt  = new Date()
    await prisma.appointment.update({ where: { id: appointmentId }, data: updateData })
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId:     session.user.id,
      patientId:  appt.patientId,
      action:     'CREATE',
      resource:   'reminder',
      resourceId: appointmentId,
      details:    { type, channel: useChannel, success: result.success, error: result.error },
    },
  })

  return NextResponse.json({ success: result.success, channel: useChannel, error: result.error })
}

// ─── GET /api/reminders — bulk send for tomorrow's appointments ───────────────
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'reminders.send')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const preview = searchParams.get('preview') === 'true'

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const tomorrowEnd = new Date(tomorrow)
  tomorrowEnd.setHours(23, 59, 59, 999)

  const appointments = await prisma.appointment.findMany({
    where: {
      startTime:          { gte: tomorrow, lte: tomorrowEnd },
      status:             { in: ['SCHEDULED', 'CONFIRMED'] },
      reminder24hSentAt:  null,
    },
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true, preferredLanguage: true, communicationPref: true } },
      branch:  { select: { name: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  if (preview) {
    return NextResponse.json({
      count: appointments.length,
      appointments: appointments.map(a => ({
        id:      a.id,
        patient: `${a.patient.firstName} ${a.patient.lastName}`,
        phone:   a.patient.phone,
        time:    a.startTime,
        channel: a.patient.communicationPref,
        lang:    a.patient.preferredLanguage,
      })),
    })
  }

  // Actually send
  let sent = 0, failed = 0
  for (const appt of appointments) {
    const lang   = (appt.patient.preferredLanguage === 'si' ? 'si' : 'en') as 'si' | 'en'
    const name   = `${appt.patient.firstName} ${appt.patient.lastName}`
    const clinic = appt.branch?.name ?? 'DentalCare'
    const date   = new Date(appt.startTime).toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long' })
    const time   = new Date(appt.startTime).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })
    const msg    = TEMPLATES.appointment_24h[lang](name, date, time, clinic)
    const ch     = appt.patient.communicationPref ?? 'sms'
    const phone  = appt.patient.phone

    if (!phone) { failed++; continue }

    const r = ch === 'whatsapp' ? await sendWhatsApp(phone, msg) : await sendSMS(phone, msg)
    if (r.success) {
      await prisma.appointment.update({ where: { id: appt.id }, data: { reminder24hSentAt: new Date() } })
      sent++
    } else {
      failed++
    }
  }

  return NextResponse.json({ sent, failed, total: appointments.length })
}

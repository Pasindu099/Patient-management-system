import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { periodForTime, getOrCreateSession, onlineUsage } from '@/lib/sessions'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { sendEmail, appointmentConfirmationEmail } from '@/lib/email'

const REASONS = new Set([
  'Routine Check-up & Cleaning',
  'Toothache / Pain',
  'Cosmetic Consultation',
  'Teeth Whitening',
  'Filling / Restoration',
  'Extraction',
  'Root Canal',
  'Crown or Bridge',
  'Dental Implant Consultation',
  'Orthodontic Consultation',
  'Gum Treatment',
  'Dentures',
  'Emergency',
  'Other',
])

const TITLES = new Set(['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Rev.'])
const GENDERS = new Set(['Male', 'Female', 'Prefer not to say'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[\d\s+\-()]{7,20}$/
const NIC_RE = /^(\d{9}[VX]|\d{12})$/i

function genRef() {
  return `LDS-${Date.now().toString(36).toUpperCase().slice(-6)}`
}

function genPatientNumber() {
  return `PT-${String(Math.floor(Math.random() * 900000) + 100000)}`
}

function genApptNumber() {
  return `APT-${String(Math.floor(Math.random() * 900000) + 100000)}`
}

function clean(value: unknown, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function parseDateOnly(value: string) {
  if (!DATE_RE.test(value)) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function validatePayload(body: any) {
  const title = TITLES.has(clean(body.title, 12)) ? clean(body.title, 12) : 'Mr.'
  const firstName = clean(body.firstName, 80)
  const lastName = clean(body.lastName, 80)
  const dob = clean(body.dob, 10)
  const gender = clean(body.gender, 24)
  const phone = clean(body.phone, 24)
  const email = clean(body.email, 120).toLowerCase()
  const nic = clean(body.nic, 16).toUpperCase()
  const address = clean(body.address, 240)
  const reason = clean(body.reason, 80)
  const doctorId = clean(body.doctorId, 80)
  const date = clean(body.date, 10)
  const timeSlot = clean(body.timeSlot, 5)
  const notes = clean(body.notes, 500)
  const website = clean(body.website, 120)

  if (website) return { error: 'Booking could not be submitted.' }
  if (!firstName || !lastName || !phone || !nic || !reason || !doctorId || !date || !timeSlot || !dob || !gender) {
    return { error: 'Required fields are missing' }
  }
  if (!PHONE_RE.test(phone)) return { error: 'Please enter a valid phone number.' }
  if (email && !EMAIL_RE.test(email)) return { error: 'Please enter a valid email address.' }
  if (!NIC_RE.test(nic)) return { error: 'Please enter a valid Sri Lankan NIC number.' }
  if (!REASONS.has(reason)) return { error: 'Please select a valid reason for your visit.' }
  if (!GENDERS.has(gender)) return { error: 'Please select a valid gender option.' }
  if (!TIME_RE.test(timeSlot)) return { error: 'Please select a valid appointment time.' }

  const dobDate = parseDateOnly(dob)
  if (!dobDate || dobDate > new Date()) return { error: 'Please enter a valid date of birth.' }

  const appointmentDate = parseDateOnly(date)
  if (!appointmentDate) return { error: 'Please select a valid appointment date.' }

  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const maxDate = new Date(tomorrow)
  maxDate.setDate(maxDate.getDate() + 59)

  if (appointmentDate < tomorrow || appointmentDate > maxDate) {
    return { error: 'Please select an appointment date within the next 60 days.' }
  }

  return {
    data: {
      title,
      firstName,
      lastName,
      dob,
      gender,
      phone,
      email,
      nic,
      address,
      reason,
      doctorId,
      date: dateKey(appointmentDate),
      timeSlot,
      notes,
    },
  }
}

export async function POST(req: NextRequest) {
  if (!req.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Invalid request format.' }, { status: 415 })
  }

  const ip = clientIp(req.headers)
  const limited = rateLimit(`book:${ip}`, 10, 15 * 60 * 1000)
  if (limited.limited) {
    return NextResponse.json(
      { error: 'Too many booking attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request format.' }, { status: 400 })
  }

  const validated = validatePayload(body)
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const {
    title, firstName, lastName, dob, gender,
    phone, email, nic, address,
    reason, doctorId, date, timeSlot, notes,
  } = validated.data

  try {
    // 1. Find or create patient by NIC
    let patient = await prisma.patient.findFirst({
      where: { nicNumber: nic.toUpperCase() },
    })

    if (!patient) {
      let patientNumber = genPatientNumber()
      while (await prisma.patient.findUnique({ where: { patientNumber } })) {
        patientNumber = genPatientNumber()
      }

      patient = await prisma.patient.create({
        data: {
          patientNumber,
          firstName,
          lastName,
          dateOfBirth:  new Date(dob),
          gender:       gender === 'Male' ? 'MALE' : gender === 'Female' ? 'FEMALE' : 'PREFER_NOT_TO_SAY',
          phone,
          email:        email || null,
          nicNumber:    nic.toUpperCase(),
          addressLine1: address || null,
          communicationPref: 'whatsapp',
          // Create basic medical history
          medicalHistory: {
            create: {
              allergies:   [],
              medications: [],
              conditions:  [],
            },
          },
        },
      })
    }

    // 2. Build the appointment datetime
    const [hours, minutes] = timeSlot.split(':').map(Number)
    const startTime = new Date(date)
    startTime.setHours(hours, minutes, 0, 0)
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000) // 30 min default

    // 3. Check slot is still available
    const conflict = await prisma.appointment.findFirst({
      where: {
        providerId: doctorId,
        startTime,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    })

    if (conflict) {
      return NextResponse.json({
        error: 'Sorry, this time slot was just taken. Please go back and select another slot.',
      }, { status: 409 })
    }

    // 4. Get doctor's branch (primary branch)
    const doctorBranch = await prisma.userBranch.findFirst({
      where: { userId: doctorId, isPrimary: true },
      select: { branchId: true },
    })

    if (!doctorBranch?.branchId) {
      return NextResponse.json({
        error: 'This doctor is not assigned to a primary branch yet. Please call us to complete the booking.',
      }, { status: 400 })
    }

    // v2: the online allocation is a slice of the session's capacity —
    // re-check the doctor is rostered and the allocation still has room,
    // since availability may have changed since the page loaded.
    const period = periodForTime(startTime)
    if (!period) {
      return NextResponse.json({ error: 'That time is outside our clinic hours. Please choose a different slot.' }, { status: 400 })
    }

    const dayName = startTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const enabledOnlineSlot = await prisma.onlineSlot.findFirst({
      where: { doctorId, dayOfWeek: dayName, startTime: timeSlot, isActive: true },
      select: { id: true },
    })
    if (!enabledOnlineSlot) {
      return NextResponse.json({ error: 'This online booking slot is no longer available. Please choose a different time.' }, { status: 409 })
    }

    const clinicSession = await getOrCreateSession(prisma, doctorBranch.branchId, startTime, period)
    if (!clinicSession.isOpen || (await onlineUsage(prisma, clinicSession.id)) >= clinicSession.onlineCapacity) {
      return NextResponse.json({ error: 'Sorry, online booking for this session is full. Please call us or try another time.' }, { status: 409 })
    }

    // 5. Create the appointment
    let apptNumber = genApptNumber()
    while (await prisma.appointment.findUnique({ where: { appointmentNumber: apptNumber } })) {
      apptNumber = genApptNumber()
    }

    // Map reason to appointment type
    const typeMap: Record<string, string> = {
      'Routine Check-up & Cleaning':   'CHECKUP',
      'Toothache / Pain':               'EMERGENCY',
      'Cosmetic Consultation':          'CONSULTATION',
      'Teeth Whitening':                'WHITENING',
      'Filling / Restoration':          'FILLING',
      'Extraction':                     'EXTRACTION',
      'Root Canal':                     'ROOT_CANAL',
      'Crown or Bridge':                'CROWN',
      'Dental Implant Consultation':    'IMPLANT',
      'Orthodontic Consultation':       'CONSULTATION',
      'Gum Treatment':                  'CLEANING',
      'Dentures':                       'CONSULTATION',
      'Emergency':                      'EMERGENCY',
      'Other':                          'CONSULTATION',
    }

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber: apptNumber,
        patientId:         patient.id,
        providerId:        doctorId,
        branchId:          doctorBranch.branchId,
        type:              (typeMap[reason] ?? 'CONSULTATION') as any,
        // Online bookings are auto-confirmed — the website promises
        // instant confirmation, so no staff review step is needed
        status:            'CONFIRMED',
        confirmedAt:       new Date(),
        bookingSource:     'ONLINE',
        startTime,
        endTime,
        durationMins:      30,
        reason:            `[ONLINE BOOKING] ${reason}${notes ? ` — ${notes}` : ''}`,
        sessionId:         clinicSession.id,
        slotKind:          'ONLINE',
      },
      include: {
        provider: { select: { name: true } },
        branch:   { select: { name: true, address: true, phone: true } },
      },
    })

    const referenceNumber = genRef()

    // Confirmation email. Deliberately awaited but never allowed to throw:
    // the booking is already committed, so a mail failure must not turn a
    // successful appointment into a 500 for the patient.
    if (patient.email) {
      const mail = appointmentConfirmationEmail({
        patientName:       `${patient.firstName} ${patient.lastName}`,
        appointmentNumber: apptNumber,
        doctorName:        appointment.provider?.name ?? 'your dentist',
        branchName:        appointment.branch?.name ?? '',
        branchAddress:     appointment.branch?.address,
        branchPhone:       appointment.branch?.phone,
        startTime,
        reason,
      })
      const sent = await sendEmail({ to: patient.email, ...mail })
      if (!sent.success && !sent.skipped) {
        console.error('[API/book] confirmation email failed:', sent.error)
      }
    }

    // 6. Audit log
    await prisma.auditLog.create({
      data: {
        patientId:  patient.id,
        action:     'CREATE',
        resource:   'online_booking',
        details:    { referenceNumber, apptNumber, reason, doctorId, date, timeSlot },
      },
    })

    return NextResponse.json({ referenceNumber, appointmentNumber: apptNumber }, { status: 201 })

  } catch (err: any) {
    console.error('[API/book]', err)
    return NextResponse.json({
      error: 'Something went wrong. Please try again or call us directly.',
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { QUEUE_OPEN_STATUSES } from '@/lib/queue'
import { periodForTime, getOrCreateSession } from '@/lib/sessions'

const intakeSchema = z.object({
  branchId: z.string().min(1),
  tokenNumber: z.coerce.number().int().positive(),
  patientType: z.enum(['EXISTING', 'NEW', 'UNKNOWN']),
  firstName: z.string().optional().default(''),
  lastName: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  patientNumber: z.string().optional().default(''),
  dateOfBirth: z.string().optional().default(''),
  gender: z.string().optional().default(''),
  reason: z.string().optional().default(''),
  allergies: z.string().optional().default(''),
  medicalWarnings: z.string().optional().default(''),
  emergencyName: z.string().optional().default(''),
  emergencyPhone: z.string().optional().default(''),
})

function clean(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function findPatientMatch(data: z.infer<typeof intakeSchema>) {
  const patientNumber = clean(data.patientNumber)
  const phone = clean(data.phone)
  const dateOfBirth = clean(data.dateOfBirth)

  if (patientNumber) {
    const patient = await prisma.patient.findUnique({
      where: { patientNumber },
      select: { id: true },
    })
    if (patient) return { patientId: patient.id, confidence: 'HIGH' }
  }

  if (phone) {
    const matches = await prisma.patient.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [{ phone }, { phoneMobile: phone }],
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
      },
      select: { id: true },
      take: 2,
    })
    if (matches.length === 1) {
      return { patientId: matches[0].id, confidence: dateOfBirth ? 'HIGH' : 'MEDIUM' }
    }
  }

  return { patientId: null, confidence: null }
}

export async function POST(req: NextRequest) {
  const parsed = intakeSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form', details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  const now = new Date()
  const period = periodForTime(now)
  const clinicSession = period ? await getOrCreateSession(prisma, data.branchId, now, period) : null
  const match = data.patientType !== 'NEW' ? await findPatientMatch(data) : { patientId: null, confidence: null }
  const displayName = [clean(data.firstName), clean(data.lastName)].filter(Boolean).join(' ') || null
  const intakeStatus = match.patientId ? 'MATCHED' : data.patientType === 'NEW' ? 'QR_SUBMITTED' : 'NEEDS_REVIEW'

  const existingToken = await prisma.receptionQueueItem.findFirst({
    where: {
      branchId: data.branchId,
      sessionId: clinicSession?.id ?? undefined,
      queueNumber: data.tokenNumber,
      status: { in: QUEUE_OPEN_STATUSES },
    },
    select: { id: true },
  })

  const queueItem = existingToken
    ? await prisma.receptionQueueItem.update({
        where: { id: existingToken.id },
        data: {
          patientId: match.patientId,
          patientType: data.patientType,
          intakeStatus,
          displayName,
          contactPhone: clean(data.phone),
          reason: clean(data.reason),
          source: 'WALK_IN',
        },
      })
    : await prisma.receptionQueueItem.create({
        data: {
          branchId: data.branchId,
          sessionId: clinicSession?.id ?? null,
          queueNumber: data.tokenNumber,
          patientId: match.patientId,
          patientType: data.patientType,
          intakeStatus,
          displayName,
          contactPhone: clean(data.phone),
          reason: clean(data.reason),
          source: 'WALK_IN',
        },
      })

  const submissionData = {
      branchId: data.branchId,
      queueItemId: queueItem.id,
      matchedPatientId: match.patientId,
      tokenNumber: data.tokenNumber,
      source: 'QR',
      patientType: data.patientType,
      reviewStatus: match.patientId ? 'MATCHED' : 'PENDING',
      matchConfidence: match.confidence,
      firstName: clean(data.firstName),
      lastName: clean(data.lastName),
      phone: clean(data.phone),
      patientNumber: clean(data.patientNumber),
      dateOfBirth: clean(data.dateOfBirth),
      gender: clean(data.gender),
      reason: clean(data.reason),
      allergies: clean(data.allergies),
      medicalWarnings: clean(data.medicalWarnings),
      emergencyName: clean(data.emergencyName),
      emergencyPhone: clean(data.emergencyPhone),
      rawData: data,
  }

  const submission = await prisma.intakeSubmission.upsert({
    where: { queueItemId: queueItem.id },
    create: submissionData,
    update: submissionData,
  })

  return NextResponse.json({
    ok: true,
    queueItemId: queueItem.id,
    intakeSubmissionId: submission.id,
    matched: !!match.patientId,
    reviewNeeded: !match.patientId,
  }, { status: 201 })
}

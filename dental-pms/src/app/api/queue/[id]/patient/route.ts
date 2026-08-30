import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { z } from 'zod'

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRelation: z.string().optional(),
  reason: z.string().optional(),
  medicalFlags: z.record(z.boolean()).optional().default({}),
  allergyDetails: z.string().optional(),
  currentMedications: z.string().optional(),
  drugHistory: z.string().optional(),
  dietaryHistory: z.string().optional(),
  brushingHistory: z.string().optional(),
  medicalHistoryNote: z.string().optional(),
  oralHygieneHistory: z.string().optional(),
  habitHistory: z.string().optional(),
  familyHistory: z.string().optional(),
  socialHistory: z.string().optional(),
  extraOralExamination: z.string().optional(),
  intraOralExamination: z.string().optional(),
  notes: z.string().optional(),
})

function generatePatientNumber() {
  const num = String(Math.floor(Math.random() * 900000) + 100000)
  return `PT-${num}`
}

async function uniquePatientNumber() {
  let patientNumber = generatePatientNumber()
  let attempts = 0
  while (attempts < 10) {
    const exists = await prisma.patient.findUnique({ where: { patientNumber } })
    if (!exists) return patientNumber
    patientNumber = generatePatientNumber()
    attempts++
  }
  return patientNumber
}

function clean(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!can(session.user.role, 'queue.reception') && !can(session.user.role, 'patients.manage')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check all required fields', details: parsed.error.flatten() }, { status: 400 })
  }

  const queueItem = await prisma.receptionQueueItem.findUnique({
    where: { id },
    select: { id: true, branchId: true, queueNumber: true, patientId: true, intakeStatus: true },
  })
  if (!queueItem) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
  if (queueItem.patientId && queueItem.intakeStatus !== 'PAPER_PENDING') {
    return NextResponse.json({ error: 'This queue token is already linked to a completed patient profile' }, { status: 409 })
  }

  const data = parsed.data
  const patientNumber = await uniquePatientNumber()
  const displayName = `${data.firstName} ${data.lastName}`
  const selectedConditions = Object.entries(data.medicalFlags)
    .filter(([, value]) => value)
    .map(([condition]) => ({
      condition,
      status: 'ACTIVE',
      recordedAt: new Date().toISOString(),
    }))
  const historyNotes = {
    dietaryHistory: clean(data.dietaryHistory),
    brushingHistory: clean(data.brushingHistory),
    medicalHistoryNote: clean(data.medicalHistoryNote),
    oralHygieneHistory: clean(data.oralHygieneHistory),
    habitHistory: clean(data.habitHistory),
    familyHistory: clean(data.familyHistory),
    socialHistory: clean(data.socialHistory),
    extraOralExamination: clean(data.extraOralExamination),
    intraOralExamination: clean(data.intraOralExamination),
  }

  const result = await prisma.$transaction(async tx => {
    const medicalHistoryData = {
      allergies: data.medicalFlags.allergies
        ? [{ substance: data.allergyDetails, severity: 'UNKNOWN', reaction: data.allergyDetails, confirmed: false }]
        : [],
      medications: [
        data.currentMedications ? {
          name: data.currentMedications,
          dose: '',
          frequency: '',
          prescriber: '',
        } : null,
        data.drugHistory ? {
          name: data.drugHistory,
          dose: '',
          frequency: '',
          prescriber: 'History',
        } : null,
      ].filter(Boolean),
      conditions: [
        ...selectedConditions,
        { condition: 'Detailed history notes', status: 'RECORDED', notes: historyNotes },
      ],
      isPregnant: !!data.medicalFlags.pregnancyBreastFeeding,
      isSmoker: !!data.medicalFlags.socialHistory,
      requiresAntibiotic: !!data.medicalFlags.rheumaticFeverInjection,
    }

    const patient = queueItem.patientId
      ? await tx.patient.update({
          where: { id: queueItem.patientId },
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: new Date(data.dateOfBirth),
            gender: data.gender,
            phone: data.phone,
            email: clean(data.email),
            addressLine1: clean(data.addressLine1),
            city: clean(data.city),
            emergencyName: clean(data.emergencyName),
            emergencyPhone: clean(data.emergencyPhone),
            emergencyRelation: clean(data.emergencyRelation),
            notes: clean(data.notes),
            firstVisitDate: new Date(),
            medicalHistory: {
              upsert: {
                create: medicalHistoryData,
                update: medicalHistoryData,
              },
            },
          },
        })
      : await tx.patient.create({
          data: {
            patientNumber,
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: new Date(data.dateOfBirth),
            gender: data.gender,
            phone: data.phone,
            email: clean(data.email),
            addressLine1: clean(data.addressLine1),
            city: clean(data.city),
            emergencyName: clean(data.emergencyName),
            emergencyPhone: clean(data.emergencyPhone),
            emergencyRelation: clean(data.emergencyRelation),
            notes: clean(data.notes),
            firstVisitDate: new Date(),
            medicalHistory: { create: medicalHistoryData },
          },
        })

    const updatedQueue = await tx.receptionQueueItem.update({
      where: { id },
      data: {
        patientId: patient.id,
        patientType: 'NEW',
        intakeStatus: 'PATIENT_CREATED',
        displayName,
        contactPhone: data.phone,
        reason: clean(data.reason),
      },
    })

    await tx.intakeSubmission.upsert({
      where: { queueItemId: id },
      create: {
        branchId: queueItem.branchId,
        queueItemId: id,
        matchedPatientId: patient.id,
        tokenNumber: queueItem.queueNumber,
        source: 'PAPER_ENTRY',
        patientType: 'NEW',
        reviewStatus: 'CREATED_PATIENT',
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        reason: clean(data.reason),
        allergies: clean(data.allergyDetails),
        medicalWarnings: clean(data.medicalHistoryNote),
        emergencyName: clean(data.emergencyName),
        emergencyPhone: clean(data.emergencyPhone),
        rawData: data,
      },
      update: {
        matchedPatientId: patient.id,
        source: 'PAPER_ENTRY',
        patientType: 'NEW',
        reviewStatus: 'CREATED_PATIENT',
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        reason: clean(data.reason),
        allergies: clean(data.allergyDetails),
        medicalWarnings: clean(data.medicalHistoryNote),
        emergencyName: clean(data.emergencyName),
        emergencyPhone: clean(data.emergencyPhone),
        rawData: data,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        patientId: patient.id,
        action: queueItem.patientId ? 'UPDATE' : 'CREATE',
        resource: queueItem.patientId ? 'temporary_patient_from_queue' : 'patient_from_queue',
        resourceId: patient.id,
        details: { queueItemId: id, queueNumber: queueItem.queueNumber, patientNumber: patient.patientNumber },
      },
    })

    return { patient, queueItem: updatedQueue }
  })

  return NextResponse.json(result, { status: 201 })
}

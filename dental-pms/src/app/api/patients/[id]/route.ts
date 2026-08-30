import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { can } from '@/lib/permissions'

const schema = z.object({
  firstName:         z.string().min(1),
  lastName:          z.string().min(1),
  dateOfBirth:       z.string(),
  gender:            z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
  phone:             z.string().min(1),
  email:             z.string().email().optional().or(z.literal('')),
  addressLine1:      z.string().optional(),
  city:              z.string().optional(),
  preferredLanguage: z.string().default('en'),
  communicationPref: z.string().default('email'),
  emergencyName:     z.string().optional(),
  emergencyPhone:    z.string().optional(),
  emergencyRelation: z.string().optional(),
  notes:             z.string().optional(),
  medicalFlags:      z.record(z.boolean()).optional().default({}),
  allergyDetails:    z.string().optional(),
  currentMedications:z.string().optional(),
  drugHistory:       z.string().optional(),
  dietaryHistory:    z.string().optional(),
  brushingHistory:   z.string().optional(),
  medicalHistoryNote:z.string().optional(),
  oralHygieneHistory:z.string().optional(),
  habitHistory:      z.string().optional(),
  familyHistory:     z.string().optional(),
  socialHistory:     z.string().optional(),
  extraOralExamination: z.string().optional(),
  intraOralExamination: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!can(session.user.role, 'patients.manage')) {
      return NextResponse.json({ error: 'Your role cannot edit patients' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.patient.findUnique({ where: { id, deletedAt: null } })
    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const body   = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please check all required fields', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data
    const selectedConditions = Object.entries(data.medicalFlags)
      .filter(([, value]) => value)
      .map(([condition]) => ({
        condition,
        status: 'ACTIVE',
        recordedAt: new Date().toISOString(),
      }))

    const allergies = data.medicalFlags.allergies
      ? [{
          substance: data.allergyDetails || 'Allergy reported',
          severity: 'UNKNOWN',
          reaction: data.allergyDetails || '',
          confirmed: false,
        }]
      : []

    const medications = [
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
    ].filter(Boolean)

    const historyNotes = {
      dietaryHistory: data.dietaryHistory || null,
      brushingHistory: data.brushingHistory || null,
      medicalHistoryNote: data.medicalHistoryNote || null,
      oralHygieneHistory: data.oralHygieneHistory || null,
      habitHistory: data.habitHistory || null,
      familyHistory: data.familyHistory || null,
      socialHistory: data.socialHistory || null,
      extraOralExamination: data.extraOralExamination || null,
      intraOralExamination: data.intraOralExamination || null,
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        firstName:         data.firstName,
        lastName:          data.lastName,
        dateOfBirth:       new Date(data.dateOfBirth),
        gender:            data.gender,
        phone:             data.phone,
        email:             data.email || null,
        addressLine1:      data.addressLine1 || null,
        city:              data.city || null,
        preferredLanguage: data.preferredLanguage,
        communicationPref: data.communicationPref,
        emergencyName:     data.emergencyName || null,
        emergencyPhone:    data.emergencyPhone || null,
        emergencyRelation: data.emergencyRelation || null,
        notes:             data.notes || null,
        medicalHistory: {
          upsert: {
            create: {
              allergies,
              medications,
              conditions: [
                ...selectedConditions,
                { condition: 'Detailed history notes', status: 'RECORDED', notes: historyNotes },
              ],
              isPregnant: !!data.medicalFlags.pregnancyBreastFeeding,
              isSmoker: !!data.medicalFlags.socialHistory,
              requiresAntibiotic: !!data.medicalFlags.rheumaticFeverInjection,
            },
            update: {
              allergies,
              medications,
              conditions: [
                ...selectedConditions,
                { condition: 'Detailed history notes', status: 'RECORDED', notes: historyNotes },
              ],
              isPregnant: !!data.medicalFlags.pregnancyBreastFeeding,
              isSmoker: !!data.medicalFlags.socialHistory,
              requiresAntibiotic: !!data.medicalFlags.rheumaticFeverInjection,
            },
          },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId:     session.user.id,
        patientId:  patient.id,
        action:     'UPDATE',
        resource:   'patient',
        resourceId: patient.id,
        details:    { patientNumber: patient.patientNumber },
      },
    })

    return NextResponse.json(patient)
  } catch (error: any) {
    console.error('Update patient error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

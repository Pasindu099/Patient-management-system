import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { EditPatientForm, type EditPatientFormData } from '@/components/patients/EditPatientForm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Edit Patient' }

interface PageProps { params: Promise<{ id: string }> }

export default async function EditPatientPage({ params }: PageProps) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'patients.manage')) redirect('/dashboard')
  const { id } = await params

  const patient = await prisma.patient.findUnique({
    where: { id, deletedAt: null },
    include: { medicalHistory: true },
  })
  if (!patient) notFound()

  const conditions = (patient.medicalHistory?.conditions as any[]) ?? []
  const allergies  = (patient.medicalHistory?.allergies  as any[]) ?? []
  const medications = (patient.medicalHistory?.medications as any[]) ?? []

  const medicalFlags: Record<string, boolean> = {}
  for (const c of conditions) {
    if (c.status === 'ACTIVE' && c.condition) medicalFlags[c.condition] = true
  }

  const historyEntry = conditions.find(c => c.condition === 'Detailed history notes')
  const historyNotes = historyEntry?.notes ?? {}

  const currentMedications = medications.find((m: any) => m.prescriber !== 'History')?.name ?? ''
  const drugHistory        = medications.find((m: any) => m.prescriber === 'History')?.name ?? ''

  const defaultValues: EditPatientFormData = {
    firstName:         patient.firstName,
    lastName:          patient.lastName,
    dateOfBirth:       patient.dateOfBirth.toISOString().split('T')[0],
    gender:            patient.gender as EditPatientFormData['gender'],
    phone:             patient.phone,
    email:             patient.email ?? '',
    addressLine1:      patient.addressLine1 ?? '',
    city:              patient.city ?? '',
    preferredLanguage: patient.preferredLanguage ?? 'en',
    communicationPref: patient.communicationPref ?? 'email',
    emergencyName:     patient.emergencyName ?? '',
    emergencyPhone:    patient.emergencyPhone ?? '',
    emergencyRelation: patient.emergencyRelation ?? '',
    notes:             patient.notes ?? '',
    medicalFlags,
    allergyDetails:    allergies[0]?.reaction || allergies[0]?.substance || '',
    currentMedications,
    drugHistory,
    dietaryHistory:       historyNotes.dietaryHistory ?? '',
    brushingHistory:      historyNotes.brushingHistory ?? '',
    medicalHistoryNote:   historyNotes.medicalHistoryNote ?? '',
    oralHygieneHistory:   historyNotes.oralHygieneHistory ?? '',
    habitHistory:         historyNotes.habitHistory ?? '',
    familyHistory:        historyNotes.familyHistory ?? '',
    socialHistory:        historyNotes.socialHistory ?? '',
    extraOralExamination: historyNotes.extraOralExamination ?? '',
    intraOralExamination: historyNotes.intraOralExamination ?? '',
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href={`/patients/${patient.id}`}
        className="inline-flex items-center gap-1.5 text-base text-gray-500
                   hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to patient
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Edit patient</h1>
        <p className="text-base text-gray-500 mt-1">
          Update {patient.firstName} {patient.lastName}'s details below.
        </p>
      </div>

      <EditPatientForm patientId={patient.id} defaultValues={defaultValues} />
    </div>
  )
}

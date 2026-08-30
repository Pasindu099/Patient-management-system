import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { ClinicalWorkspace } from '@/components/clinical/ClinicalWorkspace'
import type { Metadata } from 'next'

interface Props { params: Promise<{ patientId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { patientId } = await params
  const p = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { firstName: true, lastName: true },
  })
  if (!p) return { title: 'Patient not found' }
  return { title: `Clinical — ${p.firstName} ${p.lastName}` }
}

export default async function ClinicalPatientPage({ params }: Props) {
  const session = await auth()
  if (!session) return null
  const { patientId } = await params

  const patient = await prisma.patient.findUnique({
    where: { id: patientId, deletedAt: null },
    include: {
      medicalHistory: { select: { allergies: true, conditions: true, medications: true } },
      clinicalNotes: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { author: { select: { name: true } } },
      },
      treatmentPlans: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { items: true, createdBy: { select: { name: true } } },
      },
      riskAssessments: {
        orderBy: { assessedAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!patient) notFound()

  return (
    <ClinicalWorkspace
      patient={JSON.parse(JSON.stringify(patient))}
      currentUser={session.user}
    />
  )
}

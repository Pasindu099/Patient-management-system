import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { QUEUE_OPEN_STATUSES } from '@/lib/queue'
import { DiagnosisAssistClient } from '@/components/queue/DiagnosisAssistClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Diagnosis Assist' }

// Nurse-assist entry point: lets a nurse add tooth-chart findings for a
// patient currently in a doctor's chair, while the doctor is examining them.
// Nothing else about the visit (complaint, plan, billing) is exposed here.
export default async function DiagnosisAssistPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'clinical.diagnosis')) redirect('/dashboard')

  const queue = await prisma.receptionQueueItem.findMany({
    where: {
      status: { in: QUEUE_OPEN_STATUSES.filter(s => s !== 'COMPLETED') },
    },
    orderBy: [{ status: 'desc' }, { queueNumber: 'asc' }],
    include: {
      patient: {
        select: { id: true, firstName: true, lastName: true, preferredName: true, patientNumber: true, dateOfBirth: true },
      },
      intakeSubmission: {
        select: { firstName: true, lastName: true, patientNumber: true, dateOfBirth: true },
      },
      assignedDoctor: { select: { id: true, name: true } },
    },
  })

  return (
    <DiagnosisAssistClient
      initialQueue={JSON.parse(JSON.stringify(queue))}
      currentUser={session.user}
    />
  )
}

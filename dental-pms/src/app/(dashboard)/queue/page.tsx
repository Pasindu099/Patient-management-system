import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { ReceptionQueueClient } from '@/components/queue/ReceptionQueueClient'
import type { Metadata } from 'next'
import { can, DOCTOR_ROLES } from '@/lib/permissions'
import { QUEUE_OPEN_STATUSES } from '@/lib/queue'

export const metadata: Metadata = { title: 'Reception Queue' }

export default async function QueuePage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'queue.reception')) redirect('/dashboard')

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
  const defaultBranchId = branches[0]?.id ?? ''

  const providers = await prisma.user.findMany({
    where: { isActive: true, role: { in: [...DOCTOR_ROLES] } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, role: true },
  })

  const queue = await prisma.receptionQueueItem.findMany({
    where: {
      ...(defaultBranchId ? { branchId: defaultBranchId } : {}),
      status: { in: QUEUE_OPEN_STATUSES },
    },
    orderBy: [{ priority: 'desc' }, { queueNumber: 'asc' }, { arrivedAt: 'asc' }],
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          patientNumber: true,
          phone: true,
          nicNumber: true,
          dateOfBirth: true,
          gender: true,
        },
      },
      intakeSubmission: {
        select: {
          id: true,
          source: true,
          reviewStatus: true,
          matchConfidence: true,
          firstName: true,
          lastName: true,
          phone: true,
          patientNumber: true,
          dateOfBirth: true,
          gender: true,
          reason: true,
          allergies: true,
          medicalWarnings: true,
          createdAt: true,
        },
      },
      branch: { select: { id: true, name: true } },
      assignedDoctor: { select: { id: true, name: true } },
      appointment: { select: { id: true, appointmentNumber: true, startTime: true, type: true } },
    },
  })

  return (
    <ReceptionQueueClient
      initialQueue={JSON.parse(JSON.stringify(queue))}
      branches={JSON.parse(JSON.stringify(branches))}
      providers={JSON.parse(JSON.stringify(providers))}
      currentUser={session.user}
      defaultBranchId={defaultBranchId}
    />
  )
}

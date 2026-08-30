import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppointmentsClient } from '@/components/appointments/AppointmentsClient'
import type { Metadata } from 'next'
import { isDoctorRole, DOCTOR_ROLES } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Appointments' }

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; date?: string }>
}) {
  const session = await auth()
  if (!session) return null
  const params = await searchParams

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  // All branches user can access
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })

  // All providers (dentists + hygienists)
  const providers = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: [...DOCTOR_ROLES] },
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })

  // Today's appointments for initial load
  const selectedBranchId = params.branch || branches[0]?.id || ''

  const providerFilter = isDoctorRole(session.user.role)
    ? { providerId: session.user.id }
    : {}

  const todaysAppointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: today, lte: todayEnd },
      ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
      ...providerFilter,
    },
    orderBy: { startTime: 'asc' },
    include: {
      patient:  { select: { id: true, firstName: true, lastName: true, patientNumber: true, phone: true, nicNumber: true } },
      provider: { select: { id: true, name: true, role: true } },
      branch:   { select: { id: true, name: true } },
    },
  })

  // Walk-in queue (today, walk-ins still scheduled/in-progress)
  const walkInQueue = todaysAppointments.filter(
    a => a.bookingSource === 'WALKIN' && ['SCHEDULED', 'IN_PROGRESS', 'CONFIRMED'].includes(a.status)
  )

  return (
    <AppointmentsClient
      initialAppointments={JSON.parse(JSON.stringify(todaysAppointments))}
      walkInQueue={JSON.parse(JSON.stringify(walkInQueue))}
      branches={JSON.parse(JSON.stringify(branches))}
      providers={JSON.parse(JSON.stringify(providers))}
      currentUser={session.user}
      selectedBranchId={selectedBranchId}
    />
  )
}

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { can, DOCTOR_ROLES } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { RosterManager } from '@/components/settings/RosterManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Doctor Roster' }

export default async function RosterPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'settings.admin')) redirect('/settings')

  const [doctors, branches, roster] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: { in: [...DOCTOR_ROLES] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, chairCount: true,
        onlineSlotsDefault: true, appointmentSlotsDefault: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.doctorBranchAvailability.findMany({
      where: { isActive: true },
      select: { doctorId: true, branchId: true, weekday: true, period: true },
    }),
  ])

  return <RosterManager doctors={doctors} branches={branches} initialRoster={roster} />
}

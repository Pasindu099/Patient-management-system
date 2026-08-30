import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions'
import { ReportsDashboard } from '@/components/reports/ReportsDashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // Clinic-wide revenue, AR aging and branch comparison — admin only.
  if (!can(session.user.role, 'money.aggregate')) redirect('/dashboard')

  // Pass branches for the filter selector
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return <ReportsDashboard branches={branches} />
}

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions'
import { KpiDashboard } from '@/components/kpi/KpiDashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Practice KPIs' }

export default async function KpiPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'kpi.admin')) redirect('/dashboard')

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return <KpiDashboard branches={branches} />
}

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { FinanceDashboard } from '@/components/finance/FinanceDashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Finance' }

export default async function FinancePage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'finance.admin')) redirect('/dashboard')

  const [branches, salaryRecords] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.salaryRecord.findMany({
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { createdAt: 'desc' }],
      take: 24,
      include: { user: { select: { name: true, role: true } } },
    }),
  ])

  return <FinanceDashboard branches={branches} salaryRecords={JSON.parse(JSON.stringify(salaryRecords))} />
}

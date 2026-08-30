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

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return <FinanceDashboard branches={branches} />
}

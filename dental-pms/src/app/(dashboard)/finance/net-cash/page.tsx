import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { NetCashReport } from '@/components/finance/NetCashReport'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Earnings Report' }

export default async function NetCashReportPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'finance.admin')) redirect('/dashboard')

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return <NetCashReport branches={branches} />
}

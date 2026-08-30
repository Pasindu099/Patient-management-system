import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions'
import { ScanStockClient } from '@/components/inventory/ScanStockClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Scan stock' }

export default async function ScanStockPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'inventory.adjust')) redirect('/inventory')

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return <ScanStockClient branches={branches} />
}

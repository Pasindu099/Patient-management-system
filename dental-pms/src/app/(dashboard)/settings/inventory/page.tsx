import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions'
import { BomManager } from '@/components/settings/BomManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Treatment BOMs' }

export default async function InventoryBomsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'settings.admin')) redirect('/settings')

  const [fees, items] = await Promise.all([
    prisma.treatmentFee.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, name: true, category: true },
    }),
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, unit: true },
    }),
  ])

  return <BomManager fees={fees} items={items} />
}

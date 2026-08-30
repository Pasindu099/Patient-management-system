import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions'
import { InventoryClient } from '@/components/inventory/InventoryClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Inventory' }

export default async function InventoryPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'inventory.adjust') && !can(session.user.role, 'settings.admin')) {
    redirect('/dashboard')
  }

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <InventoryClient
      branches={branches}
      canAdjust={can(session.user.role, 'inventory.adjust')}
      canManageCatalog={can(session.user.role, 'settings.admin')}
    />
  )
}

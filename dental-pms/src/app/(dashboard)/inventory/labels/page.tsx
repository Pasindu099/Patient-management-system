import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions'
import { LabelSheet } from '@/components/inventory/LabelSheet'
import QRCode from 'qrcode'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Inventory labels' }

interface Props {
  searchParams: Promise<{ itemId?: string }>
}

export default async function InventoryLabelsPage({ searchParams }: Props) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'settings.admin')) redirect('/inventory')

  const query = await searchParams
  const items = await prisma.inventoryItem.findMany({
    where: {
      isActive: true,
      code: { not: null },
      ...(query.itemId ? { id: query.itemId } : {}),
    },
    orderBy: { code: 'asc' },
    select: { id: true, name: true, unit: true, code: true },
  })

  // Rendered here rather than in the browser: printing is a one-off admin
  // action, and a server-built data URL means the sheet prints identically
  // everywhere with no client-side canvas work.
  const labels = await Promise.all(
    items.map(async item => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      code: item.code!,
      qr: await QRCode.toDataURL(item.code!, { margin: 1, width: 240, errorCorrectionLevel: 'M' }),
    }))
  )

  return <LabelSheet labels={labels} />
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { authenticateServiceAccount, hasScope } from '@/lib/service-auth'
import { z } from 'zod'

// GET /api/inventory/stock?branchId — every catalog item with this branch's
// quantity/threshold (creates a zero-stock row on the fly if none exists yet,
// so the list always shows the full catalog).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    const agent = await authenticateServiceAccount(req)
    if (!agent || !hasScope(agent, 'inventory:read')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }
  }

  const branchId = new URL(req.url).searchParams.get('branchId')
  if (!branchId) return NextResponse.json({ error: 'branchId required' }, { status: 400 })

  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: { stock: { where: { branchId } } },
  })

  return NextResponse.json(items.map(item => ({
    itemId: item.id,
    name: item.name,
    unit: item.unit,
    code: item.code,
    quantity: item.stock[0]?.quantity ?? 0,
    reorderThreshold: item.stock[0]?.reorderThreshold ?? 0,
    stockId: item.stock[0]?.id ?? null,
    lowStock: item.stock[0] ? item.stock[0].quantity <= item.stock[0].reorderThreshold : false,
  })))
}

const thresholdSchema = z.object({
  itemId: z.string().min(1),
  branchId: z.string().min(1),
  reorderThreshold: z.number().min(0),
})

// PATCH /api/inventory/stock — set the reorder threshold for an item at a
// branch (admin configures; creates the stock row if it doesn't exist yet)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = thresholdSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  const { itemId, branchId, reorderThreshold } = parsed.data

  const stock = await prisma.inventoryStock.upsert({
    where: { itemId_branchId: { itemId, branchId } },
    update: { reorderThreshold },
    create: { itemId, branchId, quantity: 0, reorderThreshold },
  })
  return NextResponse.json(stock)
}

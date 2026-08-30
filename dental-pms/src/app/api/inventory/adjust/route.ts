import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { clearLowStockFlagIfAboveThreshold } from '@/lib/inventory'
import { z } from 'zod'

const schema = z.object({
  itemId: z.string().min(1),
  branchId: z.string().min(1),
  kind: z.enum(['RECEIVED', 'CORRECTION', 'STOCK_TAKE']),
  // RECEIVED/CORRECTION: signed quantity change. STOCK_TAKE: the counted total.
  amount: z.number(),
  reason: z.string().optional().nullable(),
})

// POST /api/inventory/adjust — manual stock movement, always logged with
// who made it and why. Nurses and receptionists do goods-received and
// stock-take; corrections are available to the same roles for simplicity.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'inventory.adjust')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  const { itemId, branchId, kind, amount, reason } = parsed.data

  const result = await prisma.$transaction(async tx => {
    const stock = await tx.inventoryStock.upsert({
      where: { itemId_branchId: { itemId, branchId } },
      update: {},
      create: { itemId, branchId, quantity: 0, reorderThreshold: 0 },
    })

    let delta: number
    let countedQuantity: number | null = null
    if (kind === 'STOCK_TAKE') {
      delta = amount - stock.quantity
      countedQuantity = amount
    } else {
      delta = kind === 'RECEIVED' ? Math.abs(amount) : amount
    }

    const updated = await tx.inventoryStock.update({
      where: { id: stock.id },
      data: { quantity: stock.quantity + delta },
    })
    await tx.stockAdjustment.create({
      data: {
        stockId: stock.id, delta, kind, reason: reason || null,
        countedQuantity, userId: session.user.id,
      },
    })
    return updated
  })

  await clearLowStockFlagIfAboveThreshold(prisma, result.id)

  await prisma.auditLog.create({
    data: {
      userId:   session.user.id,
      action:   'UPDATE',
      resource: 'inventory_adjustment',
      resourceId: result.id,
      details:  { itemId, branchId, kind, amount, reason },
    },
  })

  return NextResponse.json(result, { status: 201 })
}

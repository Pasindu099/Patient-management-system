import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { recordLedgerTx } from '@/lib/ledger'

// POST /api/purchase-orders/[id]/receive — receiving goods increments
// branch inventory (RECEIVED stock adjustments) AND writes the expense to
// the ledger (OUT/SUPPLIES), linked to the PO. One action, two effects,
// same transaction.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } })
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (po.status === 'RECEIVED') return NextResponse.json({ error: 'Already received' }, { status: 400 })
  if (po.status === 'CANCELLED') return NextResponse.json({ error: 'This order was cancelled' }, { status: 400 })

  const updated = await prisma.$transaction(async tx => {
    for (const line of po.items) {
      const stock = await tx.inventoryStock.upsert({
        where: { itemId_branchId: { itemId: line.itemId, branchId: po.branchId } },
        update: {},
        create: { itemId: line.itemId, branchId: po.branchId, quantity: 0, reorderThreshold: 0 },
      })
      await tx.inventoryStock.update({
        where: { id: stock.id },
        data: { quantity: stock.quantity + line.quantity },
      })
      await tx.stockAdjustment.create({
        data: {
          stockId: stock.id, delta: line.quantity, kind: 'RECEIVED',
          reason: `PO ${po.poNumber}`, userId: session.user.id,
        },
      })
    }

    const ledgerTx = await recordLedgerTx(tx, {
      direction: 'OUT',
      amountCents: po.totalCents,
      categoryCode: 'SUPPLIES',
      branchId: po.branchId,
      recordedByUserId: session.user.id,
      refType: 'purchase_order',
      refId: po.id,
    })

    return tx.purchaseOrder.update({
      where: { id },
      data: { status: 'RECEIVED', receivedAt: new Date(), ledgerTxId: ledgerTx?.id ?? null },
    })
  })

  await prisma.auditLog.create({
    data: {
      userId:   session.user.id,
      action:   'UPDATE',
      resource: 'purchase_order',
      resourceId: id,
      details:  { status: 'RECEIVED', totalCents: po.totalCents },
    },
  })

  return NextResponse.json(updated)
}

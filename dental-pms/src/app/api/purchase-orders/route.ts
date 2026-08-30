import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { toCents } from '@/lib/money'
import { z } from 'zod'

function genPoNumber() {
  return `PO-${String(Math.floor(Math.random() * 900000) + 100000)}`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const status = new URL(req.url).searchParams.get('status')
  const orders = await prisma.purchaseOrder.findMany({
    where: status ? { status } : {},
    include: {
      supplier: { select: { name: true } },
      branch: { select: { name: true } },
      items: { include: { item: { select: { name: true, unit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}

const lineSchema = z.object({ itemId: z.string().min(1), quantity: z.number().positive(), unitCost: z.number().min(0) })
const schema = z.object({
  supplierId: z.string().min(1),
  branchId:   z.string().min(1),
  items:      z.array(lineSchema).min(1),
})

// POST — create a draft purchase order (not yet received; inventory/ledger
// are untouched until /receive is called)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data

  let poNumber = genPoNumber()
  while (await prisma.purchaseOrder.findUnique({ where: { poNumber } })) poNumber = genPoNumber()

  const totalCents = d.items.reduce((s, l) => s + l.quantity * toCents(l.unitCost), 0)

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber, supplierId: d.supplierId, branchId: d.branchId,
      status: 'ORDERED', orderedAt: new Date(), totalCents,
      createdById: session.user.id,
      items: {
        create: d.items.map(l => ({ itemId: l.itemId, quantity: l.quantity, unitCostCents: toCents(l.unitCost) })),
      },
    },
    include: { items: true },
  })
  return NextResponse.json(po, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { toCents, fromCents } from '@/lib/money'
import { can } from '@/lib/permissions'

const canBill = (role: string) =>
  can(role, 'billing.collect') || can(role, 'money.aggregate')

const invoiceStatuses = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED', 'WRITTEN_OFF'] as const

const itemSchema = z.object({
  description:  z.string().min(1),
  toothNumbers: z.string().optional(),
  quantity:     z.number().int().min(1).default(1),
  unitPrice:    z.number().min(0),
})

const createSchema = z.object({
  patientId:    z.string().min(1),
  branchId:     z.string().optional(),
  currency:     z.enum(['LKR', 'USD']).default('LKR'),
  exchangeRate: z.number().optional().nullable(),
  discount:     z.number().min(0).default(0),
  tax:          z.number().min(0).default(0),
  dueDate:      z.string().optional().nullable(),
  notes:        z.string().optional().nullable(),
  items:        z.array(itemSchema).min(1),
})

function generateInvoiceNumber() {
  const y = new Date().getFullYear()
  const n = String(Math.floor(Math.random() * 900000) + 100000)
  return `INV-${y}-${n}`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  // Standalone invoicing is a front-desk job. Visit bills do not come through
  // here — they are written inside the POST /api/visits transaction.
  if (!canBill(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body   = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  // Cents-authoritative; float columns are frozen legacy mirrors
  const subtotalCents = d.items.reduce((s, i) => s + i.quantity * toCents(i.unitPrice), 0)
  const discountCents = toCents(d.discount)
  const taxCents      = toCents(d.tax)
  const totalCents    = subtotalCents - discountCents + taxCents
  const balanceCents  = totalCents

  let invoiceNumber = generateInvoiceNumber()
  while (await prisma.invoice.findUnique({ where: { invoiceNumber } })) {
    invoiceNumber = generateInvoiceNumber()
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      patientId:    d.patientId,
      branchId:     d.branchId || null,
      currency:     d.currency,
      exchangeRate: d.exchangeRate || null,
      status:       'SENT',
      subtotalCents,
      discountCents,
      taxCents,
      totalCents,
      amountPaidCents: 0,
      balanceCents,
      subtotal:   fromCents(subtotalCents), // legacy mirrors
      discount:   fromCents(discountCents),
      tax:        fromCents(taxCents),
      total:      fromCents(totalCents),
      amountPaid: 0,
      balance:    fromCents(balanceCents),
      dueDate:      d.dueDate ? new Date(d.dueDate) : null,
      notes:        d.notes || null,
      items: {
        create: d.items.map(item => ({
          description:  item.description,
          toothNumbers: item.toothNumbers || null,
          quantity:     item.quantity,
          unitPriceCents: toCents(item.unitPrice),
          totalCents:     item.quantity * toCents(item.unitPrice),
          unitPrice:    fromCents(toCents(item.unitPrice)),
          total:        fromCents(item.quantity * toCents(item.unitPrice)),
        })),
      },
    },
  })

  await prisma.auditLog.create({
    data: {
      userId:     session.user.id,
      patientId:  d.patientId,
      action:     'CREATE',
      resource:   'invoice',
      resourceId: invoice.id,
      details:    { invoiceNumber, totalCents, currency: d.currency },
    },
  })

  return NextResponse.json(invoice, { status: 201 })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  // Unfiltered, this lists every bill in the clinic. Doctors see the bill they
  // raise at the chair, never a ledger of them.
  if (!canBill(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  const statusParam = searchParams.get('status')
  const status = invoiceStatuses.find(value => value === statusParam)

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(patientId ? { patientId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      patient: { select: { firstName: true, lastName: true, patientNumber: true } },
      _count:  { select: { items: true } },
    },
  })

  return NextResponse.json(invoices)
}

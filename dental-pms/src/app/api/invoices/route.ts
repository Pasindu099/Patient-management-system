import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { toCents, fromCents } from '@/lib/money'
import { can } from '@/lib/permissions'
import { recordLedgerTx } from '@/lib/ledger'

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
  installmentPlan: z.object({
    enabled:              z.boolean().default(false),
    numberOfInstallments: z.number().int().min(1).max(60).default(10),
    paidInstallments:     z.number().int().min(0).max(60).default(0),
    paidAt:               z.string().optional().nullable(),
    method:               z.enum(['cash', 'card', 'bank_transfer']).default('cash'),
    notes:                z.string().optional().nullable(),
  }).optional(),
})

function generateInvoiceNumber() {
  const y = new Date().getFullYear()
  const n = String(Math.floor(Math.random() * 900000) + 100000)
  return `INV-${y}-${n}`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  // Standalone invoices are not tied to a treating doctor, so only admin can
  // create them. Visit bills are written inside POST /api/visits by doctors.
  if (!can(session.user.role, 'money.aggregate')) {
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
  const plan = d.installmentPlan?.enabled ? d.installmentPlan : null
  const installmentCount = plan?.numberOfInstallments ?? 0
  const paidInstallmentCount = plan ? Math.min(plan.paidInstallments, installmentCount) : 0
  const installmentAmounts = plan
    ? Array.from({ length: installmentCount }, (_, idx) => {
        const base = Math.floor(totalCents / installmentCount)
        const remainder = totalCents % installmentCount
        return base + (idx < remainder ? 1 : 0)
      })
    : []
  const openingPaidCents = installmentAmounts
    .slice(0, paidInstallmentCount)
    .reduce((sum, amount) => sum + amount, 0)
  const balanceCents  = Math.max(0, totalCents - openingPaidCents)
  const initialStatus = balanceCents === 0 ? 'PAID' : openingPaidCents > 0 ? 'PARTIAL' : 'SENT'
  const openingPaidAt = plan?.paidAt ? new Date(plan.paidAt) : new Date()

  let invoiceNumber = generateInvoiceNumber()
  while (await prisma.invoice.findUnique({ where: { invoiceNumber } })) {
    invoiceNumber = generateInvoiceNumber()
  }

  const invoice = await prisma.$transaction(async tx => {
    const created = await tx.invoice.create({
      data: {
        invoiceNumber,
        patientId:    d.patientId,
        branchId:     d.branchId || null,
        currency:     d.currency,
        exchangeRate: d.exchangeRate || null,
        status:       initialStatus,
        subtotalCents,
        discountCents,
        taxCents,
        totalCents,
        amountPaidCents: openingPaidCents,
        balanceCents,
        subtotal:   fromCents(subtotalCents), // legacy mirrors
        discount:   fromCents(discountCents),
        tax:        fromCents(taxCents),
        total:      fromCents(totalCents),
        amountPaid: fromCents(openingPaidCents),
        balance:    fromCents(balanceCents),
        paidDate:   initialStatus === 'PAID' ? openingPaidAt : null,
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
        installmentPlan: plan ? {
          create: {
            patientId: d.patientId,
            totalAmountCents: totalCents,
            totalAmount: fromCents(totalCents),
            numberOfInstallments: installmentCount,
            amountPerInstallmentCents: installmentAmounts[0] ?? 0,
            amountPerInstallment: fromCents(installmentAmounts[0] ?? 0),
            notes: plan.notes || null,
            createdById: session.user.id,
            installments: {
              create: installmentAmounts.map((amountCents, idx) => ({
                number: idx + 1,
                amountCents,
                amount: fromCents(amountCents),
                paidAt: idx < paidInstallmentCount ? openingPaidAt : null,
                paidAmountCents: idx < paidInstallmentCount ? amountCents : null,
                paidAmount: idx < paidInstallmentCount ? fromCents(amountCents) : null,
                paymentMethod: idx < paidInstallmentCount ? plan.method : null,
                notes: idx < paidInstallmentCount ? 'Recorded as historical ortho payment' : null,
              })),
            },
          },
        } : undefined,
      },
    })

    for (let idx = 0; idx < paidInstallmentCount; idx += 1) {
      const amountCents = installmentAmounts[idx]
      const payment = await tx.payment.create({
        data: {
          invoiceId: created.id,
          amountCents,
          amount: fromCents(amountCents),
          currency: d.currency,
          method: plan!.method,
          notes: `Historical ortho installment ${idx + 1}/${installmentCount}`,
          paidAt: openingPaidAt,
          processedById: session.user.id,
        },
      })
      await recordLedgerTx(tx, {
        direction:        'IN',
        amountCents,
        currency:         d.currency,
        categoryCode:     'PATIENT_PAYMENT',
        branchId:         d.branchId || null,
        recordedByUserId: session.user.id,
        refType:          'payment',
        refId:            payment.id,
        notes:            `Historical ortho installment ${idx + 1}/${installmentCount}`,
        date:             openingPaidAt,
      })
    }

    return created
  })

  await prisma.auditLog.create({
    data: {
      userId:     session.user.id,
      patientId:  d.patientId,
      action:     'CREATE',
      resource:   'invoice',
      resourceId: invoice.id,
      details:    { invoiceNumber, totalCents, currency: d.currency, installmentCount, paidInstallmentCount },
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
  const canSeeAllMoney = can(session.user.role, 'money.aggregate')

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  const statusParam = searchParams.get('status')
  const status = invoiceStatuses.find(value => value === statusParam)
  const canCollect = can(session.user.role, 'billing.collect')

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(patientId ? { patientId } : {}),
      ...(status ? { status } : {}),
      ...(canSeeAllMoney || canCollect ? {} : { visitInvoices: { some: { visit: { doctorId: session.user.id } } } }),
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

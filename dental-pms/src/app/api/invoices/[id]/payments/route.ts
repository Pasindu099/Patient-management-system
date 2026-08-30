import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { closeVisitsForPaidInvoice } from '@/lib/visit-sync'
import { toCents, fromCents } from '@/lib/money'
import { recordLedgerTx } from '@/lib/ledger'
import { can } from '@/lib/permissions'
import { z } from 'zod'

const schema = z.object({
  amount:    z.number().positive(), // rupees at the API boundary
  currency:  z.enum(['LKR', 'USD']).default('LKR'),
  method:    z.enum(['cash', 'card', 'bank_transfer']),
  reference: z.string().optional().nullable(),
  notes:     z.string().optional().nullable(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!can(session.user.role, 'billing.collect')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true, patientId: true, status: true, branchId: true,
      totalCents: true, amountPaidCents: true, balanceCents: true,
      visitInvoices: { select: { visit: { select: { doctorId: true } } } },
    },
  })

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (!invoice.visitInvoices.some(link => link.visit.doctorId === session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (['CANCELLED', 'WRITTEN_OFF'].includes(invoice.status)) {
    return NextResponse.json({ error: 'Cannot record payment on a cancelled invoice' }, { status: 400 })
  }

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  const { amount, currency, method, reference, notes } = parsed.data
  const amountCents = toCents(amount)

  if (amountCents > invoice.balanceCents) {
    return NextResponse.json({
      error: `Payment amount (${amount}) exceeds outstanding balance (${fromCents(invoice.balanceCents).toFixed(2)})`
    }, { status: 400 })
  }

  const newAmountPaidCents = invoice.amountPaidCents + amountCents
  const newBalanceCents    = Math.max(0, invoice.totalCents - newAmountPaidCents)
  const newStatus          = newBalanceCents === 0 ? 'PAID' : newAmountPaidCents > 0 ? 'PARTIAL' : invoice.status

  const payment = await prisma.$transaction(async tx => {
    const created = await tx.payment.create({
      data: {
        invoiceId: id,
        amountCents,
        amount: fromCents(amountCents), // frozen legacy mirror
        currency,
        method,
        reference: reference || null,
        notes:     notes     || null,
        processedById: session.user.id,
      },
    })
    await tx.invoice.update({
      where: { id },
      data: {
        amountPaidCents: newAmountPaidCents,
        balanceCents:    newBalanceCents,
        amountPaid:      fromCents(newAmountPaidCents), // legacy mirrors
        balance:         fromCents(newBalanceCents),
        status:          newStatus as any,
        paidDate:        newStatus === 'PAID' ? new Date() : null,
      },
    })
    // Ledger: single source of financial truth
    await recordLedgerTx(tx, {
      direction:        'IN',
      amountCents,
      currency,
      categoryCode:     'PATIENT_PAYMENT',
      branchId:         invoice.branchId,
      recordedByUserId: session.user.id,
      refType:          'payment',
      refId:            created.id,
    })
    // Payment taken at the counter → close the linked visit and clear
    // the patient from the reception/payment queues (any remaining
    // balance stays tracked on the invoice)
    await closeVisitsForPaidInvoice(tx, id)
    return created
  })

  await prisma.auditLog.create({
    data: {
      userId:     session.user.id,
      patientId:  invoice.patientId,
      action:     'UPDATE',
      resource:   'payment',
      resourceId: id,
      details:    { amount, method, currency, newStatus },
    },
  })

  return NextResponse.json(payment, { status: 201 })
}

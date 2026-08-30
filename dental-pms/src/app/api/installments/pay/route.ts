import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { closeVisitsForPaidInvoice } from '@/lib/visit-sync'
import { fromCents } from '@/lib/money'
import { recordLedgerTx } from '@/lib/ledger'
import { can } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!can(session.user.role, 'billing.collect')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { installmentId, invoiceId, method } = await req.json()

  if (!installmentId || !invoiceId) {
    return NextResponse.json({ error: 'installmentId and invoiceId required' }, { status: 400 })
  }

  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    include: {
      plan: {
        include: {
          installments: true,
          invoice: {
            select: {
              id: true,
              visitInvoices: { select: { visit: { select: { doctorId: true } } } },
            },
          },
        },
      },
    },
  })

  if (!installment) return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
  if (installment.plan.invoiceId !== invoiceId) {
    return NextResponse.json({ error: 'Installment does not belong to this invoice' }, { status: 400 })
  }
  if (!installment.plan.invoice.visitInvoices.some(link => link.visit.doctorId === session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (installment.paidAt) return NextResponse.json({ error: 'Already paid' }, { status: 400 })

  const amountCents = installment.amountCents

  const result = await prisma.$transaction(async tx => {
    // Mark installment as paid
    const updated = await tx.installment.update({
      where: { id: installmentId },
      data:  {
        paidAt: new Date(),
        paymentMethod: method,
        paidAmountCents: amountCents,
        paidAmount: fromCents(amountCents), // legacy mirror
      },
    })

    // Record payment on invoice
    const payment = await tx.payment.create({
      data: {
        invoiceId,
        amountCents,
        amount:          fromCents(amountCents), // legacy mirror
        currency:        'LKR',
        method:          method ?? 'cash',
        notes:           `Installment ${installment.number} of ${installment.plan.numberOfInstallments}`,
        processedById:   session.user.id,
      },
    })

    // Update invoice balance (cents-authoritative)
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { amountPaidCents: true, totalCents: true, branchId: true },
    })
    if (invoice) {
      const newPaidCents    = invoice.amountPaidCents + amountCents
      const newBalanceCents = Math.max(0, invoice.totalCents - newPaidCents)
      await tx.invoice.update({
        where: { id: invoiceId },
        data:  {
          amountPaidCents: newPaidCents,
          balanceCents:    newBalanceCents,
          amountPaid:      fromCents(newPaidCents), // legacy mirrors
          balance:         fromCents(newBalanceCents),
          status:          newBalanceCents === 0 ? 'PAID' : 'PARTIAL',
          paidDate:        newBalanceCents === 0 ? new Date() : null,
        },
      })

      await recordLedgerTx(tx, {
        direction:        'IN',
        amountCents,
        categoryCode:     'PATIENT_PAYMENT',
        branchId:         invoice.branchId,
        recordedByUserId: session.user.id,
        refType:          'payment',
        refId:            payment.id,
        notes:            `Installment ${installment.number}/${installment.plan.numberOfInstallments}`,
      })

      // Installment collected at the counter → close the linked visit
      // and clear the patient from the queues (remaining installments
      // stay tracked on the invoice/plan)
      await closeVisitsForPaidInvoice(tx, invoiceId)
    }

    return updated
  })

  return NextResponse.json(result)
}

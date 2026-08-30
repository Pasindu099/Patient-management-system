import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

// GET /api/finance/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD&branchId=...
// Admin-only patient earnings report using the recorded payment amount.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId') || undefined
  const from = searchParams.get('from')
    ? new Date(searchParams.get('from')!)
    : new Date(new Date().setDate(new Date().getDate() - 30))
  const to = searchParams.get('to')
    ? new Date(searchParams.get('to')! + 'T23:59:59')
    : new Date()

  const payments = await prisma.payment.findMany({
    where: {
      paidAt: { gte: from, lte: to },
      ...(branchId ? { invoice: { branchId } } : {}),
    },
    select: {
      id: true,
      amountCents: true,
      currency: true,
      method: true,
      reference: true,
      notes: true,
      paidAt: true,
      invoice: {
        select: {
          invoiceNumber: true,
          branch: { select: { id: true, name: true } },
          patient: { select: { patientNumber: true, firstName: true, lastName: true, phone: true } },
          visitInvoices: {
            select: { visit: { select: { doctor: { select: { id: true, name: true } } } } },
            take: 1,
          },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
  })

  const rows = payments.map(payment => {
    const doctor = payment.invoice.visitInvoices[0]?.visit.doctor ?? null

    return {
      id: payment.id,
      paidAt: payment.paidAt.toISOString(),
      invoiceNumber: payment.invoice.invoiceNumber,
      patient: payment.invoice.patient,
      branch: payment.invoice.branch,
      doctor,
      method: payment.method,
      currency: payment.currency,
      actualCents: payment.amountCents,
      reportedCents: payment.amountCents,
      reference: payment.reference,
      notes: payment.notes,
    }
  })

  const totals = rows.reduce(
    (acc, row) => {
      acc.actualCents += row.actualCents
      acc.reportedCents += row.reportedCents
      if (row.method === 'cash') {
        acc.cashActualCents += row.actualCents
        acc.cashReportedCents += row.reportedCents
      } else {
        acc.nonCashCents += row.actualCents
      }
      return acc
    },
    {
      actualCents: 0,
      reportedCents: 0,
      cashActualCents: 0,
      cashReportedCents: 0,
      nonCashCents: 0,
    }
  )

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    totals,
    actualReport: rows.map(row => ({ ...row, reportCents: row.actualCents })),
    reportedReport: rows.map(row => ({ ...row, reportCents: row.reportedCents })),
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

// GET /api/finance/debtors — patients with outstanding invoice balances,
// largest debt first. Amounts in integer cents.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = new URL(req.url).searchParams
  const branchId = sp.get('branchId') || undefined

  const invoices = await prisma.invoice.findMany({
    where: {
      balanceCents: { gt: 0 },
      status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
      ...(branchId ? { branchId } : {}),
    },
    select: {
      id: true, invoiceNumber: true, balanceCents: true, totalCents: true, createdAt: true, dueDate: true,
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, phone: true } },
      installmentPlan: { select: { numberOfInstallments: true, installments: { select: { paidAt: true } } } },
    },
    orderBy: { balanceCents: 'desc' },
  })

  // Group per patient
  const byPatient: Record<string, any> = {}
  for (const inv of invoices) {
    const p = inv.patient
    byPatient[p.id] ??= { patient: p, balanceCents: 0, invoices: [] }
    byPatient[p.id].balanceCents += inv.balanceCents
    byPatient[p.id].invoices.push({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      balanceCents: inv.balanceCents,
      totalCents: inv.totalCents,
      createdAt: inv.createdAt,
      dueDate: inv.dueDate,
      installments: inv.installmentPlan
        ? { total: inv.installmentPlan.numberOfInstallments, paid: inv.installmentPlan.installments.filter(i => i.paidAt).length }
        : null,
    })
  }

  const debtors = Object.values(byPatient).sort((a: any, b: any) => b.balanceCents - a.balanceCents)
  return NextResponse.json(debtors)
}

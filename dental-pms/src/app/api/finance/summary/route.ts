import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { authenticateServiceAccount, hasScope } from '@/lib/service-auth'

// GET /api/finance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&branchId=...
// Returns daily collections (per branch + per doctor), expense totals per
// category, and profit per branch, all in integer cents.
export async function GET(req: NextRequest) {
  const session = await auth()
  const isAdmin = session && can(session.user.role, 'finance.admin')

  const agent = !isAdmin ? await authenticateServiceAccount(req) : null
  if (!isAdmin && !(agent && hasScope(agent, 'finance:read'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId') || undefined
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(new Date().setDate(new Date().getDate() - 30))
  const to   = searchParams.get('to')   ? new Date(searchParams.get('to')! + 'T23:59:59') : new Date()

  const txWhere = { date: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) }

  const [transactions, branches] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: txWhere,
      include: { category: { select: { code: true, name: true } }, branch: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
  ])

  // Daily collections per branch (IN) and expenses (OUT)
  const daily: Record<string, { date: string; inCents: number; outCents: number; byBranch: Record<string, number> }> = {}
  const byCategory: Record<string, { name: string; direction: string; cents: number }> = {}
  const byBranch: Record<string, { name: string; inCents: number; outCents: number }> = {}
  for (const b of branches) byBranch[b.id] = { name: b.name, inCents: 0, outCents: 0 }
  byBranch['none'] = { name: 'No branch', inCents: 0, outCents: 0 }

  for (const t of transactions) {
    const day = t.date.toISOString().slice(0, 10)
    daily[day] ??= { date: day, inCents: 0, outCents: 0, byBranch: {} }
    const bKey = t.branchId ?? 'none'
    byBranch[bKey] ??= { name: t.branch?.name ?? 'No branch', inCents: 0, outCents: 0 }
    if (t.direction === 'IN') {
      daily[day].inCents += t.amountCents
      daily[day].byBranch[bKey] = (daily[day].byBranch[bKey] ?? 0) + t.amountCents
      byBranch[bKey].inCents += t.amountCents
    } else {
      daily[day].outCents += t.amountCents
      byBranch[bKey].outCents += t.amountCents
    }
    byCategory[t.category.code] ??= { name: t.category.name, direction: t.direction, cents: 0 }
    byCategory[t.category.code].cents += t.amountCents
  }

  // Collections per doctor: payments joined to visits via invoice link
  const payments = await prisma.payment.findMany({
    where: {
      paidAt: { gte: from, lte: to },
      ...(branchId ? { invoice: { branchId } } : {}),
    },
    select: {
      amountCents: true,
      invoice: {
        select: {
          visitInvoices: {
            select: { visit: { select: { doctor: { select: { id: true, name: true } } } } },
          },
        },
      },
    },
  })
  const byDoctor: Record<string, { name: string; cents: number }> = {}
  for (const p of payments) {
    const doc = p.invoice.visitInvoices[0]?.visit.doctor
    const key = doc?.id ?? 'unassigned'
    byDoctor[key] ??= { name: doc?.name ?? 'No doctor linked', cents: 0 }
    byDoctor[key].cents += p.amountCents
  }

  const totalIn  = transactions.filter(t => t.direction === 'IN').reduce((s, t) => s + t.amountCents, 0)
  const totalOut = transactions.filter(t => t.direction === 'OUT').reduce((s, t) => s + t.amountCents, 0)

  return NextResponse.json({
    from: from.toISOString(), to: to.toISOString(),
    totals: { inCents: totalIn, outCents: totalOut, profitCents: totalIn - totalOut },
    daily: Object.values(daily),
    byBranch: Object.entries(byBranch)
      .filter(([, v]) => v.inCents > 0 || v.outCents > 0)
      .map(([id, v]) => ({ branchId: id, ...v, profitCents: v.inCents - v.outCents })),
    byDoctor: Object.entries(byDoctor).map(([id, v]) => ({ doctorId: id, ...v })),
    byCategory: Object.entries(byCategory).map(([code, v]) => ({ code, ...v })),
  })
}

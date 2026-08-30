import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  // This payload is entirely clinic-wide money (revenue, AR aging, per-branch
  // collections). It was reachable by any logged-in user before the KPI work.
  if (!can(session.user.role, 'money.aggregate')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const period   = searchParams.get('period')   ?? 'month'   // week | month | quarter | year
  const branchId = searchParams.get('branchId') ?? ''

  const now   = new Date()
  const start = new Date(now)

  if (period === 'week') {
    start.setDate(now.getDate() - 7)
  } else if (period === 'month') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  } else if (period === 'quarter') {
    start.setMonth(now.getMonth() - 3, 1)
    start.setHours(0, 0, 0, 0)
  } else {
    start.setMonth(0, 1)
    start.setHours(0, 0, 0, 0)
  }

  const branchFilter: { branchId?: string } = branchId ? { branchId } : {}
  const apptFilter   = { ...branchFilter, startTime: { gte: start, lte: now } }
  const invoiceFilter = {
    ...branchFilter,
    createdAt: { gte: start, lte: now },
  }

  // ── REVENUE ─────────────────────────────────────────────────────
  const [invoicesLKR, invoicesUSD, payments] = await Promise.all([
    prisma.invoice.aggregate({
      where: { ...invoiceFilter, currency: 'LKR', status: { notIn: ['DRAFT', 'CANCELLED', 'WRITTEN_OFF'] } },
      _sum:   { total: true, amountPaid: true, balance: true },
      _count: { id: true },
    }),
    prisma.invoice.aggregate({
      where: { ...invoiceFilter, currency: 'USD', status: { notIn: ['DRAFT', 'CANCELLED', 'WRITTEN_OFF'] } },
      _sum:   { total: true, amountPaid: true },
      _count: { id: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: start, lte: now }, invoice: branchId ? { branchId } : undefined },
      select: { amount: true, currency: true, method: true, paidAt: true },
    }),
  ])

  // Daily revenue for chart
  const dailyRevenue = buildDailyRevenue(payments, start, now)

  // Payment method breakdown
  const methodBreakdown = payments.reduce((acc, p) => {
    const key = p.method
    acc[key] = (acc[key] ?? 0) + p.amount
    return acc
  }, {} as Record<string, number>)

  // ── APPOINTMENTS ────────────────────────────────────────────────
  const [
    totalAppts,
    completedAppts,
    cancelledAppts,
    noShowAppts,
    walkInAppts,
  ] = await Promise.all([
    prisma.appointment.count({ where: apptFilter }),
    prisma.appointment.count({ where: { ...apptFilter, status: 'COMPLETED' } }),
    prisma.appointment.count({ where: { ...apptFilter, status: 'CANCELLED' } }),
    prisma.appointment.count({ where: { ...apptFilter, status: 'NO_SHOW' } }),
    prisma.appointment.count({ where: { ...apptFilter, bookingSource: 'WALKIN' } }),
  ])

  // Booking source breakdown
  const bookingSourceData = await prisma.appointment.groupBy({
    by: ['bookingSource'],
    where: apptFilter,
    _count: { id: true },
  })

  // Appointment type breakdown
  const apptTypeData = await prisma.appointment.groupBy({
    by: ['type'],
    where: apptFilter,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  })

  // Daily appointments for chart
  const dailyAppts = await buildDailyAppointments(start, now, branchFilter)

  // ── PROVIDER PERFORMANCE ────────────────────────────────────────
  const providerStats = await prisma.appointment.groupBy({
    by: ['providerId'],
    where: { ...apptFilter, status: 'COMPLETED' },
    _count: { id: true },
  })

  const providerDetails = await prisma.user.findMany({
    where: { id: { in: providerStats.map(p => p.providerId) } },
    select: { id: true, name: true, role: true },
  })

  const providers = providerStats.map(p => ({
    ...p,
    provider: providerDetails.find(d => d.id === p.providerId),
  })).sort((a, b) => b._count.id - a._count.id)

  // ── PATIENTS ────────────────────────────────────────────────────
  const [newPatients, totalPatients] = await Promise.all([
    prisma.patient.count({
      where: { createdAt: { gte: start, lte: now }, isActive: true, deletedAt: null },
    }),
    prisma.patient.count({ where: { isActive: true, deletedAt: null } }),
  ])

  // ── AR AGING ────────────────────────────────────────────────────
  const allOutstanding = await prisma.invoice.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
      balance: { gt: 0 },
    },
    select: { balance: true, currency: true, createdAt: true, dueDate: true },
  })

  const aging = { current: 0, days30: 0, days60: 0, days90plus: 0 }
  allOutstanding.forEach(inv => {
    const refDate  = inv.dueDate ?? inv.createdAt
    const daysOld  = Math.floor((now.getTime() - new Date(refDate).getTime()) / 86400000)
    const amountLKR = inv.currency === 'USD' ? inv.balance * 320 : inv.balance
    if (daysOld <= 0)       aging.current   += amountLKR
    else if (daysOld <= 30) aging.days30     += amountLKR
    else if (daysOld <= 60) aging.days60     += amountLKR
    else                    aging.days90plus += amountLKR
  })

  // ── BRANCH COMPARISON ───────────────────────────────────────────
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })

  const branchComparison = await Promise.all(
    branches.map(async branch => {
      const [appts, revenue] = await Promise.all([
        prisma.appointment.count({
          where: { branchId: branch.id, startTime: { gte: start, lte: now }, status: 'COMPLETED' },
        }),
        prisma.invoice.aggregate({
          where: {
            branchId: branch.id,
            createdAt: { gte: start, lte: now },
            currency:  'LKR',
            status:    { notIn: ['DRAFT', 'CANCELLED', 'WRITTEN_OFF'] },
          },
          _sum: { amountPaid: true },
        }),
      ])
      return {
        branch:      branch.name,
        appointments: appts,
        revenue:     revenue._sum.amountPaid ?? 0,
      }
    })
  )

  // ── RECALL STATUS ───────────────────────────────────────────────
  const [overdueRecalls, dueThisMonth] = await Promise.all([
    prisma.recall.count({ where: { isDone: false, dueDate: { lt: now } } }),
    prisma.recall.count({
      where: {
        isDone: false,
        dueDate: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
          lte: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        },
      },
    }),
  ])

  return NextResponse.json({
    period,
    dateRange: { start: start.toISOString(), end: now.toISOString() },
    revenue: {
      lkr:             invoicesLKR._sum.total      ?? 0,
      lkrCollected:    invoicesLKR._sum.amountPaid ?? 0,
      lkrOutstanding:  invoicesLKR._sum.balance    ?? 0,
      usd:             invoicesUSD._sum.total      ?? 0,
      usdCollected:    invoicesUSD._sum.amountPaid ?? 0,
      invoiceCount:    invoicesLKR._count.id + invoicesUSD._count.id,
      methodBreakdown,
      daily:           dailyRevenue,
    },
    appointments: {
      total:       totalAppts,
      completed:   completedAppts,
      cancelled:   cancelledAppts,
      noShow:      noShowAppts,
      walkIn:      walkInAppts,
      fillRate:    totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : 0,
      noShowRate:  totalAppts > 0 ? Math.round((noShowAppts   / totalAppts) * 100) : 0,
      bySource:    bookingSourceData,
      byType:      apptTypeData.slice(0, 6),
      daily:       dailyAppts,
    },
    providers,
    patients: { new: newPatients, total: totalPatients },
    aging,
    branchComparison,
    recalls: { overdue: overdueRecalls, dueThisMonth },
  })
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function buildDailyRevenue(
  payments: { amount: number; currency: string; paidAt: Date }[],
  start: Date,
  end:   Date
): { date: string; lkr: number; usd: number }[] {
  const days: Record<string, { lkr: number; usd: number }> = {}

  const cursor = new Date(start)
  while (cursor <= end) {
    days[cursor.toISOString().split('T')[0]] = { lkr: 0, usd: 0 }
    cursor.setDate(cursor.getDate() + 1)
  }

  payments.forEach(p => {
    const key = new Date(p.paidAt).toISOString().split('T')[0]
    if (days[key]) {
      if (p.currency === 'USD') days[key].usd += p.amount
      else                      days[key].lkr += p.amount
    }
  })

  return Object.entries(days).map(([date, v]) => ({ date, ...v }))
}

async function buildDailyAppointments(
  start:        Date,
  end:          Date,
  branchFilter: { branchId?: string }
): Promise<{ date: string; total: number; completed: number }[]> {
  const appts = await prisma.appointment.findMany({
    where: { ...branchFilter, startTime: { gte: start, lte: end } },
    select: { startTime: true, status: true },
  })

  const days: Record<string, { total: number; completed: number }> = {}
  const cursor = new Date(start)
  while (cursor <= end) {
    days[cursor.toISOString().split('T')[0]] = { total: 0, completed: 0 }
    cursor.setDate(cursor.getDate() + 1)
  }

  appts.forEach(a => {
    const key = new Date(a.startTime).toISOString().split('T')[0]
    if (days[key]) {
      days[key].total++
      if (a.status === 'COMPLETED') days[key].completed++
    }
  })

  return Object.entries(days).map(([date, v]) => ({ date, ...v }))
}

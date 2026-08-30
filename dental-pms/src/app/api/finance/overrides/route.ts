import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

// GET /api/finance/overrides?from&to — list-price vs charged differences,
// grouped per doctor. Amounts in integer cents.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = new URL(req.url).searchParams
  const where: any = {}
  if (sp.get('from') || sp.get('to')) {
    where.createdAt = {}
    if (sp.get('from')) where.createdAt.gte = new Date(sp.get('from')!)
    if (sp.get('to'))   where.createdAt.lte = new Date(sp.get('to')! + 'T23:59:59')
  }

  const overrides = await prisma.billOverride.findMany({
    where,
    include: {
      visit: {
        select: {
          visitNumber: true, visitDate: true,
          patient: { select: { firstName: true, lastName: true, patientNumber: true } },
          doctor:  { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const byDoctor: Record<string, { name: string; count: number; differenceCents: number }> = {}
  for (const o of overrides) {
    const d = o.visit.doctor
    byDoctor[d.id] ??= { name: d.name, count: 0, differenceCents: 0 }
    byDoctor[d.id].count += 1
    byDoctor[d.id].differenceCents += o.listPriceCents - o.chargedCents
  }

  return NextResponse.json({
    overrides,
    byDoctor: Object.entries(byDoctor).map(([id, v]) => ({ doctorId: id, ...v })),
  })
}

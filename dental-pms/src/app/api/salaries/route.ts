import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { toCents } from '@/lib/money'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const sp = new URL(req.url).searchParams
  const where: any = {}
  if (sp.get('userId')) where.userId = sp.get('userId')
  if (sp.get('year')) where.periodYear = Number(sp.get('year'))

  const records = await prisma.salaryRecord.findMany({
    where,
    include: { user: { select: { name: true, role: true } } },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
  })
  return NextResponse.json(records)
}

const schema = z.object({
  userId:      z.string().min(1),
  periodYear:  z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
  base:        z.number().min(0),        // rupees at the API boundary
  allowances:  z.number().min(0).default(0),
  deductions:  z.number().min(0).default(0),
  notes:       z.string().optional().nullable(),
})

// POST — create a period's salary record (simple record, not payroll processing)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data

  const baseCents       = toCents(d.base)
  const allowancesCents = toCents(d.allowances)
  const deductionsCents = toCents(d.deductions)
  const netCents        = baseCents + allowancesCents - deductionsCents

  try {
    const record = await prisma.salaryRecord.create({
      data: {
        userId: d.userId, periodYear: d.periodYear, periodMonth: d.periodMonth,
        baseCents, allowancesCents, deductionsCents, netCents,
        notes: d.notes || null,
      },
    })
    return NextResponse.json(record, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'A salary record already exists for this staff member and month' }, { status: 409 })
    }
    throw e
  }
}

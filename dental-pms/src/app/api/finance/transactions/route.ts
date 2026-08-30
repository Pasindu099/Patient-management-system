import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

// GET /api/finance/transactions?from&to&branchId&category&direction&limit
// Raw ledger listing, newest first. Amounts in integer cents.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = new URL(req.url).searchParams
  const where: any = {}
  if (sp.get('branchId'))  where.branchId = sp.get('branchId')
  if (sp.get('direction')) where.direction = sp.get('direction')
  if (sp.get('category'))  where.category = { code: sp.get('category') }
  if (sp.get('from') || sp.get('to')) {
    where.date = {}
    if (sp.get('from')) where.date.gte = new Date(sp.get('from')!)
    if (sp.get('to'))   where.date.lte = new Date(sp.get('to')! + 'T23:59:59')
  }

  const transactions = await prisma.financialTransaction.findMany({
    where,
    include: {
      category: { select: { code: true, name: true, direction: true } },
      branch:   { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: Math.min(Number(sp.get('limit')) || 200, 500),
  })

  return NextResponse.json(transactions)
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { toCents } from '@/lib/money'
import { recordLedgerTx, LedgerCategoryCode } from '@/lib/ledger'
import { z } from 'zod'

const EXPENSE_CATEGORIES = ['SALARY', 'RENT', 'LAB_FEE', 'SUPPLIES', 'OTHER_EXPENSE', 'REFUND'] as const

const schema = z.object({
  amount:   z.number().positive(),               // rupees at the API boundary
  category: z.enum(EXPENSE_CATEGORIES),
  branchId: z.string().min(1),
  date:     z.string().optional(),               // YYYY-MM-DD, default today
  notes:    z.string().optional().nullable(),
})

// POST /api/finance/expenses — simple expense entry (rent, lab fees, supplies…)
// Writes an OUT row to the ledger; this is the only way expenses enter the system.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  const tx = await recordLedgerTx(prisma, {
    direction:        'OUT',
    amountCents:      toCents(d.amount),
    categoryCode:     d.category as LedgerCategoryCode,
    branchId:         d.branchId,
    recordedByUserId: session.user.id,
    refType:          'expense',
    notes:            d.notes ?? null,
    date:             d.date ? new Date(d.date) : new Date(),
  })

  await prisma.auditLog.create({
    data: {
      userId:     session.user.id,
      action:     'CREATE',
      resource:   'expense',
      resourceId: tx?.id,
      details:    { amountCents: toCents(d.amount), category: d.category, branchId: d.branchId },
    },
  })

  return NextResponse.json(tx, { status: 201 })
}

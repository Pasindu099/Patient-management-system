import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { recordLedgerTx } from '@/lib/ledger'
import { z } from 'zod'

const schema = z.object({ branchId: z.string().min(1) })

// POST /api/salaries/[id]/pay — marking a salary paid writes a ledger
// transaction (OUT/SALARY). This is the only way a SalaryRecord affects
// the books.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'branchId required' }, { status: 400 })

  const record = await prisma.salaryRecord.findUnique({ where: { id } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (record.paidAt) return NextResponse.json({ error: 'Already paid' }, { status: 400 })

  const updated = await prisma.$transaction(async tx => {
    const txRow = await recordLedgerTx(tx, {
      direction: 'OUT',
      amountCents: record.netCents,
      categoryCode: 'SALARY',
      branchId: parsed.data.branchId,
      recordedByUserId: session.user.id,
      refType: 'salary_record',
      refId: record.id,
    })
    return tx.salaryRecord.update({
      where: { id },
      data: { paidAt: new Date(), ledgerTxId: txRow?.id ?? null },
    })
  })

  return NextResponse.json(updated)
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { toCents } from '@/lib/money'
import { z } from 'zod'

const schema = z.object({
  title: z.string().trim().min(1).optional(),
  baseSalary: z.number().min(0),
  startDate: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, isActive: true } })
  if (!user || !user.isActive) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : new Date()
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
  }

  const contract = await prisma.$transaction(async tx => {
    await tx.staffContract.updateMany({
      where: { userId: id, endDate: null },
      data: { endDate: startDate },
    })

    return tx.staffContract.create({
      data: {
        userId: id,
        title: parsed.data.title || 'Fixed monthly salary',
        startDate,
        baseSalaryCents: toCents(parsed.data.baseSalary),
        notes: parsed.data.notes || null,
      },
    })
  })

  return NextResponse.json(contract, { status: 201 })
}

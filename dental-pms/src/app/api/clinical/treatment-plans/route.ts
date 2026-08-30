import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { toCents, fromCents } from '@/lib/money'

const itemSchema = z.object({
  procedureName: z.string().min(1),
  toothNumbers:  z.string().optional(),
  fee:           z.number().min(0),
  currency:      z.enum(['LKR', 'USD']).default('LKR'),
  status:        z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'REFERRED']).default('PLANNED'),
  phase:         z.number().int().min(1).default(1),
  sequence:      z.number().int().min(1).default(1),
})

const schema = z.object({
  patientId: z.string().min(1),
  title:     z.string().min(1),
  currency:  z.enum(['LKR', 'USD']).default('LKR'),
  items:     z.array(itemSchema).min(1),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  const totalFeeCents = d.items.reduce((s, i) => s + toCents(i.fee), 0)

  const plan = await prisma.treatmentPlan.create({
    data: {
      patientId:   d.patientId,
      createdById: session.user.id,
      title:       d.title,
      currency:    d.currency,
      totalFeeCents,
      patientPortionCents: totalFeeCents,
      totalFee: fromCents(totalFeeCents), // legacy mirrors
      patientPortion: fromCents(totalFeeCents),
      status:      'PLANNED',
      items: {
        create: d.items.map((item, idx) => ({
          procedureName: item.procedureName,
          toothNumbers:  item.toothNumbers || null,
          feeCents:        toCents(item.fee),
          patientEstCents: toCents(item.fee),
          fee:           item.fee,
          currency:      item.currency,
          patientEst:    item.fee,
          status:        item.status,
          phase:         item.phase,
          sequence:      idx + 1,
        })),
      },
    },
    include: { items: true },
  })

  return NextResponse.json(plan, { status: 201 })
}

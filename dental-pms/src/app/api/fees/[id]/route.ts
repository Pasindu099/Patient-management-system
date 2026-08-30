import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { setTreatmentPrice } from '@/lib/prices'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!can(session.user.role, 'settings.admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const { price } = await req.json()
  const priceCents = Math.round((parseFloat(price) || 0) * 100)

  // Effective-dated: append to history, update the current-price mirror
  const fee = await setTreatmentPrice(prisma, id, priceCents, session.user.id)

  await prisma.auditLog.create({
    data: {
      userId:     session.user.id,
      action:     'UPDATE',
      resource:   'treatment_fee_price',
      resourceId: id,
      details:    { priceCents },
    },
  })

  return NextResponse.json(fee)
}

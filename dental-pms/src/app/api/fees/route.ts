import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const fees = await prisma.treatmentFee.findMany({
    where:   { isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  return NextResponse.json(fees)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const category = String(body.category ?? '').trim()
  const subcategory = String(body.subcategory ?? '').trim() || null
  const name = String(body.name ?? '').trim()
  const price = Number(body.price ?? 0)

  if (!category || !name) {
    return NextResponse.json({ error: 'Category and treatment name are required' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'Price must be a valid positive amount' }, { status: 400 })
  }

  const existing = await prisma.treatmentFee.findFirst({
    where: {
      category: { equals: category, mode: 'insensitive' },
      name:     { equals: name, mode: 'insensitive' },
      isActive: true,
    },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: 'That treatment already exists in this category' }, { status: 409 })
  }

  const priceCents = Math.round(price * 100)
  const sort = await prisma.treatmentFee.aggregate({
    where: { category },
    _max:  { sortOrder: true },
  })

  const fee = await prisma.$transaction(async tx => {
    const created = await tx.treatmentFee.create({
      data: {
        category,
        subcategory,
        name,
        price,
        priceCents,
        sortOrder: (sort._max.sortOrder ?? 0) + 1,
        isActive: true,
      },
    })

    await tx.treatmentPriceHistory.create({
      data: {
        feeId: created.id,
        priceCents,
        setByUserId: session.user.id,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        resource: 'treatment_fee',
        resourceId: created.id,
        details: { category, subcategory, name, priceCents },
      },
    })

    return created
  })

  return NextResponse.json(fee, { status: 201 })
}

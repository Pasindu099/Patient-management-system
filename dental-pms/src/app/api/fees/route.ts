import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const fees = await prisma.treatmentFee.findMany({
    where:   { isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  return NextResponse.json(fees)
}

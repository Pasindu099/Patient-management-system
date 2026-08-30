import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { z } from 'zod'

export async function GET() {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const suppliers = await prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  return NextResponse.json(suppliers)
}

const schema = z.object({
  name:  z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'finance.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const supplier = await prisma.supplier.create({ data: parsed.data })
  return NextResponse.json(supplier, { status: 201 })
}

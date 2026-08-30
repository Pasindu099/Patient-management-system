import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { can } from '@/lib/permissions'

const schema = z.object({
  name:    z.string().min(1, 'Branch name is required'),
  address: z.string().optional(),
  city:    z.string().optional(),
  phone:   z.string().optional(),
  email:   z.string().email().optional().or(z.literal('')),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const branches = await prisma.branch.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { appointments: true } } },
  })
  return NextResponse.json(branches)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }
  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const branch = await prisma.branch.create({ data: { ...parsed.data, email: parsed.data.email || null } })
  return NextResponse.json(branch, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }
  const body = await req.json()
  const { id, ...data } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const branch = await prisma.branch.update({
    where: { id },
    data:  { ...data, ...(('email' in data) ? { email: data.email || null } : {}) },
  })
  return NextResponse.json(branch)
}

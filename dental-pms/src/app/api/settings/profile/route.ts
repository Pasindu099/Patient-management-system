import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  name:        z.string().min(1).optional(),
  phone:       z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword:     z.string().min(8).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, phone, currentPassword, newPassword } = parsed.data
  const updateData: any = {}

  if (name)  updateData.name  = name
  if (phone !== undefined) updateData.phone = phone || null

  // Password change
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required to set a new password' }, { status: 400 })
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true } })
    const valid = user ? await bcrypt.compare(currentPassword, user.password) : false
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }
    updateData.password = await bcrypt.hash(newPassword, 12)
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data:  updateData,
    select: { id: true, name: true, email: true, phone: true, role: true },
  })

  return NextResponse.json(updated)
}

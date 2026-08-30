import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { doctorId, dayOfWeek, startTime, enable } = await req.json()

  // Only admin or the doctor themselves can manage their slots
  if (!can(session.user.role, 'settings.admin') && session.user.id !== doctorId) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  if (enable) {
    const slot = await prisma.onlineSlot.upsert({
      where:  { doctorId_dayOfWeek_startTime: { doctorId, dayOfWeek, startTime } },
      update: { isActive: true },
      create: { doctorId, dayOfWeek, startTime, isActive: true },
    })
    return NextResponse.json(slot)
  } else {
    await prisma.onlineSlot.deleteMany({
      where: { doctorId, dayOfWeek, startTime },
    })
    return NextResponse.json({ deleted: true })
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const doctorId = searchParams.get('doctorId')

  const slots = await prisma.onlineSlot.findMany({
    where: { ...(doctorId ? { doctorId } : {}), isActive: true },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })

  return NextResponse.json(slots)
}

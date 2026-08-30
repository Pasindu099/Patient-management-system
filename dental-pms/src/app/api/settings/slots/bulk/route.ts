import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

// POST — copy a day's slots to multiple days
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { doctorId, times, toDays } = await req.json()

  if (!can(session.user.role, 'settings.admin') && session.user.id !== doctorId) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  // Build all combinations
  const creates: { doctorId: string; dayOfWeek: string; startTime: string; isActive: boolean }[] = []
  for (const day of toDays) {
    for (const time of times) {
      creates.push({ doctorId, dayOfWeek: day, startTime: time, isActive: true })
    }
  }

  // Delete existing for these days and recreate
  await prisma.onlineSlot.deleteMany({
    where: { doctorId, dayOfWeek: { in: toDays } },
  })

  await prisma.onlineSlot.createMany({ data: creates, skipDuplicates: true })

  return NextResponse.json({ created: creates.length })
}

// DELETE — clear all slots for a doctor
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { doctorId } = await req.json()

  if (!can(session.user.role, 'settings.admin') && session.user.id !== doctorId) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  await prisma.onlineSlot.deleteMany({ where: { doctorId } })

  return NextResponse.json({ deleted: true })
}

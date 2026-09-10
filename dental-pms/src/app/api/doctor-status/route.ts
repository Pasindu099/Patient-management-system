import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDoctorRole } from '@/lib/permissions'
import { getEffectiveDoctorStatus } from '@/lib/doctor-status'

const statusSchema = z.object({
  status: z.enum(['READY', 'SHORT_BREAK', 'UNAVAILABLE', 'SESSION_ENDED']),
  branchId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const branchId = new URL(req.url).searchParams.get('branchId')
  const whereDoctor: any = { isActive: true, role: 'DOCTOR' }
  const doctors = await prisma.user.findMany({
    where: whereDoctor,
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  })

  const rows = await Promise.all(doctors.map(async doctor => {
    const status = await getEffectiveDoctorStatus(prisma, doctor.id)
    if (branchId && status?.branchId && status.branchId !== branchId) {
      return {
        id: doctor.id,
        name: doctor.name,
        status: 'NOT_STARTED',
        statusChangedAt: null,
        note: null,
      }
    }
    return {
      id: doctor.id,
      name: doctor.name,
      status: status?.status ?? 'NOT_STARTED',
      statusChangedAt: status?.createdAt ?? null,
      note: status?.note ?? null,
    }
  }))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!isDoctorRole(session.user.role)) {
    return NextResponse.json({ error: 'Doctor only' }, { status: 403 })
  }

  const parsed = statusSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  const event = await prisma.doctorStatusEvent.create({
    data: {
      doctorId: session.user.id,
      branchId: parsed.data.branchId || null,
      status: parsed.data.status,
      note: parsed.data.note || null,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'UPDATE',
      resource: 'doctor_status',
      resourceId: event.id,
      details: { status: event.status, branchId: event.branchId },
    },
  })

  return NextResponse.json(event, { status: 201 })
}

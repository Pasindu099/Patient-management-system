import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { getOrCreateSession, sessionUsage, rosteredDoctors } from '@/lib/sessions'
import { z } from 'zod'

// GET /api/sessions?branchId&date=YYYY-MM-DD
// Both sessions for a branch day, materialized, with capacity usage and
// the rostered doctors for each.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const branchId = sp.get('branchId')
  const dateStr  = sp.get('date')
  if (!branchId || !dateStr) {
    return NextResponse.json({ error: 'branchId and date are required' }, { status: 400 })
  }
  const date = new Date(dateStr + 'T12:00:00')

  const result = []
  for (const period of ['MORNING', 'EVENING'] as const) {
    const s = await getOrCreateSession(prisma, branchId, date, period)
    const [usage, doctors] = await Promise.all([
      sessionUsage(prisma, s.id),
      rosteredDoctors(prisma, branchId, date, period),
    ])
    result.push({
      ...s,
      usage,
      onlineRemaining:      Math.max(0, s.onlineCapacity - usage.online),
      appointmentRemaining: Math.max(0, s.appointmentCapacity - usage.appointment),
      doctors: doctors.map(d => d.doctor),
    })
  }
  return NextResponse.json(result)
}

const patchSchema = z.object({
  sessionId:           z.string().min(1),
  onlineCapacity:      z.number().int().min(0).optional(),
  appointmentCapacity: z.number().int().min(0).optional(),
  isOpen:              z.boolean().optional(),
})

// PATCH /api/sessions — adjust one session's capacities (admin only)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  const { sessionId, ...data } = parsed.data

  const updated = await prisma.clinicSession.update({ where: { id: sessionId }, data })

  await prisma.auditLog.create({
    data: {
      userId:   session.user.id,
      action:   'UPDATE',
      resource: 'clinic_session',
      resourceId: sessionId,
      details:  data,
    },
  })

  return NextResponse.json(updated)
}

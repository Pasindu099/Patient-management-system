import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { z } from 'zod'

// GET /api/roster?branchId — the weekly doctor roster
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const where: any = { isActive: true }
  if (sp.get('branchId')) where.branchId = sp.get('branchId')
  if (sp.get('doctorId')) where.doctorId = sp.get('doctorId')

  const roster = await prisma.doctorBranchAvailability.findMany({
    where,
    include: {
      doctor: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: [{ weekday: 'asc' }, { period: 'asc' }],
  })
  return NextResponse.json(roster)
}

const setSchema = z.object({
  doctorId: z.string().min(1),
  branchId: z.string().min(1),
  weekday:  z.number().int().min(0).max(6),
  period:   z.enum(['MORNING', 'EVENING']),
  enabled:  z.boolean(),
})

// POST /api/roster — toggle one roster cell (admin only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = setSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  const { doctorId, branchId, weekday, period, enabled } = parsed.data

  // A session can hold at most one doctor per chair — refuse to overbook it
  if (enabled) {
    const branch = await prisma.branch.findUnique({
      where:  { id: branchId },
      select: { name: true, chairCount: true },
    })
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })

    const assigned = await prisma.doctorBranchAvailability.count({
      where: { branchId, weekday, period, isActive: true, doctorId: { not: doctorId } },
    })
    if (assigned >= branch.chairCount) {
      return NextResponse.json({
        error: `${branch.name} has only ${branch.chairCount} chair${branch.chairCount === 1 ? '' : 's'}, `
             + `and this session already has ${assigned} doctor${assigned === 1 ? '' : 's'}. `
             + 'Free a chair or raise the chair count first.',
      }, { status: 409 })
    }
  }

  const key = { doctorId_branchId_weekday_period: { doctorId, branchId, weekday, period } }
  const entry = enabled
    ? await prisma.doctorBranchAvailability.upsert({
        where: key,
        update: { isActive: true },
        create: { doctorId, branchId, weekday, period },
      })
    : await prisma.doctorBranchAvailability.updateMany({
        where: { doctorId, branchId, weekday, period },
        data: { isActive: false },
      })

  await prisma.auditLog.create({
    data: {
      userId:   session.user.id,
      action:   'UPDATE',
      resource: 'doctor_roster',
      details:  { doctorId, branchId, weekday, period, enabled },
    },
  })

  return NextResponse.json(entry)
}

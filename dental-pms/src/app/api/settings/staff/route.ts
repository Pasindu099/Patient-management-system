import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { can } from '@/lib/permissions'

const createSchema = z.object({
  name:      z.string().min(1),
  email:     z.string().email(),
  password:  z.string().min(8, 'Password must be at least 8 characters'),
  role:      z.enum(['ADMIN','DOCTOR','HEAD_NURSE','NURSE','RECEPTIONIST']),
  phone:     z.string().optional(),
  branchIds: z.array(z.string()).default([]),
})

const updateSchema = z.object({
  id:        z.string(),
  name:      z.string().min(1).optional(),
  phone:     z.string().optional(),
  role:      z.enum(['ADMIN','DOCTOR','HEAD_NURSE','NURSE','RECEPTIONIST']).optional(),
  isActive:  z.boolean().optional(),
  password:  z.string().min(8).optional(),
  branchIds: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const body   = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data

  const existing = await prisma.user.findUnique({ where: { email: d.email } })
  if (existing) return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })

  const hashed = await bcrypt.hash(d.password, 12)

  const user = await prisma.user.create({
    data: {
      name:     d.name,
      email:    d.email,
      password: hashed,
      role:     d.role,
      phone:    d.phone || null,
      branches: {
        create: d.branchIds.map((branchId, i) => ({
          branchId,
          isPrimary: i === 0,
        })),
      },
    },
    select: { id: true, name: true, email: true, role: true, phone: true, isActive: true },
  })

  return NextResponse.json(user, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const body   = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { id, branchIds, password, ...rest } = parsed.data

  const updateData: any = { ...rest }
  if (password) updateData.password = await bcrypt.hash(password, 12)

  const user = await prisma.user.update({
    where: { id },
    data:  updateData,
    select: { id: true, name: true, email: true, role: true, phone: true, isActive: true },
  })

  // Update branch assignments if provided
  if (branchIds !== undefined) {
    await prisma.userBranch.deleteMany({ where: { userId: id } })
    if (branchIds.length > 0) {
      await prisma.userBranch.createMany({
        data: branchIds.map((branchId, i) => ({ userId: id, branchId, isPrimary: i === 0 })),
      })
    }
  }

  return NextResponse.json(user)
}

/**
 * Permanently delete a staff account.
 *
 * Only accounts with no clinical or financial footprint can be removed — anyone
 * who has treated a patient, raised an invoice or has payroll history must be
 * deactivated instead, so the records stay attributable.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing user id' }, { status: 400 })

  if (id === session.user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where:  { id },
    select: { id: true, name: true, email: true, role: true },
  })
  if (!user) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

  if (user.role === 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } })
    if (admins <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last active administrator' }, { status: 400 })
    }
  }

  // Records that must keep pointing at a real user — presence of any blocks deletion
  const [
    appointments, visits, clinicalNotes, treatmentPlans,
    prescriptions, observations, contracts, salaryRecords, diagnosisDrafts,
  ] = await Promise.all([
    prisma.appointment.count({ where: { providerId: id } }),
    prisma.visit.count({ where: { doctorId: id } }),
    prisma.clinicalNote.count({ where: { authorId: id } }),
    prisma.treatmentPlan.count({ where: { createdById: id } }),
    prisma.prescription.count({ where: { doctorId: id } }),
    prisma.visitObservation.count({
      where: { OR: [{ authorId: id }, { onBehalfOfDoctorId: id }] },
    }),
    prisma.staffContract.count({ where: { userId: id } }),
    prisma.salaryRecord.count({ where: { userId: id } }),
    prisma.diagnosisDraft.count({ where: { updatedById: id } }),
  ])

  const blockers = [
    [appointments,    'appointment'],
    [visits,          'visit'],
    [clinicalNotes,   'clinical note'],
    [treatmentPlans,  'treatment plan'],
    [prescriptions,   'prescription'],
    [observations,    'visit observation'],
    [contracts,       'staff contract'],
    [salaryRecords,   'salary record'],
    [diagnosisDrafts, 'diagnosis draft'],
  ]
    .filter(([count]) => (count as number) > 0)
    .map(([count, label]) => `${count} ${label}${(count as number) === 1 ? '' : 's'}`)

  if (blockers.length > 0) {
    return NextResponse.json({
      error: `${user.name} has ${blockers.join(', ')} on record and cannot be deleted. `
           + 'Deactivate the account instead — this keeps those records attributable.',
    }, { status: 409 })
  }

  // Keep the trail: log who was removed before the row (and its audit rows) go away
  await prisma.auditLog.create({
    data: {
      userId:     session.user.id,
      action:     'DELETE',
      resource:   'user',
      resourceId: user.id,
      details:    { name: user.name, email: user.email, role: user.role },
    },
  })

  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ ok: true, id })
}

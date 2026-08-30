import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDoctorRole } from '@/lib/permissions'
import { QUEUE_STATUSES } from '@/lib/queue'

async function latestDoctorStatus(doctorId: string) {
  return prisma.doctorStatusEvent.findFirst({
    where: { doctorId },
    orderBy: { createdAt: 'desc' },
    select: { status: true },
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const {
    status, assignedDoctorId, queueNumber, visitId, notes, referralNote, chairNumber,
    patientId, patientType, intakeStatus, displayName, contactPhone, reason,
  } = body

  const existing = await prisma.receptionQueueItem.findUnique({
    where: { id },
    select: { id: true, status: true, patientId: true, assignedDoctorId: true, branchId: true },
  })
  if (!existing) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })

  if (
    isDoctorRole(session.user.role) &&
    existing.assignedDoctorId &&
    existing.assignedDoctorId !== session.user.id
  ) {
    return NextResponse.json({ error: 'This patient is assigned to another doctor' }, { status: 403 })
  }

  const data: any = {}
  if (status) {
    if (!(QUEUE_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'Invalid queue status' }, { status: 400 })
    }
    const nextPatientId = patientId !== undefined ? patientId : existing.patientId
    if (['COMPLETED', 'PAID'].includes(status) && !nextPatientId) {
      return NextResponse.json(
        { error: 'Add patient details or link an existing patient before marking this queue item done' },
        { status: 400 }
      )
    }
    data.status = status
    if (status === 'ASSIGNED') {
      data.calledAt = new Date()
      data.calledById = session.user.id
    }
    if (status === 'IN_CHAIR') {
      const doctorId = existing.assignedDoctorId ?? (isDoctorRole(session.user.role) ? session.user.id : null)
      if (isDoctorRole(session.user.role)) {
        const latestStatus = await latestDoctorStatus(session.user.id)
        if (latestStatus?.status !== 'READY') {
          return NextResponse.json(
            { error: 'Start your session first before receiving a patient to chair.' },
            { status: 409 }
          )
        }
      }
      data.startedAt = new Date()
      data.calledById = session.user.id
      if (!existing.assignedDoctorId && isDoctorRole(session.user.role)) {
        data.assignedDoctorId = session.user.id
      }
      if (!doctorId) {
        return NextResponse.json({ error: 'Assign a doctor before receiving this patient to chair.' }, { status: 400 })
      }
    }
    if (['COMPLETED', 'PAID', 'LEFT'].includes(status)) data.finishedAt = new Date()
  }
  if (assignedDoctorId !== undefined) data.assignedDoctorId = assignedDoctorId || null
  if (queueNumber !== undefined) data.queueNumber = Number(queueNumber)
  if (chairNumber !== undefined) data.chairNumber = chairNumber ? Number(chairNumber) : null
  if (visitId !== undefined) data.visitId = visitId || null
  if (notes !== undefined) data.notes = notes || null
  if (reason !== undefined) data.reason = reason || null
  if (displayName !== undefined) data.displayName = displayName || null
  if (contactPhone !== undefined) data.contactPhone = contactPhone || null
  if (patientType !== undefined) data.patientType = patientType || 'UNKNOWN'
  if (intakeStatus !== undefined) data.intakeStatus = intakeStatus || 'NO_INTAKE'
  if (patientId !== undefined) {
    if (patientId) {
      const duplicate = await prisma.receptionQueueItem.findFirst({
        where: {
          id: { not: existing.id },
          patientId,
          branchId: existing.branchId,
          status: { in: ['CHECKED_IN', 'ASSIGNED', 'IN_CHAIR', 'COMPLETED'] },
        },
        select: { id: true },
      })
      if (duplicate) return NextResponse.json({ error: 'Patient is already in the queue' }, { status: 409 })
      data.patientId = patientId
      data.patientType = 'EXISTING'
      data.intakeStatus = 'MATCHED'
    } else {
      data.patientId = null
    }
  }

  // Doctor refers the patient to another doctor: reassign + note + audit,
  // patient reappears in the new doctor's queue at ASSIGNED
  if (referralNote !== undefined && assignedDoctorId) {
    data.referralNote = referralNote || null
    data.referredById = session.user.id
    data.status = 'ASSIGNED'
    data.calledAt = new Date()
    data.startedAt = null
    data.finishedAt = null
    data.priority = 100
  }

  const updated = await prisma.receptionQueueItem.update({
    where: { id },
    data,
    include: {
      patient: { select: { firstName: true, lastName: true, patientNumber: true } },
      assignedDoctor: { select: { id: true, name: true } },
    },
  })

  if (status === 'IN_CHAIR') {
    await prisma.doctorStatusEvent.create({
      data: {
        doctorId: data.assignedDoctorId ?? existing.assignedDoctorId ?? session.user.id,
        branchId: existing.branchId,
        queueItemId: existing.id,
        status: 'WITH_PATIENT',
        note: `Token ${updated.queueNumber} received to chair`,
      },
    })
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      patientId: data.patientId ?? existing.patientId ?? null,
      action: 'UPDATE',
      resource: 'reception_queue',
      resourceId: existing.id,
      details: { status, assignedDoctorId, queueNumber, visitId, patientId, intakeStatus },
    },
  })

  return NextResponse.json(updated)
}

import { DoctorAvailabilityStatus, PrismaClient } from '@prisma/client'

type Db = PrismaClient

export const ACTIVE_DOCTOR_STATUSES: DoctorAvailabilityStatus[] = ['READY', 'WITH_PATIENT']
export const SESSION_BLOCKING_DOCTOR_STATUSES: DoctorAvailabilityStatus[] = ['SHORT_BREAK', 'UNAVAILABLE', 'SESSION_ENDED']
export const DOCTOR_SESSION_MAX_MS = 7 * 60 * 60 * 1000

export function isDoctorSessionActive(status?: DoctorAvailabilityStatus | string | null) {
  return ACTIVE_DOCTOR_STATUSES.includes(status as DoctorAvailabilityStatus)
}

export function canDoctorTakePatient(status?: DoctorAvailabilityStatus | string | null) {
  return isDoctorSessionActive(status)
}

export async function getEffectiveDoctorStatus(db: Db, doctorId: string) {
  const events = await db.doctorStatusEvent.findMany({
    where: { doctorId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      doctorId: true,
      branchId: true,
      status: true,
      queueItemId: true,
      note: true,
      createdAt: true,
    },
  })

  const latest = events[0] ?? null
  if (!latest || !isDoctorSessionActive(latest.status)) return latest

  const activeStreak = []
  for (const event of events) {
    if (!isDoctorSessionActive(event.status)) break
    activeStreak.push(event)
  }

  const sessionStart =
    activeStreak.find(event => event.status === 'READY') ??
    activeStreak[activeStreak.length - 1]

  if (sessionStart && Date.now() - sessionStart.createdAt.getTime() >= DOCTOR_SESSION_MAX_MS) {
    const ended = await db.doctorStatusEvent.create({
      data: {
        doctorId,
        branchId: latest.branchId,
        status: 'SESSION_ENDED',
        note: 'Automatically ended after 7 hours',
      },
      select: {
        id: true,
        doctorId: true,
        branchId: true,
        status: true,
        queueItemId: true,
        note: true,
        createdAt: true,
      },
    })

    await db.auditLog.create({
      data: {
        userId: null,
        action: 'UPDATE',
        resource: 'doctor_status_auto_end',
        resourceId: ended.id,
        details: {
          doctorId,
          previousStatus: latest.status,
          sessionStartedAt: sessionStart.createdAt,
          endedAt: ended.createdAt,
          reason: 'Exceeded 7 hours',
        },
      },
    })

    return ended
  }

  return latest
}

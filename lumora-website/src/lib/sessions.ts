import { Prisma, PrismaClient, SessionPeriod } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

// Mirrors dental-pms/src/lib/sessions.ts — the two apps don't share code,
// only the database schema, so this stays a deliberate duplicate.
export const SESSION_HOURS: Record<SessionPeriod, { start: number; end: number }> = {
  MORNING: { start: 9,  end: 14 },
  EVENING: { start: 16, end: 21 },
}

export function periodForTime(d: Date): SessionPeriod | null {
  const h = d.getHours()
  if (h >= SESSION_HOURS.MORNING.start && h < SESSION_HOURS.MORNING.end) return 'MORNING'
  if (h >= SESSION_HOURS.EVENING.start && h < SESSION_HOURS.EVENING.end) return 'EVENING'
  return null
}

export function sessionDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

export async function getOrCreateSession(db: Db, branchId: string, date: Date, period: SessionPeriod) {
  const day = sessionDate(date)
  const existing = await db.clinicSession.findUnique({
    where: { branchId_date_period: { branchId, date: day, period } },
  })
  if (existing) return existing

  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: { onlineSlotsDefault: true, appointmentSlotsDefault: true },
  })
  return db.clinicSession.create({
    data: {
      branchId,
      date: day,
      period,
      onlineCapacity:      branch?.onlineSlotsDefault ?? 4,
      appointmentCapacity: branch?.appointmentSlotsDefault ?? 10,
    },
  })
}

export async function onlineUsage(db: Db, sessionId: string) {
  return db.appointment.count({
    where: { sessionId, slotKind: 'ONLINE', status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
  })
}

export async function isDoctorRostered(db: Db, doctorId: string, branchId: string, date: Date, period: SessionPeriod) {
  const weekday = date.getDay()
  const entry = await db.doctorBranchAvailability.findFirst({
    where: { doctorId, branchId, weekday, period, isActive: true },
    select: { id: true },
  })
  return !!entry
}

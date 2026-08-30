import { Prisma, PrismaClient, SessionPeriod } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

// Session hours (fixed clinic schedule)
export const SESSION_HOURS: Record<SessionPeriod, { start: number; end: number; label: string }> = {
  MORNING: { start: 9,  end: 14, label: 'Morning (9:00 AM – 2:00 PM)' },
  EVENING: { start: 16, end: 21, label: 'Evening (4:00 PM – 9:00 PM)' },
}

// Which session does a given time fall in? null = outside session hours.
export function periodForTime(d: Date): SessionPeriod | null {
  const h = d.getHours()
  if (h >= SESSION_HOURS.MORNING.start && h < SESSION_HOURS.MORNING.end) return 'MORNING'
  if (h >= SESSION_HOURS.EVENING.start && h < SESSION_HOURS.EVENING.end) return 'EVENING'
  return null
}

// Normalize to a date-only value (session key)
export function sessionDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

// Materialize the session row lazily from branch defaults.
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

// How many booked appointments have consumed each allocation.
export async function sessionUsage(db: Db, sessionId: string) {
  const [online, appointment] = await Promise.all([
    db.appointment.count({
      where: { sessionId, slotKind: 'ONLINE', status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    }),
    db.appointment.count({
      where: { sessionId, slotKind: 'APPOINTMENT', status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    }),
  ])
  return { online, appointment }
}

// Is this doctor rostered for (branch, date, period)?
export async function isDoctorRostered(db: Db, doctorId: string, branchId: string, date: Date, period: SessionPeriod) {
  const weekday = date.getDay()
  const entry = await db.doctorBranchAvailability.findFirst({
    where: { doctorId, branchId, weekday, period, isActive: true },
    select: { id: true },
  })
  return !!entry
}

// Doctors rostered for a session (used by the website and booking modal)
export async function rosteredDoctors(db: Db, branchId: string, date: Date, period: SessionPeriod) {
  const weekday = date.getDay()
  return db.doctorBranchAvailability.findMany({
    where: { branchId, weekday, period, isActive: true, doctor: { isActive: true } },
    select: { doctor: { select: { id: true, name: true } } },
  })
}

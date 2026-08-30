import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { periodForTime, getOrCreateSession, onlineUsage } from '@/lib/sessions'
import { clientIp, rateLimit } from '@/lib/rate-limit'

type SlotResult = { time: string; available: boolean }
type DayResult = {
  date: string
  dayLabel: string
  dateLabel: string
  slots: SlotResult[]
  availableCount: number
}

function parseLocalDate(dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function getSlotsForDate(doctorId: string, dateStr: string): Promise<SlotResult[]> {
  const date = parseLocalDate(dateStr)
  if (!date) return []
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

  const enabledSlots = await prisma.onlineSlot.findMany({
    where: { doctorId, dayOfWeek: dayName, isActive: true },
    orderBy: { startTime: 'asc' },
  })
  if (enabledSlots.length === 0) return []

  const doctorBranch = await prisma.userBranch.findFirst({
    where: { userId: doctorId, isPrimary: true },
    select: { branchId: true },
  })
  if (!doctorBranch) return []
  const branchId = doctorBranch.branchId

  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)

  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const bookedAppts = await prisma.appointment.findMany({
    where: {
      providerId: doctorId,
      startTime: { gte: dayStart, lte: dayEnd },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    },
    select: { startTime: true },
  })

  const bookedTimes = new Set(bookedAppts.map(a => {
    const t = new Date(a.startTime)
    return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
  }))

  const periodCache = new Map<string, { hasRoom: boolean }>()

  const periodGate = async (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number)
    const at = new Date(date)
    at.setHours(h, m, 0, 0)
    const period = periodForTime(at)
    if (!period) return { hasRoom: false }

    const cached = periodCache.get(period)
    if (cached) return cached

    const session = await getOrCreateSession(prisma, branchId, date, period)
    const hasRoom = session.isOpen && (await onlineUsage(prisma, session.id)) < session.onlineCapacity

    const result = { hasRoom }
    periodCache.set(period, result)
    return result
  }

  const result: SlotResult[] = []
  for (const slot of enabledSlots) {
    const gate = await periodGate(slot.startTime)
    result.push({
      time: slot.startTime,
      available: gate.hasRoom && !bookedTimes.has(slot.startTime),
    })
  }

  return result
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers)
  const limited = rateLimit(`slots:${ip}`, 120, 60 * 1000)
  if (limited.limited) {
    return NextResponse.json([], { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } })
  }

  const { searchParams } = new URL(req.url)
  const doctorId = searchParams.get('doctorId')
  const dateStr = searchParams.get('date')
  const startDateStr = searchParams.get('startDate')
  const daysParam = searchParams.get('days')

  if (!doctorId) {
    return NextResponse.json([], { status: 200 })
  }

  try {
    if (startDateStr && daysParam) {
      const days = Math.min(Math.max(Number(daysParam) || 7, 1), 14)
      const startDate = parseLocalDate(startDateStr)
      if (!startDate) return NextResponse.json([], { status: 400 })
      const result: DayResult[] = []

      for (let offset = 0; offset < days; offset += 1) {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + offset)
        const key = toDateKey(date)
        const slots = await getSlotsForDate(doctorId, key)

        result.push({
          date: key,
          dayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
          dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          availableCount: slots.filter(slot => slot.available).length,
          slots,
        })
      }

      return NextResponse.json(result)
    }

    if (!dateStr) {
      return NextResponse.json([], { status: 200 })
    }

    const result = await getSlotsForDate(doctorId, dateStr)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[API/slots]', err)
    return NextResponse.json([])
  }
}

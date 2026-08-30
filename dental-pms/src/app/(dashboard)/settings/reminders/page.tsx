import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { RemindersDashboard } from '@/components/settings/RemindersDashboard'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Reminders' }

export default async function RemindersPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'reminders.send')) redirect('/dashboard')

  // Load tomorrow's appointments that haven't been reminded yet
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const tomorrowEnd = new Date(tomorrow)
  tomorrowEnd.setHours(23, 59, 59, 999)

  const pending = await prisma.appointment.findMany({
    where: {
      startTime:         { gte: tomorrow, lte: tomorrowEnd },
      status:            { in: ['SCHEDULED', 'CONFIRMED'] },
      reminder24hSentAt: null,
    },
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true, preferredLanguage: true, communicationPref: true } },
      branch:  { select: { name: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  // Recent reminder log
  const recentLogs = await prisma.auditLog.findMany({
    where:   { resource: 'reminder' },
    orderBy: { createdAt: 'desc' },
    take:    20,
    include: { patient: { select: { firstName: true, lastName: true } } },
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to settings
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">SMS & WhatsApp Reminders</h1>
      <p className="text-base text-gray-500 mb-6">
        Send appointment reminders via Mobitel SMS or WhatsApp — in English or Sinhala.
      </p>
      <RemindersDashboard
        pendingAppointments={JSON.parse(JSON.stringify(pending))}
        recentLogs={JSON.parse(JSON.stringify(recentLogs))}
      />
    </div>
  )
}

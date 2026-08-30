import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { OnlineSlotsManager } from '@/components/settings/OnlineSlotsManager'
import { ChevronLeft, Globe } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { can, DOCTOR_ROLES } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Appointment Slots' }

export default async function OnlineSlotsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  // Doctors and admins can manage their own slots; admin can manage all
  if (!can(session.user.role, 'slots.manage')) redirect('/settings')

  const isAdmin = session.user.role === 'ADMIN'

  // Load doctors (admin sees all, doctor sees only self)
  const doctors = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: [...DOCTOR_ROLES] },
      ...(isAdmin ? {} : { id: session.user.id }),
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })

  // Load existing slots
  const slots = await prisma.onlineSlot.findMany({
    where: {
      ...(isAdmin ? {} : { doctorId: session.user.id }),
    },
    orderBy: [{ doctorId: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href={isAdmin ? '/settings' : '/dashboard'} className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> {isAdmin ? 'Back to settings' : 'Back to dashboard'}
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Globe className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appointment Slots</h1>
          <p className="text-base text-gray-500">
            Choose which time slots appear on the public website for online booking.
          </p>
        </div>
      </div>

      <div className="mt-2 mb-6 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-sm text-blue-700">
        Patients can book only the enabled slots for each doctor and day.
        Online capacity is controlled by the branch session defaults and existing bookings.
      </div>

      <OnlineSlotsManager
        doctors={doctors}
        initialSlots={JSON.parse(JSON.stringify(slots))}
        currentUserId={session.user.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}

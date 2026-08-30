import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Stethoscope, ChevronRight, Clock, ClipboardList } from 'lucide-react'
import { formatTime, getPatientDisplayName } from '@/lib/utils'
import { can } from '@/lib/permissions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Active Visits' }

function queueDisplayName(item: any) {
  if (item.patient) return getPatientDisplayName(item.patient)
  if (item.displayName) return item.displayName
  if (item.intakeSubmission?.firstName || item.intakeSubmission?.lastName) {
    return [item.intakeSubmission.firstName, item.intakeSubmission.lastName].filter(Boolean).join(' ')
  }
  return `Token ${item.queueNumber}`
}

// Nurse scribe entry point: any unlocked visit a nurse can open to add
// observations while the doctor is treating the patient.
export default async function ActiveVisitsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'clinical.scribe')) redirect('/dashboard')

  const [queueItems, visits] = await Promise.all([
    prisma.receptionQueueItem.findMany({
      where: { status: 'IN_CHAIR' },
      orderBy: [{ startedAt: 'desc' }, { queueNumber: 'asc' }],
      take: 30,
      include: {
        patient: { select: { firstName: true, lastName: true, preferredName: true, patientNumber: true } },
        intakeSubmission: { select: { firstName: true, lastName: true, patientNumber: true } },
        assignedDoctor: { select: { name: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.visit.findMany({
      where: { lockedAt: null, status: 'IN_PROGRESS' },
      orderBy: { visitDate: 'desc' },
      take: 30,
      include: {
        patient: { select: { firstName: true, lastName: true, patientNumber: true } },
        doctor:  { select: { name: true } },
        branch:  { select: { name: true } },
      },
    }),
  ])

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Active visits</h1>
        <p className="text-base text-gray-500 mt-1">
          Open a visit to add observations while the doctor is with the patient.
        </p>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">With doctor now</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-700">{queueItems.length}</span>
          </div>
        </div>
        {queueItems.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            <Stethoscope className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            No patient is currently in chair
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {queueItems.map(item => (
              <Link
                key={item.id}
                href={`/diagnosis?queueId=${item.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 text-center flex-shrink-0">
                  <ClipboardList className="w-4 h-4 text-amber-500 mx-auto" />
                  <p className="text-xs text-gray-400 mt-0.5">{item.startedAt ? formatTime(item.startedAt) : 'Now'}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-gray-900">{queueDisplayName(item)}</p>
                  <p className="text-sm text-gray-500">
                    Token {item.queueNumber}
                    {item.patient?.patientNumber ? ` - ${item.patient.patientNumber}` : ''}
                    {item.assignedDoctor ? ` - Dr. ${item.assignedDoctor.name}` : ''}
                    {item.branch ? ` - ${item.branch.name}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white">Assist</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Saved active visit notes</h2>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-bold text-blue-700">{visits.length}</span>
          </div>
        </div>
        {visits.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <Stethoscope className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            No saved active visits right now
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visits.map(visit => (
              <Link
                key={visit.id}
                href={`/visits/${visit.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 text-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-400 mt-0.5">{formatTime(visit.visitDate)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-gray-900">{getPatientDisplayName(visit.patient)}</p>
                  <p className="text-sm text-gray-500">
                    {visit.patient.patientNumber} · Dr. {visit.doctor.name}
                    {visit.branch ? ` · ${visit.branch.name}` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

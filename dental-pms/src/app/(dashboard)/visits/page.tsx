import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Clock, CheckCircle,
  AlertTriangle, UserPlus, ChevronRight,
} from 'lucide-react'
import { cn, formatTime, formatDate, getAge, getPatientDisplayName } from '@/lib/utils'
import { DoctorQueuePanel } from '@/components/queue/DoctorQueuePanel'
import type { Metadata } from 'next'
import { can, isDoctorRole } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Start Visit' }

interface PageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function VisitsPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'clinical.visit')) redirect('/queue')
  const params = await searchParams

  const search = params.search?.trim() ?? ''
  const isDoctor = isDoctorRole(session.user.role)

  // Today's active visits
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const todaysVisits = await prisma.visit.findMany({
    where: { visitDate: { gte: today, lte: todayEnd } },
    orderBy: { visitDate: 'desc' },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, phone: true } },
      doctor:  { select: { name: true } },
    },
  })

  // Patient search results
  let searchResults: any[] = []
  if (search.length > 1) {
    searchResults = await prisma.patient.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { firstName:     { contains: search, mode: 'insensitive' } },
          { lastName:      { contains: search, mode: 'insensitive' } },
          { patientNumber: { contains: search, mode: 'insensitive' } },
          { phone:         { contains: search } },
          { nicNumber:     { contains: search } },
        ],
      },
      take: 8,
      include: {
        medicalHistory: { select: { allergies: true } },
        visits: {
          orderBy: { visitDate: 'desc' },
          take: 1,
          select: { visitDate: true, treatmentDone: true },
        },
      },
    })
  }

  const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    IN_PROGRESS:  { label: 'In treatment',  color: 'bg-amber-100 text-amber-800',  icon: Clock },
    READY_TO_PAY: { label: 'Ready to pay',  color: 'bg-green-100 text-green-800',  icon: CheckCircle },
    COMPLETED:    { label: 'Completed',      color: 'bg-gray-100 text-gray-600',    icon: CheckCircle },
  }

  const doctorQueue = isDoctor
    ? await prisma.receptionQueueItem.findMany({
        where: {
          status: { in: ['CHECKED_IN', 'ASSIGNED'] },
          patientId: { not: null },
          OR: [{ assignedDoctorId: null }, { assignedDoctorId: session.user.id }],
        },
        orderBy: [{ priority: 'desc' }, { queueNumber: 'asc' }, { arrivedAt: 'asc' }],
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              patientNumber: true,
              dateOfBirth: true,
            },
          },
          assignedDoctor: { select: { id: true, name: true } },
        },
      })
    : []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Start Visit</h1>
        <p className="text-base text-gray-500 mt-1">Search for a patient to begin their visit, or select from today's list.</p>
      </div>

      {isDoctor && (
        <DoctorQueuePanel
          initialQueue={JSON.parse(JSON.stringify(doctorQueue))}
          currentUser={session.user}
        />
      )}

      {/* Search */}
      <form method="GET" className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          name="search"
          type="search"
          defaultValue={search}
          autoFocus
          placeholder="Search patient by name, phone or NIC…"
          className="form-input pl-12 text-lg"
        />
      </form>

      {/* Search results */}
      {search.length > 1 && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="text-lg font-semibold text-gray-900">
              {searchResults.length} patient{searchResults.length !== 1 ? 's' : ''} found
            </h2>
            <Link href="/patients/new" className="btn-secondary !text-sm !px-3 !py-2">
              <UserPlus className="w-4 h-4" />
              New patient
            </Link>
          </div>

          {searchResults.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400">
              <p className="text-base">No patients found for "{search}"</p>
              <Link href="/patients/new" className="btn-primary mt-4 inline-flex">
                <UserPlus className="w-4 h-4" />
                Register new patient
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {searchResults.map(patient => {
                const allergies = (patient.medicalHistory?.allergies as any[]) ?? []
                const lastVisit = patient.visits[0]
                const name = getPatientDisplayName(patient)

                return (
                  <Link
                    key={patient.id}
                    href={`/visits/new?patientId=${patient.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-blue-50 transition-colors group"
                  >
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 font-bold text-base">
                      {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-lg font-semibold text-gray-900">{name}</p>
                        {allergies.length > 0 && (
                          <span className="flex items-center gap-1 text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            {allergies.map((a: any) => a.substance).join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {patient.patientNumber}
                        {patient.phone ? ` · ${patient.phone}` : ''}
                        {' · '}{getAge(patient.dateOfBirth)} yrs
                      </p>
                      {lastVisit && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Last visit: {formatDate(lastVisit.visitDate)}
                          {lastVisit.treatmentDone ? ` — ${lastVisit.treatmentDone.slice(0, 60)}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 text-blue-600 group-hover:text-blue-800">
                      <span className="text-base font-semibold">Start visit</span>
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Today's visits */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Today's visits</h2>
            <span className="bg-blue-100 text-blue-700 text-sm font-bold px-2.5 py-0.5 rounded-full">
              {todaysVisits.length}
            </span>
          </div>
        </div>

        {todaysVisits.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-base">No visits recorded today yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {todaysVisits.map(visit => {
              const cfg = STATUS_CONFIG[visit.status] ?? STATUS_CONFIG.IN_PROGRESS
              const StatusIcon = cfg.icon
              return (
                <Link
                  key={visit.id}
                  href={`/visits/${visit.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 text-center flex-shrink-0">
                    <p className="text-base font-bold text-gray-900">{formatTime(visit.visitDate)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900">
                      {getPatientDisplayName(visit.patient)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {visit.patient.patientNumber} · Dr. {visit.doctor.name}
                    </p>
                    {visit.chiefComplaint && (
                      <p className="text-sm text-gray-400 truncate">{visit.chiefComplaint}</p>
                    )}
                  </div>
                  <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1', cfg.color)}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

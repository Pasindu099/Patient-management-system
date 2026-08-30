import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import {
  Search, UserPlus, AlertTriangle,
  ChevronRight, Stethoscope, Phone,
} from 'lucide-react'
import { formatDate, getAge, getPatientDisplayName, cn } from '@/lib/utils'
import type { Metadata } from 'next'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Patient List' }

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string }>
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-teal-500', 'bg-purple-500',
  'bg-amber-500', 'bg-rose-500', 'bg-emerald-500',
]

export default async function PatientsPage({ searchParams }: PageProps) {
  const session = await auth()
  const params = await searchParams
  const canStartVisit = !!session && can(session.user.role, 'clinical.visit')

  const search = params.search?.trim() ?? ''
  const page   = Math.max(1, parseInt(params.page ?? '1'))
  const limit  = 25
  const skip   = (page - 1) * limit

  const where: any = { deletedAt: null, isActive: true }
  if (search) {
    where.OR = [
      { firstName:     { contains: search, mode: 'insensitive' } },
      { lastName:      { contains: search, mode: 'insensitive' } },
      { patientNumber: { contains: search, mode: 'insensitive' } },
      { phone:         { contains: search } },
      { nicNumber:     { contains: search } },
    ]
  }

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { lastVisitDate: 'desc' },
      include: {
        medicalHistory: { select: { allergies: true } },
        visits: {
          orderBy: { visitDate: 'desc' },
          take: 1,
          select: { visitDate: true, treatmentDone: true, status: true },
        },
      },
    }),
    prisma.patient.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Patient List</h1>
          <p className="text-base text-gray-500 mt-0.5">{total.toLocaleString()} patients</p>
        </div>
        <Link href="/patients/new" className="btn-primary">
          <UserPlus className="w-5 h-5" />
          Register new patient
        </Link>
      </div>

      {/* Search */}
      <form method="GET">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Search by name, phone, NIC or patient ID…"
            className="form-input pl-12 text-lg"
            autoFocus={!search}
          />
        </div>
      </form>

      {/* Patient table */}
      <div className="section-card overflow-hidden">
        {patients.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xl font-semibold text-gray-400">
              {search ? `No patients found for "${search}"` : 'No patients yet'}
            </p>
            <Link href="/patients/new" className="btn-primary mt-4 inline-flex">
              <UserPlus className="w-4 h-4" />
              Register first patient
            </Link>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-12 gap-3 px-6 py-3 bg-gray-50 border-b border-gray-200
                            text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div className="col-span-4">Patient</div>
              <div className="col-span-2">Phone</div>
              <div className="col-span-2">Age / Gender</div>
              <div className="col-span-3">Last visit</div>
              <div className="col-span-1"></div>
            </div>

            {/* Rows — entire row is clickable to open profile */}
            <div className="divide-y divide-gray-100">
              {patients.map(patient => {
                const name     = getPatientDisplayName(patient)
                const allergies = (patient.medicalHistory?.allergies as any[]) ?? []
                const lastVisit = patient.visits[0]
                const avatarBg  = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
                const initials  = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

                return (
                  <div key={patient.id} className="grid grid-cols-12 gap-3 px-6 py-4 items-center
                                                    hover:bg-blue-50 transition-colors group relative">

                    {/* Patient info — clickable to profile */}
                    <Link
                      href={`/patients/${patient.id}`}
                      className="col-span-4 flex items-center gap-3 min-w-0"
                    >
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                        'text-white font-bold text-sm flex-shrink-0', avatarBg)}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-semibold text-gray-900 truncate">{name}</p>
                          {allergies.length > 0 && (
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-400 font-mono">{patient.patientNumber}</p>
                      </div>
                    </Link>

                    {/* Phone */}
                    <div className="col-span-2 hidden sm:block">
                      {patient.phone ? (
                        <a href={`tel:${patient.phone}`}
                           className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600"
                >
                          <Phone className="w-3.5 h-3.5" />
                          {patient.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                    </div>

                    {/* Age / Gender */}
                    <div className="col-span-2 hidden sm:block text-sm text-gray-600">
                      {getAge(patient.dateOfBirth)} yrs · {patient.gender === 'MALE' ? 'M' : patient.gender === 'FEMALE' ? 'F' : '—'}
                    </div>

                    {/* Last visit */}
                    <div className="col-span-3 hidden sm:block">
                      {lastVisit ? (
                        <div>
                          <p className="text-sm text-gray-700">{formatDate(lastVisit.visitDate)}</p>
                          {lastVisit.treatmentDone && (
                            <p className="text-xs text-gray-400 truncate max-w-[200px]">
                              {lastVisit.treatmentDone}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-300">No visits yet</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 sm:col-span-1 flex items-center justify-end gap-1">
                      {/* Start visit — primary action */}
                      {canStartVisit && (
                        <Link
                          href={`/visits/new?patientId=${patient.id}`}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                                     bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white
                                     transition-colors min-h-[44px] opacity-0 group-hover:opacity-100"
                          title="Start visit"
                        >
                          <Stethoscope className="w-4 h-4" />
                          <span className="hidden lg:inline">Visit</span>
                        </Link>
                      )}
                      <Link
                        href={`/patients/${patient.id}`}
                        className="p-2 text-gray-300 hover:text-blue-600 transition-colors"
                        title="View profile"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-base text-gray-500">
                  {skip + 1}–{Math.min(skip + limit, total)} of {total.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link href={`/patients?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                      className="btn-secondary !px-4 !py-2 !text-sm">← Previous</Link>
                  )}
                  {page < totalPages && (
                    <Link href={`/patients?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                      className="btn-primary !px-4 !py-2 !text-sm">Next →</Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

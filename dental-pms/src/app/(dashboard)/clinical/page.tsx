import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { Search, ClipboardList, ChevronRight, AlertTriangle } from 'lucide-react'
import { formatDate, getAge, getPatientDisplayName, cn } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Clinical' }

interface PageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function ClinicalPage({ searchParams }: PageProps) {
  await auth()
  const params = await searchParams

  const search = params.search?.trim() ?? ''

  const recentPatients = await prisma.patient.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      ...(search ? {
        OR: [
          { firstName:     { contains: search, mode: 'insensitive' } },
          { lastName:      { contains: search, mode: 'insensitive' } },
          { patientNumber: { contains: search, mode: 'insensitive' } },
          { nicNumber:     { contains: search } },
          { phone:         { contains: search } },
        ],
      } : {}),
    },
    orderBy: { lastVisitDate: 'desc' },
    take: 12,
    include: {
      medicalHistory: { select: { allergies: true } },
      riskAssessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
    },
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Clinical</h1>
        <p className="text-base text-gray-500 mt-1">
          Search for a patient to add clinical notes or treatment plans.
        </p>
      </div>

      {/* Search */}
      <form method="GET" className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          name="search"
          type="search"
          defaultValue={search}
          autoFocus
          placeholder="Search by name, NIC or patient ID…"
          className="form-input pl-12 text-lg"
          aria-label="Search patients"
        />
      </form>

      {/* Patient grid */}
      <div>
        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          {search ? `Results for "${search}"` : 'Recent patients'}
        </p>

        {recentPatients.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg text-gray-500">No patients found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentPatients.map(patient => {
              const allergies = (patient.medicalHistory?.allergies as any[]) ?? []
              const risk = patient.riskAssessments[0]
              const fullName = getPatientDisplayName(patient)

              const COLORS = ['bg-blue-500','bg-teal-500','bg-purple-500','bg-amber-500','bg-rose-500','bg-emerald-500']
              const avatarBg = COLORS[fullName.charCodeAt(0) % COLORS.length]

              return (
                <Link
                  key={patient.id}
                  href={`/clinical/${patient.id}`}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border-2
                             border-gray-200 hover:border-blue-400 hover:shadow-md
                             transition-all group"
                >
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold', avatarBg)}>
                    {fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-gray-900 truncate">{fullName}</p>
                      {allergies.length > 0 && (
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {patient.patientNumber} · {getAge(patient.dateOfBirth)} yrs
                    </p>
                    {patient.lastVisitDate && (
                      <p className="text-xs text-gray-400">Last visit: {formatDate(patient.lastVisitDate)}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

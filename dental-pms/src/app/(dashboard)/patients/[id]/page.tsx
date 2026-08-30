import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import {
  ChevronLeft, Phone, Mail, MapPin,
  AlertTriangle, Edit, Stethoscope,
  Clock, Receipt,
} from 'lucide-react'
import { formatDate, getAge, cn, getPatientDisplayName, formatLKR } from '@/lib/utils'
import { MedicalAlertsBanner } from '@/components/patients/MedicalAlertsBanner'
import { PatientTabs }    from '@/components/patients/PatientTabs'
import type { Metadata }  from 'next'
import { can } from '@/lib/permissions'

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const p = await prisma.patient.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  })
  if (!p) return { title: 'Patient not found' }
  return { title: `${p.firstName} ${p.lastName}` }
}

export default async function PatientProfilePage({ params }: PageProps) {
  const session = await auth()
  if (!session) redirect('/login')
  const { id } = await params

  const patient = await prisma.patient.findUnique({
    where: { id, deletedAt: null },
    include: {
      medicalHistory: true,
      familyGroup: true,
      appointments: {
        orderBy: { startTime: 'desc' },
        take: 5,
        include: { provider: { select: { name: true } }, branch: { select: { name: true } } },
      },
      clinicalNotes: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { author: { select: { name: true } } },
      },
      treatmentPlans: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { items: true },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { items: true, payments: true },
      },
      riskAssessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      documents:       { orderBy: { uploadedAt: 'desc' }, take: 5 },
      vitalSigns:      { orderBy: { recordedAt: 'desc' }, take: 1 },
      visits: {
        orderBy: { visitDate: 'desc' },
        take: 5,
        include: {
          doctor: { select: { name: true } },
          prescriptions: {
            include: { items: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          invoices: {
            include: {
              invoice: {
                include: {
                  installmentPlan: {
                    include: { installments: { orderBy: { number: 'asc' } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!patient) notFound()

  const canStartVisit = can(session.user.role, 'clinical.visit')
  // Balance carried across every past bill is an aggregate, not the bill for
  // the patient in the chair — admin (and reception, who collect it) only.
  const canSeeBalance = can(session.user.role, 'money.aggregate') ||
                        can(session.user.role, 'billing.collect')
  const fullName  = getPatientDisplayName(patient)
  const lastVisit = patient.visits[0] ?? null

  const lastRx              = lastVisit?.prescriptions[0] ?? null
  const rxDrugs             = lastRx ? lastRx.items.map((i: any) => i.drugName).join(', ') : ''
  const lastInvoice         = lastVisit?.invoices[0]?.invoice ?? null
  const installmentPlan     = lastInvoice?.installmentPlan ?? null
  const installmentsPaid    = installmentPlan ? installmentPlan.installments.filter((i: any) => i.paidAt).length : 0
  const installmentsTotal   = installmentPlan ? installmentPlan.installments.length : 0

  const outstandingBalance = patient.invoices
    .filter(i => ['SENT', 'PARTIAL', 'OVERDUE'].includes(i.status))
    .reduce((sum, i) => sum + i.balance, 0)

  const AVATAR_COLORS = ['bg-blue-500', 'bg-teal-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500']
  const avatarBg = AVATAR_COLORS[fullName.charCodeAt(0) % AVATAR_COLORS.length]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      <Link href="/patients" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 transition-colors">
        <ChevronLeft className="w-4 h-4" />Back to patients
      </Link>

      <MedicalAlertsBanner medicalHistory={patient.medicalHistory} patientId={patient.id} />

      {/* Last visit summary */}
      {lastVisit ? (
        <div className="section-card border-2 border-blue-200 bg-blue-50">
          <div className="section-card-header bg-blue-100">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-base font-bold text-blue-900">Last visit — {formatDate(lastVisit.visitDate)}</p>
                <p className="text-sm text-blue-600">Dr. {lastVisit.doctor.name}</p>
              </div>
            </div>
            {canStartVisit && (
              <Link href={`/visits/new?patientId=${patient.id}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors min-h-[44px]">
                <Stethoscope className="w-4 h-4" />Start new visit
              </Link>
            )}
          </div>
          <div className="section-card-body space-y-2 text-sm">
            {lastVisit.chiefComplaint && (
              <div className="flex gap-3">
                <span className="font-semibold text-blue-700 w-32 flex-shrink-0">Complaint</span>
                <span className="text-gray-800">{lastVisit.chiefComplaint}</span>
              </div>
            )}
            {lastVisit.diagnosis && (
              <div className="flex gap-3">
                <span className="font-semibold text-blue-700 w-32 flex-shrink-0">Diagnosis</span>
                <span className="text-gray-800">{lastVisit.diagnosis}</span>
              </div>
            )}
            {lastVisit.treatmentDone && (
              <div className="flex gap-3">
                <span className="font-semibold text-blue-700 w-32 flex-shrink-0">Treatment done</span>
                <span className="text-gray-800">{lastVisit.treatmentDone}</span>
              </div>
            )}
            {lastVisit.nextVisitPlan && (
              <div className="flex gap-3 bg-amber-50 rounded-lg px-3 py-2 -mx-1">
                <span className="font-bold text-amber-700 w-32 flex-shrink-0">Plan for today</span>
                <span className="text-amber-900 font-semibold">{lastVisit.nextVisitPlan}</span>
              </div>
            )}
            {rxDrugs && (
              <div className="flex gap-3">
                <span className="font-semibold text-blue-700 w-32 flex-shrink-0">Prescribed</span>
                <span className="text-gray-800">{rxDrugs}</span>
              </div>
            )}
          </div>
          {installmentPlan && (
            <div className="px-6 pb-4">
              <div className="bg-white border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Receipt className="w-4 h-4 text-blue-500" />
                  <p className="text-sm font-semibold text-gray-700">
                    Installment plan: {installmentsPaid}/{installmentsTotal} paid
                  </p>
                </div>
                <p className="text-sm font-bold text-blue-700">
                  {installmentPlan.installments.map((i: any) => formatLKR(i.amount)).join(' / ')}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl px-6 py-5">
          <p className="text-base text-gray-500">No visits recorded yet for this patient.</p>
          {canStartVisit && (
            <Link href={`/visits/new?patientId=${patient.id}`}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-base font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors min-h-[44px]">
              <Stethoscope className="w-5 h-5" />Start first visit
            </Link>
          )}
        </div>
      )}

      {/* Patient header card */}
      <div className="section-card">
        <div className="section-card-body">
          <div className="flex items-start gap-5 flex-wrap">
            <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xl', avatarBg)}>
              {fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
                <span className="text-sm text-gray-400 font-mono">{patient.patientNumber}</span>
              </div>
              <p className="text-base text-gray-500 mt-1">
                {getAge(patient.dateOfBirth)} years · {patient.gender}
                {patient.nicNumber ? ` · NIC: ${patient.nicNumber}` : ''}
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                {patient.phone && (
                  <a href={`tel:${patient.phone}`} className="flex items-center gap-1.5 hover:text-blue-600">
                    <Phone className="w-4 h-4" />{patient.phone}
                  </a>
                )}
                {patient.email && (
                  <a href={`mailto:${patient.email}`} className="flex items-center gap-1.5 hover:text-blue-600">
                    <Mail className="w-4 h-4" />{patient.email}
                  </a>
                )}
                {patient.addressLine1 && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />{patient.addressLine1}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link href={`/patients/${patient.id}/edit`} className="btn-secondary !text-sm !px-3 !py-2">
                <Edit className="w-4 h-4" />Edit
              </Link>
              {canStartVisit && (
                <Link href={`/visits/new?patientId=${patient.id}`} className="btn-primary !text-sm !px-4 !py-2">
                  <Stethoscope className="w-4 h-4" />Start Visit
                </Link>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-gray-100">
            {([
              { label: 'Total visits', value: String(patient.visits.length), color: 'bg-blue-50 text-blue-700' },
              { label: 'Last visit', value: lastVisit ? formatDate(lastVisit.visitDate) : 'Never', color: 'bg-gray-50 text-gray-600' },
              ...(canSeeBalance
                ? [{ label: 'Outstanding', value: formatLKR(outstandingBalance), color: outstandingBalance > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700' }]
                : []),
            ]).map(stat => (
              <div key={stat.label} className={cn('px-4 py-2 rounded-xl text-sm font-semibold', stat.color)}>
                <span className="font-normal text-xs opacity-70 block">{stat.label}</span>
                {stat.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PatientTabs
        patient={JSON.parse(JSON.stringify(patient))}
        canSeeBilling={canSeeBalance}
      />
    </div>
  )
}

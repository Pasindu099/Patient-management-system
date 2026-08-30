import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { can } from '@/lib/permissions'
import { formatCents } from '@/lib/money'
import { cn, formatDate } from '@/lib/utils'
import { StaffContractForm } from '@/components/staff/StaffContractForm'
import {
  ArrowLeft, BriefcaseBusiness, CalendarDays, Stethoscope, TrendingUp,
  UserRound, Users, Wallet,
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Staff Member Stats' }
export const dynamic = 'force-dynamic'

export default async function StaffMemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'finance.admin')) redirect('/dashboard')

  const { id } = await params
  const today = new Date()
  const dayStart = new Date(today)
  dayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(dayStart)
  weekStart.setDate(dayStart.getDate() - dayStart.getDay())
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  const staff = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      contracts: {
        orderBy: { startDate: 'desc' },
        take: 8,
      },
      salaryRecords: {
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        take: 12,
      },
    },
  })

  if (!staff || !staff.isActive) notFound()

  const isDoctor = staff.role === 'DOCTOR'
  const currentContract = staff.contracts.find(contract => !contract.endDate) ?? staff.contracts[0]
  const monthSalary = staff.salaryRecords.find(record => record.periodYear === today.getFullYear() && record.periodMonth === today.getMonth() + 1)

  const [dayQueueItems, weekQueueItems, monthQueueItems, doctorPayments, recentVisits] = isDoctor ? await Promise.all([
    prisma.receptionQueueItem.findMany({
      where: { assignedDoctorId: id, status: { in: ['IN_CHAIR', 'COMPLETED', 'PAID'] }, startedAt: { gte: dayStart, lte: todayEnd } },
      select: { patientType: true },
    }),
    prisma.receptionQueueItem.findMany({
      where: { assignedDoctorId: id, status: { in: ['IN_CHAIR', 'COMPLETED', 'PAID'] }, startedAt: { gte: weekStart, lte: todayEnd } },
      select: { patientType: true },
    }),
    prisma.receptionQueueItem.findMany({
      where: { assignedDoctorId: id, status: { in: ['IN_CHAIR', 'COMPLETED', 'PAID'] }, startedAt: { gte: monthStart, lte: todayEnd } },
      select: { patientType: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: monthStart, lte: todayEnd } },
      select: {
        amountCents: true,
        amount: true,
        invoice: { select: { visitInvoices: { select: { visit: { select: { doctorId: true } } } } } },
      },
    }),
    prisma.visit.findMany({
      where: { doctorId: id },
      include: { patient: { select: { firstName: true, lastName: true, patientNumber: true } } },
      orderBy: { visitDate: 'desc' },
      take: 10,
    }),
  ]) : [[], [], [], [], []]

  const dayStats = summarizePatients(dayQueueItems)
  const weekStats = summarizePatients(weekQueueItems)
  const monthStats = summarizePatients(monthQueueItems)
  const collectionsCents = doctorPayments.reduce((sum, payment) => {
    const doctorId = payment.invoice.visitInvoices[0]?.visit.doctorId
    if (doctorId !== id) return sum
    return sum + (payment.amountCents || Math.round(payment.amount * 100))
  }, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/staff-profile" className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700">
            <ArrowLeft className="h-4 w-4" />
            Staff profile
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{staff.name}</h1>
          <p className="mt-1 text-base text-gray-500">{staff.role.replace('_', ' ')} - {staff.email}</p>
        </div>
        <span className={cn(
          'rounded-full px-3 py-1.5 text-sm font-bold',
          isDoctor ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
        )}>
          {staff.role.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Fixed monthly salary" value={currentContract ? formatCents(currentContract.baseSalaryCents) : 'Not set'} icon={BriefcaseBusiness} tone="blue" />
        <SummaryCard label="This month salary" value={monthSalary ? formatCents(monthSalary.netCents) : 'No record'} icon={Wallet} tone={monthSalary?.paidAt ? 'green' : 'amber'} />
        <SummaryCard label={isDoctor ? 'Patients this week' : 'Salary records'} value={isDoctor ? weekStats.total.toLocaleString() : staff.salaryRecords.length.toLocaleString()} icon={Users} tone="purple" />
        <SummaryCard label={isDoctor ? 'Collections this month' : 'Joined'} value={isDoctor ? formatCents(collectionsCents) : formatDate(staff.createdAt)} icon={TrendingUp} tone="green" />
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Fixed monthly salary</h2>
          </div>
        </div>
        <div className="section-card-body">
          <StaffContractForm
            userId={staff.id}
            currentBaseSalaryCents={currentContract?.baseSalaryCents}
            currentTitle={currentContract?.title}
          />
        </div>
      </div>

      {isDoctor && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <DoctorStatsPanel title="Today" stats={dayStats} />
          <DoctorStatsPanel title="This week" stats={weekStats} />
          <DoctorStatsPanel title="This month" stats={monthStats} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">Salary transactions</h2>
            </div>
          </div>
          <div className="section-card-body">
            <SalaryRecordsTable records={staff.salaryRecords} />
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">Contract history</h2>
            </div>
          </div>
          <div className="section-card-body">
            <ContractHistory contracts={staff.contracts} />
          </div>
        </div>
      </div>

      {isDoctor && (
        <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">Recent patient visits</h2>
            </div>
          </div>
          <div className="section-card-body">
            <RecentVisits visits={recentVisits} />
          </div>
        </div>
      )}
    </div>
  )
}

function summarizePatients(items: { patientType: string }[]) {
  return items.reduce((acc, item) => {
    acc.total += 1
    if (item.patientType === 'NEW') acc.newPatients += 1
    else if (item.patientType === 'EXISTING') acc.existingPatients += 1
    else acc.unknownPatients += 1
    return acc
  }, { total: 0, newPatients: 0, existingPatients: 0, unknownPatients: 0 })
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <div className="stat-card">
      <div className="mb-3 flex items-start justify-between">
        <p className="stat-card-label">{label}</p>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', colors[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function DoctorStatsPanel({ title, stats }: { title: string; stats: ReturnType<typeof summarizePatients> }) {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
      </div>
      <div className="section-card-body">
        <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{stats.newPatients} new</span>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">{stats.existingPatients} existing</span>
          {stats.unknownPatients > 0 && <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600">{stats.unknownPatients} unknown</span>}
        </div>
      </div>
    </div>
  )
}

function SalaryRecordsTable({ records }: { records: any[] }) {
  if (!records.length) return <p className="py-8 text-center text-gray-400">No salary transactions recorded</p>
  return (
    <div className="divide-y divide-gray-100">
      {records.map(record => (
        <div key={record.id} className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="font-bold text-gray-900">{record.periodMonth}/{record.periodYear}</p>
            <p className="text-sm font-medium text-gray-500">{record.paidAt ? `Paid ${formatDate(record.paidAt)}` : 'Unpaid'}</p>
            {record.notes && <p className="text-xs font-medium text-gray-400">{record.notes}</p>}
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-900">{formatCents(record.netCents)}</p>
            <p className="text-xs font-medium text-gray-400">Base {formatCents(record.baseCents)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function ContractHistory({ contracts }: { contracts: any[] }) {
  if (!contracts.length) return <p className="py-8 text-center text-gray-400">No fixed salary has been set yet</p>
  return (
    <div className="divide-y divide-gray-100">
      {contracts.map(contract => (
        <div key={contract.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-gray-900">{contract.title}</p>
              <p className="text-sm font-medium text-gray-500">
                {formatDate(contract.startDate)} - {contract.endDate ? formatDate(contract.endDate) : 'Current'}
              </p>
              {contract.notes && <p className="text-xs font-medium text-gray-400">{contract.notes}</p>}
            </div>
            <p className="font-bold text-blue-700">{formatCents(contract.baseSalaryCents)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function RecentVisits({ visits }: { visits: any[] }) {
  if (!visits.length) return <p className="py-8 text-center text-gray-400">No visits recorded for this doctor</p>
  return (
    <div className="divide-y divide-gray-100">
      {visits.map(visit => (
        <div key={visit.id} className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="font-bold text-gray-900">{visit.patient.firstName} {visit.patient.lastName}</p>
            <p className="text-sm font-medium text-gray-500">{visit.patient.patientNumber} - {visit.visitNumber}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-900">{formatDate(visit.visitDate)}</p>
            <p className="text-xs font-bold text-blue-600">{visit.status.replace('_', ' ')}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

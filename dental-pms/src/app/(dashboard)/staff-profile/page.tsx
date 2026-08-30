import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { can } from '@/lib/permissions'
import { formatCents } from '@/lib/money'
import { cn } from '@/lib/utils'
import { BriefcaseBusiness, ChevronRight, Stethoscope, Users, Wallet } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Staff Profile' }
export const dynamic = 'force-dynamic'

export default async function StaffProfilePage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'finance.admin')) redirect('/dashboard')

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  monthStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const [staff, monthSalaryRecords, monthDoctorQueueItems, doctorPayments] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: { not: 'ADMIN' } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        contracts: {
          where: { endDate: null },
          orderBy: { startDate: 'desc' },
          take: 1,
          select: { title: true, baseSalaryCents: true },
        },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }),
    prisma.salaryRecord.findMany({
      where: { periodYear: today.getFullYear(), periodMonth: today.getMonth() + 1 },
      include: { user: { select: { id: true, name: true, role: true } } },
    }),
    prisma.receptionQueueItem.findMany({
      where: {
        assignedDoctorId: { not: null },
        status: { in: ['IN_CHAIR', 'COMPLETED', 'PAID'] },
        startedAt: { gte: monthStart, lte: todayEnd },
      },
      select: { assignedDoctorId: true, patientType: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: monthStart, lte: todayEnd } },
      select: {
        amountCents: true,
        amount: true,
        invoice: {
          select: {
            visitInvoices: {
              select: { visit: { select: { doctorId: true } } },
            },
          },
        },
      },
    }),
  ])

  const salaryByStaff = new Map<string, { paidCents: number; unpaidCents: number; records: number }>()
  for (const record of monthSalaryRecords) {
    const current = salaryByStaff.get(record.userId) ?? { paidCents: 0, unpaidCents: 0, records: 0 }
    current.records += 1
    if (record.paidAt) current.paidCents += record.netCents
    else current.unpaidCents += record.netCents
    salaryByStaff.set(record.userId, current)
  }

  const patientsByDoctor = new Map<string, { total: number; newPatients: number; existingPatients: number; unknownPatients: number }>()
  for (const item of monthDoctorQueueItems) {
    if (!item.assignedDoctorId) continue
    const current = patientsByDoctor.get(item.assignedDoctorId) ?? { total: 0, newPatients: 0, existingPatients: 0, unknownPatients: 0 }
    current.total += 1
    if (item.patientType === 'NEW') current.newPatients += 1
    else if (item.patientType === 'EXISTING') current.existingPatients += 1
    else current.unknownPatients += 1
    patientsByDoctor.set(item.assignedDoctorId, current)
  }

  const collectionsByDoctor = new Map<string, number>()
  for (const payment of doctorPayments) {
    const doctorId = payment.invoice.visitInvoices[0]?.visit.doctorId
    if (!doctorId) continue
    collectionsByDoctor.set(doctorId, (collectionsByDoctor.get(doctorId) ?? 0) + (payment.amountCents || Math.round(payment.amount * 100)))
  }

  const staffStats = staff.map(person => {
    const salary = salaryByStaff.get(person.id) ?? { paidCents: 0, unpaidCents: 0, records: 0 }
    const patients = patientsByDoctor.get(person.id) ?? { total: 0, newPatients: 0, existingPatients: 0, unknownPatients: 0 }
    return {
      ...person,
      isDoctor: person.role === 'DOCTOR',
      salaryPaidCents: salary.paidCents,
      salaryUnpaidCents: salary.unpaidCents,
      salaryRecords: salary.records,
      fixedSalaryCents: person.contracts[0]?.baseSalaryCents ?? 0,
      fixedSalaryTitle: person.contracts[0]?.title ?? null,
      patientTotal: patients.total,
      newPatients: patients.newPatients,
      existingPatients: patients.existingPatients,
      unknownPatients: patients.unknownPatients,
      collectionsCents: collectionsByDoctor.get(person.id) ?? 0,
    }
  })

  const totals = staffStats.reduce((acc, item) => {
    acc.salaryPaidCents += item.salaryPaidCents
    acc.salaryUnpaidCents += item.salaryUnpaidCents
    acc.fixedSalaryCents += item.fixedSalaryCents
    acc.patientTotal += item.patientTotal
    acc.collectionsCents += item.collectionsCents
    return acc
  }, { salaryPaidCents: 0, salaryUnpaidCents: 0, fixedSalaryCents: 0, patientTotal: 0, collectionsCents: 0 })

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Staff Profile</h1>
        <p className="mt-1 text-base text-gray-500">Monthly staff cost, salary transactions, and doctor patient productivity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Fixed monthly payroll" value={formatCents(totals.fixedSalaryCents)} icon={BriefcaseBusiness} tone="blue" />
        <SummaryCard label="Salary paid" value={formatCents(totals.salaryPaidCents)} icon={Wallet} tone="green" />
        <SummaryCard label="Salary unpaid" value={formatCents(totals.salaryUnpaidCents)} icon={BriefcaseBusiness} tone="amber" />
        <SummaryCard label="Doctor patients" value={totals.patientTotal.toLocaleString()} icon={Users} tone="blue" />
        <SummaryCard label="Doctor collections" value={formatCents(totals.collectionsCents)} icon={Stethoscope} tone="purple" />
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <h2 className="text-lg font-semibold text-gray-900">Staff stats this month</h2>
        </div>
        <div className="section-card-body">
          <StaffStatsTable items={staffStats} />
        </div>
      </div>
    </div>
  )
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

function StaffStatsTable({ items }: { items: any[] }) {
  if (!items.length) return <p className="py-8 text-center text-gray-400">No active staff members</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base">
        <thead>
          <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
            <th className="pb-3 pr-4 font-semibold">Staff</th>
            <th className="pb-3 pr-4 font-semibold">Role</th>
            <th className="pb-3 pr-4 font-semibold">Fixed salary</th>
            <th className="pb-3 pr-4 font-semibold">Salary paid</th>
            <th className="pb-3 pr-4 font-semibold">Salary unpaid</th>
            <th className="pb-3 pr-4 font-semibold">Patients</th>
            <th className="pb-3 pr-4 font-semibold">New / existing</th>
            <th className="pb-3 pr-4 font-semibold">Collections</th>
            <th className="pb-3 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <td className="py-3 pr-4">
                <p className="font-bold text-gray-900">{item.name}</p>
                <p className="text-xs font-medium text-gray-400">{item.email}</p>
                <p className="text-xs font-medium text-gray-400">
                  {item.salaryRecords ? `${item.salaryRecords} salary record${item.salaryRecords !== 1 ? 's' : ''}` : 'No salary record this month'}
                </p>
              </td>
              <td className="py-3 pr-4">
                <span className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-bold',
                  item.isDoctor ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                )}>
                  {item.role.replace('_', ' ')}
                </span>
              </td>
              <td className="py-3 pr-4">
                {item.fixedSalaryCents > 0 ? (
                  <>
                    <p className="font-bold text-gray-900">{formatCents(item.fixedSalaryCents)}</p>
                    <p className="text-xs font-medium text-gray-400">{item.fixedSalaryTitle}</p>
                  </>
                ) : (
                  <span className="text-sm font-medium text-amber-600">Not set</span>
                )}
              </td>
              <td className="py-3 pr-4 font-semibold text-green-700">{formatCents(item.salaryPaidCents)}</td>
              <td className={cn('py-3 pr-4 font-semibold', item.salaryUnpaidCents > 0 ? 'text-amber-700' : 'text-gray-400')}>
                {formatCents(item.salaryUnpaidCents)}
              </td>
              <td className="py-3 pr-4">
                {item.isDoctor ? <span className="font-bold text-gray-900">{item.patientTotal}</span> : <span className="text-sm font-medium text-gray-400">Salary only</span>}
              </td>
              <td className="py-3 pr-4">
                {item.isDoctor ? (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{item.newPatients} new</span>
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">{item.existingPatients} existing</span>
                    {item.unknownPatients > 0 && <span className="rounded-full bg-gray-50 px-2 py-0.5 text-xs font-bold text-gray-600">{item.unknownPatients} unknown</span>}
                  </div>
                ) : (
                  <span className="text-sm font-medium text-gray-400">-</span>
                )}
              </td>
              <td className="py-3 pr-4">
                {item.isDoctor ? <span className="font-bold text-blue-700">{formatCents(item.collectionsCents)}</span> : <span className="text-sm font-medium text-gray-400">-</span>}
              </td>
              <td className="py-3">
                <Link href={`/staff-profile/${item.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700">
                  View <ChevronRight className="h-4 w-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

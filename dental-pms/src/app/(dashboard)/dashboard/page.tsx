import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Users, CalendarDays, Receipt, TrendingUp,
  UserPlus, Stethoscope, Clock, CheckCircle,
  AlertTriangle, ChevronRight, Activity, Package, BarChart3,
} from 'lucide-react'
import { formatLKR, formatDate, formatTime, getPatientDisplayName, cn, getClinicHour } from '@/lib/utils'
import type { Metadata } from 'next'
import { isDoctorRole, isReceptionRole, DOCTOR_ROLES } from '@/lib/permissions'
import { DoctorQueuePanel } from '@/components/queue/DoctorQueuePanel'
import { DoctorStatusPanel } from '@/components/queue/DoctorStatusPanel'
import { AdminDashboardClient } from '@/components/dashboard/AdminDashboardClient'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user  = session.user
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const isDoctor   = isDoctorRole(user.role)
  const isAdmin    = user.role === 'ADMIN'
  const isReception = isReceptionRole(user.role)
  // Plain NURSE matches none of the above (HEAD_NURSE is covered by isReception) —
  // without this the dashboard renders nothing but the greeting for a nurse.
  const isNurse    = user.role === 'NURSE'

  // Doctor home = their queue only. No stats, no menus, one job: see who's next.
  let doctorQueue: any[] = []
  let otherDoctors: { id: string; name: string }[] = []
  let doctorStats: any = null
  if (isDoctor) {
    const checkedStatuses = ['IN_CHAIR', 'COMPLETED', 'PAID']
    const [
      queueRows, doctors,
      todayTotal, todayNew, todayExisting,
      weekTotal, weekNew, weekExisting,
    ] = await Promise.all([
      prisma.receptionQueueItem.findMany({
          where: {
            status: { in: ['CHECKED_IN', 'ASSIGNED', 'IN_CHAIR'] },
            OR: [{ assignedDoctorId: null }, { assignedDoctorId: user.id }],
          },
        orderBy: [{ priority: 'desc' }, { queueNumber: 'asc' }, { arrivedAt: 'asc' }],
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
          intakeSubmission: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              reason: true,
              allergies: true,
              medicalWarnings: true,
            },
          },
          assignedDoctor: { select: { id: true, name: true } },
        },
      }),
      prisma.user.findMany({
        where: { isActive: true, role: { in: [...DOCTOR_ROLES] } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.receptionQueueItem.count({
        where: {
          assignedDoctorId: user.id,
          status: { in: checkedStatuses },
          startedAt: { gte: today, lte: todayEnd },
        },
      }),
      prisma.receptionQueueItem.count({
        where: {
          assignedDoctorId: user.id,
          status: { in: checkedStatuses },
          patientType: 'NEW',
          startedAt: { gte: today, lte: todayEnd },
        },
      }),
      prisma.receptionQueueItem.count({
        where: {
          assignedDoctorId: user.id,
          status: { in: checkedStatuses },
          patientType: 'EXISTING',
          startedAt: { gte: today, lte: todayEnd },
        },
      }),
      prisma.receptionQueueItem.count({
        where: {
          assignedDoctorId: user.id,
          status: { in: checkedStatuses },
          startedAt: { gte: weekStart, lte: todayEnd },
        },
      }),
      prisma.receptionQueueItem.count({
        where: {
          assignedDoctorId: user.id,
          status: { in: checkedStatuses },
          patientType: 'NEW',
          startedAt: { gte: weekStart, lte: todayEnd },
        },
      }),
      prisma.receptionQueueItem.count({
        where: {
          assignedDoctorId: user.id,
          status: { in: checkedStatuses },
          patientType: 'EXISTING',
          startedAt: { gte: weekStart, lte: todayEnd },
        },
      }),
    ])
    doctorQueue = queueRows
    otherDoctors = doctors
    doctorStats = {
      today: { total: todayTotal, new: todayNew, existing: todayExisting },
      week: { total: weekTotal, new: weekNew, existing: weekExisting },
    }
  }

  // ── ADMIN / CLINIC STATS ──────────────────────────────────────
  let adminDashboard: any = null
  let adminBranches: { id: string; name: string }[] = []
  let adminStaff: { id: string; name: string; role: string }[] = []
  let clinicStats: any = null
  if (isAdmin) {
    const [
      branches, staff, monthTransactions, monthQueueItems, monthVisits,
      monthDoctorQueueItems, doctorStatusEvents, invoiceItems, doctorPayments, recentSalaryRecords,
      monthSalaryRecords, unpaidSalaries, overdueInvoices, futureTreatmentPlans,
    ] = await Promise.all([
      prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } }),
      prisma.financialTransaction.findMany({
        where: { date: { gte: monthStart, lte: todayEnd } },
        include: { category: { select: { code: true, name: true, direction: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.receptionQueueItem.findMany({
        where: { arrivedAt: { gte: monthStart, lte: todayEnd } },
        select: { arrivedAt: true, patientType: true },
        orderBy: { arrivedAt: 'asc' },
      }),
      prisma.visit.findMany({
        where: { visitDate: { gte: monthStart, lte: todayEnd } },
        select: { toothFindings: true },
      }),
      prisma.receptionQueueItem.findMany({
        where: {
          assignedDoctorId: { not: null },
          status: { in: ['IN_CHAIR', 'COMPLETED', 'PAID'] },
          startedAt: { gte: monthStart, lte: todayEnd },
        },
        select: { assignedDoctorId: true, patientType: true, startedAt: true, finishedAt: true },
      }),
      prisma.doctorStatusEvent.findMany({
        where: { createdAt: { gte: monthStart, lte: todayEnd } },
        select: { doctorId: true, status: true, createdAt: true },
        orderBy: [{ doctorId: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.invoiceItem.findMany({
        where: {
          invoice: {
            createdAt: { gte: monthStart, lte: todayEnd },
            status: { notIn: ['DRAFT', 'CANCELLED', 'WRITTEN_OFF'] },
          },
        },
        select: { description: true, totalCents: true, total: true },
      }),
      prisma.payment.findMany({
        where: { paidAt: { gte: monthStart, lte: todayEnd } },
        select: {
          amountCents: true,
          amount: true,
          invoice: {
            select: {
              visitInvoices: {
                select: { visit: { select: { doctor: { select: { id: true, name: true } } } } },
              },
            },
          },
        },
      }),
      prisma.salaryRecord.findMany({
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        take: 8,
        include: { user: { select: { name: true, role: true } } },
      }),
      prisma.salaryRecord.findMany({
        where: { periodYear: today.getFullYear(), periodMonth: today.getMonth() + 1 },
        include: { user: { select: { id: true, name: true, role: true } } },
      }),
      prisma.salaryRecord.count({ where: { paidAt: null } }),
      prisma.invoice.count({ where: { status: 'OVERDUE' } }),
      prisma.treatmentPlan.findMany({
        where: {
          createdAt: { gte: monthStart, lte: todayEnd },
          status: 'PLANNED',
          items: { some: { status: 'PLANNED' } },
        },
        include: {
          patient: { select: { firstName: true, lastName: true, patientNumber: true } },
          createdBy: { select: { id: true, name: true } },
          items: {
            where: { status: 'PLANNED' },
            orderBy: [{ phase: 'asc' }, { sequence: 'asc' }],
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    const lowStockRows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM inventory_stock WHERE quantity <= "reorderThreshold"`
    const lowStockCount = Number(lowStockRows[0]?.count ?? 0)

    adminBranches = branches
    adminStaff = staff

    const revenueCents = monthTransactions.filter(tx => tx.direction === 'IN').reduce((sum, tx) => sum + tx.amountCents, 0)
    const expenseCents = monthTransactions.filter(tx => tx.direction === 'OUT').reduce((sum, tx) => sum + tx.amountCents, 0)

    const expenseByCategory = new Map<string, { label: string; cents: number }>()
    for (const tx of monthTransactions.filter(tx => tx.direction === 'OUT')) {
      const current = expenseByCategory.get(tx.category.code) ?? { label: tx.category.name, cents: 0 }
      current.cents += tx.amountCents
      expenseByCategory.set(tx.category.code, current)
    }

    const problemCounts = new Map<string, number>()
    for (const visit of monthVisits) {
      const findings = visit.toothFindings && typeof visit.toothFindings === 'object' ? visit.toothFindings as Record<string, any> : {}
      for (const value of Object.values(findings)) {
        if (!value?.selected || !value?.condition || value.condition === 'healthy') continue
        const label = String(value.condition).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())
        problemCounts.set(label, (problemCounts.get(label) ?? 0) + 1)
      }
    }

    const treatmentRevenue = new Map<string, number>()
    for (const item of invoiceItems) {
      const label = item.description || 'Unlabelled treatment'
      treatmentRevenue.set(label, (treatmentRevenue.get(label) ?? 0) + (item.totalCents || Math.round(item.total * 100)))
    }

    const doctorCollections = new Map<string, { label: string; cents: number }>()
    for (const payment of doctorPayments) {
      const doctor = payment.invoice.visitInvoices[0]?.visit.doctor
      const key = doctor?.id ?? 'unknown'
      const current = doctorCollections.get(key) ?? { label: doctor?.name ?? 'No doctor linked', cents: 0 }
      current.cents += payment.amountCents || Math.round(payment.amount * 100)
      doctorCollections.set(key, current)
    }

    const futureTreatmentRows = futureTreatmentPlans.map(plan => {
      const amountCents = plan.items.reduce(
        (sum, item) => sum + (item.patientEstCents || item.feeCents || Math.round((item.patientEst || item.fee) * 100)),
        0,
      )
      return {
        id: plan.id,
        date: plan.createdAt,
        patient: `${plan.patient.firstName} ${plan.patient.lastName}`,
        patientNo: plan.patient.patientNumber,
        doctor: plan.createdBy.name,
        plan: plan.title,
        procedures: plan.items.map(item => `${item.procedureName}${item.toothNumbers ? ` (T${item.toothNumbers})` : ''}`).join(', '),
        count: plan.items.length,
        amountCents,
      }
    })
    const futureTreatmentChargesCents = futureTreatmentRows.reduce((sum, row) => sum + row.amountCents, 0)

    const futureChargesByDoctor = new Map<string, { label: string; cents: number }>()
    for (const row of futureTreatmentRows) {
      const current = futureChargesByDoctor.get(row.doctor) ?? { label: row.doctor, cents: 0 }
      current.cents += row.amountCents
      futureChargesByDoctor.set(row.doctor, current)
    }

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

    const collectionsByDoctor = new Map([...doctorCollections.entries()].map(([id, value]) => [id, value.cents]))
    const staffStats = staff
      .filter(person => person.role !== 'ADMIN')
      .map(person => {
        const salary = salaryByStaff.get(person.id) ?? { paidCents: 0, unpaidCents: 0, records: 0 }
        const patients = patientsByDoctor.get(person.id) ?? { total: 0, newPatients: 0, existingPatients: 0, unknownPatients: 0 }
        return {
          id: person.id,
          name: person.name,
          role: person.role,
          isDoctor: person.role === 'DOCTOR',
          salaryPaidCents: salary.paidCents,
          salaryUnpaidCents: salary.unpaidCents,
          salaryRecords: salary.records,
          patientTotal: patients.total,
          newPatients: patients.newPatients,
          existingPatients: patients.existingPatients,
          unknownPatients: patients.unknownPatients,
          collectionsCents: collectionsByDoctor.get(person.id) ?? 0,
        }
      })

    adminDashboard = {
      finance: { revenueCents, expenseCents, profitCents: revenueCents - expenseCents, futureTreatmentChargesCents },
      patients: {
        arrivalsMonth: monthQueueItems.length,
        newMonth: monthQueueItems.filter(item => item.patientType === 'NEW').length,
        existingMonth: monthQueueItems.filter(item => item.patientType === 'EXISTING').length,
      },
      arrivalTrend: buildArrivalTrend(monthStart, todayEnd, monthQueueItems),
      expenseMix: [...expenseByCategory.values()].sort((a, b) => b.cents - a.cents),
      toothProblems: [...problemCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
      profitableTreatments: [...treatmentRevenue.entries()].map(([label, revenueCents]) => ({ label, revenueCents })).sort((a, b) => b.revenueCents - a.revenueCents),
      doctorCollections: [...doctorCollections.values()].sort((a, b) => b.cents - a.cents),
      futureTreatmentPlans: futureTreatmentRows,
      futureChargesByDoctor: [...futureChargesByDoctor.values()].sort((a, b) => b.cents - a.cents),
      doctorTimeStats: buildDoctorTimeStats(staff, doctorStatusEvents, monthDoctorQueueItems, todayEnd),
      staffStats,
      salaryRecords: JSON.parse(JSON.stringify(recentSalaryRecords)),
      risks: { overdueInvoices, lowStockCount, unpaidSalaries },
    }
  }

  // ── RECEPTION STATS ───────────────────────────────────────────
  let receptionStats: any = null
  if (isReception) {
    const [waitingLobby, paperPending, totalToday] = await Promise.all([
      prisma.receptionQueueItem.count({
        where: { status: { in: ['CHECKED_IN', 'ASSIGNED', 'IN_CHAIR'] } },
      }),
      prisma.receptionQueueItem.count({
        where: {
          status: { in: ['CHECKED_IN', 'ASSIGNED', 'IN_CHAIR'] },
          patientId: null,
        },
      }),
      prisma.receptionQueueItem.count({
        where: { arrivedAt: { gte: today, lte: todayEnd } },
      }),
    ])
    receptionStats = { waitingLobby, paperPending, totalToday }
  }

  let activeTreatments: any[] = []
  if (isReception || isNurse) {
    activeTreatments = await prisma.receptionQueueItem.findMany({
      where: { status: 'IN_CHAIR' },
      orderBy: [{ startedAt: 'desc' }, { queueNumber: 'asc' }],
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, preferredName: true, patientNumber: true } },
        intakeSubmission: { select: { firstName: true, lastName: true, patientNumber: true } },
        assignedDoctor: { select: { id: true, name: true } },
      },
    })
  }

  // Today's visits for everyone
  const todaysVisits = await prisma.visit.findMany({
    where: {
      visitDate: { gte: today, lte: todayEnd },
      ...(isDoctor ? { doctorId: user.id } : {}),
    },
    orderBy: { visitDate: 'desc' },
    take: 8,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
      doctor:  { select: { name: true } },
    },
  })

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    IN_PROGRESS:  { label: 'In treatment',  color: 'bg-amber-100 text-amber-800' },
    READY_TO_PAY: { label: 'Ready to pay',  color: 'bg-green-100 text-green-800' },
    COMPLETED:    { label: 'Completed',      color: 'bg-gray-100 text-gray-600' },
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Good {getClinicHour() < 12 ? 'morning' : getClinicHour() < 17 ? 'afternoon' : 'evening'},
          {' '}{user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-base text-gray-500 mt-1">{formatDate(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* ── DOCTOR HOME: QUEUE ONLY ──────────────────────────────── */}
      {isDoctor && (
        <>
          <DoctorStatusPanel currentUser={user} />
          <DoctorStatsPanel stats={doctorStats} />
          <DoctorQueuePanel
            initialQueue={JSON.parse(JSON.stringify(doctorQueue))}
            currentUser={user}
            doctors={otherDoctors}
          />
        </>
      )}

      {/* ── ADMIN DASHBOARD ──────────────────────────────────────── */}
      {isAdmin && adminDashboard && (
        <AdminDashboardClient
          data={adminDashboard}
          branches={adminBranches}
          staff={adminStaff}
        />
      )}

      {false && isAdmin && clinicStats && (
        <>
          {/* Alerts */}
          {clinicStats.lowStockCount > 0 && (
            <div className="flex flex-wrap gap-3">
              {clinicStats.lowStockCount > 0 && (
                <Link href="/inventory"
                  className="flex items-center gap-3 bg-orange-50 border-2 border-orange-300 rounded-xl px-5 py-3 hover:bg-orange-100 transition-colors">
                  <Package className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <p className="text-base font-semibold text-orange-900">
                    {clinicStats.lowStockCount} item{clinicStats.lowStockCount !== 1 ? 's' : ''} low on stock →
                  </p>
                </Link>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total patients"       value={clinicStats.totalPatients}     icon={Users}       color="blue"   sub={`+${clinicStats.newPatientsToday} today`} />
            <StatCard label="Visits today"         value={clinicStats.visitsToday}       icon={Stethoscope} color="teal"   sub={`${clinicStats.visitsMonth} this month`} />
            <StatCard label="Revenue today"        value={formatLKR(clinicStats.revenueToday)} icon={Receipt} color="green" sub={`${formatLKR(clinicStats.revenueMonth)} this month`} isString />
            <StatCard label="Overdue invoices"     value={clinicStats.overdueInvoices}   icon={AlertTriangle} color="red"  />
          </div>

          {/* Quick actions for admin — business functions only, never clinical */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: '/finance',         label: 'Finance',          icon: TrendingUp,  color: 'bg-blue-600 text-white' },
              { href: '/inventory',       label: 'Inventory',        icon: Package,     color: 'bg-white border-2 border-gray-200 text-gray-900' },
              { href: '/reports',         label: 'Reports',          icon: BarChart3,  color: 'bg-white border-2 border-gray-200 text-gray-900' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className={cn('flex items-center gap-3 p-4 rounded-2xl font-semibold text-base hover:opacity-90 transition-all', a.color)}>
                <a.icon className="w-5 h-5 flex-shrink-0" />
                {a.label}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── RECEPTION DASHBOARD ───────────────────────────────────── */}
      {isReception && receptionStats && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Waiting lobby"  value={receptionStats.waitingLobby} icon={Users}       color="amber" />
            <StatCard label="Paper pending"  value={receptionStats.paperPending} icon={UserPlus}    color="blue" />
            <StatCard label="Total today"    value={receptionStats.totalToday}   icon={Stethoscope} color="blue"  />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/queue"
              className="flex items-center gap-4 p-5 bg-blue-600 rounded-2xl text-white hover:bg-blue-700 transition-colors">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-lg font-bold">Reception queue</p>
                <p className="text-blue-100 text-sm">{receptionStats.waitingLobby} in lobby</p>
              </div>
              <ChevronRight className="w-5 h-5 ml-auto" />
            </Link>
            <Link href="/patients/new"
              className="flex items-center gap-4 p-5 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-400 transition-colors">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">Register patient</p>
                <p className="text-gray-500 text-sm">New patient walk-in</p>
              </div>
              <ChevronRight className="w-5 h-5 ml-auto text-gray-300" />
            </Link>
          </div>
        </>
      )}

      {/* ── NURSE HOME: QUICK ACTIONS ─────────────────────────────── */}
      {(isReception || isNurse) && (
        <CurrentTreatmentDashboardPanel
          items={JSON.parse(JSON.stringify(activeTreatments))}
          canAssist={isNurse}
        />
      )}

      {isNurse && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/diagnosis"
            className="flex items-center gap-4 p-5 bg-blue-600 rounded-2xl text-white hover:bg-blue-700 transition-colors">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <p className="text-lg font-bold">Diagnosis assist</p>
              <p className="text-blue-100 text-sm">Chart tooth findings for a patient in chair</p>
            </div>
            <ChevronRight className="w-5 h-5 ml-auto" />
          </Link>
          <Link href="/clinical/active"
            className="flex items-center gap-4 p-5 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-400 transition-colors">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">Active visits</p>
              <p className="text-gray-500 text-sm">Scribe notes while the doctor treats</p>
            </div>
            <ChevronRight className="w-5 h-5 ml-auto text-gray-300" />
          </Link>
          <Link href="/patients/new"
            className="flex items-center gap-4 p-5 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-400 transition-colors">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">Register patient</p>
              <p className="text-gray-500 text-sm">New patient walk-in</p>
            </div>
            <ChevronRight className="w-5 h-5 ml-auto text-gray-300" />
          </Link>
          <Link href="/clinical"
            className="flex items-center gap-4 p-5 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-400 transition-colors">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">Clinical notes</p>
              <p className="text-gray-500 text-sm">Add notes or treatment plans</p>
            </div>
            <ChevronRight className="w-5 h-5 ml-auto text-gray-300" />
          </Link>
        </div>
      )}

      {/* ── TODAY'S VISITS (admin/reception/nurse — doctor home is queue-only) ── */}
      {(isReception || isNurse) && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="text-lg font-semibold text-gray-900">Today's visits</h2>
          </div>

          {todaysVisits.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Stethoscope className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-base">No visits recorded today yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {todaysVisits.map(visit => {
                const cfg = STATUS_CONFIG[visit.status] ?? STATUS_CONFIG.IN_PROGRESS
                return (
                  <Link
                    key={visit.id}
                    href={`/visits/${visit.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-14 text-center flex-shrink-0">
                      <p className="text-base font-bold text-gray-900">{formatTime(visit.visitDate)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-gray-900">
                        {getPatientDisplayName(visit.patient)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {visit.patient.patientNumber} · Dr. {visit.doctor.name}
                      </p>
                    </div>
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0', cfg.color)}>
                      {cfg.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function dashboardQueueName(item: any) {
  if (item.patient) return getPatientDisplayName(item.patient)
  if (item.displayName) return item.displayName
  const intakeName = [item.intakeSubmission?.firstName, item.intakeSubmission?.lastName].filter(Boolean).join(' ')
  return intakeName || `Token ${item.queueNumber}`
}

function CurrentTreatmentDashboardPanel({ items, canAssist }: { items: any[]; canAssist: boolean }) {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">In treatment now</h2>
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-bold text-green-700">{items.length}</span>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-gray-400">No patients are currently in chair</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map(item => (
            <div key={item.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-lg font-bold text-gray-900">{dashboardQueueName(item)}</p>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                    In chair
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Token {item.queueNumber}
                  {item.patient?.patientNumber ? ` - ${item.patient.patientNumber}` : ''}
                  {item.assignedDoctor?.name ? ` - Dr. ${item.assignedDoctor.name}` : ' - Doctor not assigned'}
                  {item.startedAt ? ` - started ${formatTime(item.startedAt)}` : ''}
                </p>
              </div>
              {canAssist ? (
                <Link href={`/diagnosis?queueId=${item.id}`} className="btn-primary justify-center !px-4 !py-2.5">
                  <Stethoscope className="h-4 w-4" />
                  Assist
                </Link>
              ) : (
                <Link href="/queue" className="btn-secondary justify-center !px-4 !py-2.5">
                  View queue
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, sub, isString }: {
  label: string; value: number | string; icon: any
  color: string; sub?: string; isString?: boolean
}) {
  const COLORS: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600', teal: 'bg-teal-100 text-teal-600',
    purple: 'bg-purple-100 text-purple-600', amber: 'bg-amber-100 text-amber-600',
    green: 'bg-green-100 text-green-600', red: 'bg-red-100 text-red-600',
  }
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <p className="stat-card-label">{label}</p>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', COLORS[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className={cn('font-bold text-gray-900', isString ? 'text-xl' : 'text-3xl')}>{value}</p>
      {sub && <p className="stat-card-sub mt-1">{sub}</p>}
    </div>
  )
}

function buildArrivalTrend(start: Date, end: Date, rows: { arrivedAt: Date; patientType: string }[]) {
  const days: Record<string, { label: string; new: number; existing: number }> = {}
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    days[key] = {
      label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      new: 0,
      existing: 0,
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  for (const row of rows) {
    const key = row.arrivedAt.toISOString().slice(0, 10)
    days[key] ??= {
      label: row.arrivedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      new: 0,
      existing: 0,
    }
    if (row.patientType === 'NEW') days[key].new += 1
    else if (row.patientType === 'EXISTING') days[key].existing += 1
  }

  return Object.values(days).slice(-14)
}

function buildDoctorTimeStats(
  staff: { id: string; name: string; role: string }[],
  events: { doctorId: string; status: string; createdAt: Date }[],
  queueItems: { assignedDoctorId: string | null; startedAt: Date | null; finishedAt: Date | null }[],
  end: Date
) {
  const doctorRows = staff.filter(person => person.role === 'DOCTOR')
  return doctorRows.map(doctor => {
    const doctorEvents = events
      .filter(event => event.doctorId === doctor.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    let workingMs = 0
    let breakMs = 0
    let withPatientMs = 0
    for (let i = 0; i < doctorEvents.length; i++) {
      const event = doctorEvents[i]
      const nextAt = doctorEvents[i + 1]?.createdAt ?? end
      const duration = Math.max(0, nextAt.getTime() - event.createdAt.getTime())
      if (['READY', 'WITH_PATIENT'].includes(event.status)) workingMs += duration
      if (event.status === 'WITH_PATIENT') withPatientMs += duration
      if (event.status === 'SHORT_BREAK') breakMs += duration
    }

    const treatedItems = queueItems.filter(item => item.assignedDoctorId === doctor.id && item.startedAt)
    const completedDurations = treatedItems
      .filter(item => item.startedAt && item.finishedAt)
      .map(item => Math.max(0, item.finishedAt!.getTime() - item.startedAt!.getTime()))
    const avgPatientMs = completedDurations.length
      ? Math.round(completedDurations.reduce((sum, ms) => sum + ms, 0) / completedDurations.length)
      : 0

    return {
      id: doctor.id,
      name: doctor.name,
      workingMs,
      breakMs,
      withPatientMs,
      patientCount: treatedItems.length,
      completedPatientCount: completedDurations.length,
      avgPatientMs,
    }
  })
}

function DoctorStatsPanel({ stats }: { stats: any }) {
  const todayUnknown = Math.max(0, (stats?.today?.total ?? 0) - (stats?.today?.new ?? 0) - (stats?.today?.existing ?? 0))
  const weekUnknown = Math.max(0, (stats?.week?.total ?? 0) - (stats?.week?.new ?? 0) - (stats?.week?.existing ?? 0))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DoctorPatientStatCard
        title="Checked today"
        total={stats?.today?.total ?? 0}
        newCount={stats?.today?.new ?? 0}
        existingCount={stats?.today?.existing ?? 0}
        unknownCount={todayUnknown}
        accent="blue"
      />
      <DoctorPatientStatCard
        title="Checked this week"
        total={stats?.week?.total ?? 0}
        newCount={stats?.week?.new ?? 0}
        existingCount={stats?.week?.existing ?? 0}
        unknownCount={weekUnknown}
        accent="teal"
      />
    </div>
  )
}

function DoctorPatientStatCard({
  title, total, newCount, existingCount, unknownCount, accent,
}: {
  title: string
  total: number
  newCount: number
  existingCount: number
  unknownCount: number
  accent: 'blue' | 'teal'
}) {
  const iconClass = accent === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-teal-100 text-teal-600'

  return (
    <div className="stat-card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="stat-card-label">{title}</p>
          <p className="mt-1 text-4xl font-bold text-gray-900">{total}</p>
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', iconClass)}>
          <Stethoscope className="h-5 w-5" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-blue-50 px-3 py-2">
          <p className="text-xs font-semibold text-blue-600">New</p>
          <p className="text-xl font-bold text-blue-900">{newCount}</p>
        </div>
        <div className="rounded-xl bg-green-50 px-3 py-2">
          <p className="text-xs font-semibold text-green-600">Existing</p>
          <p className="text-xl font-bold text-green-900">{existingCount}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-xs font-semibold text-gray-500">Unknown</p>
          <p className="text-xl font-bold text-gray-800">{unknownCount}</p>
        </div>
      </div>
    </div>
  )
}

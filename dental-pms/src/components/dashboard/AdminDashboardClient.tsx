'use client'

import { useState } from 'react'
import type React from 'react'
import {
  Activity, AlertTriangle, Banknote, BarChart3, BriefcaseBusiness,
  ClipboardList, Clock, Package, Plus, Receipt, RefreshCw, TrendingDown,
  TrendingUp, Users,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { formatCents } from '@/lib/money'
import { showToast } from '@/components/ui/Toast'

const EXPENSE_CATEGORIES = [
  { code: 'RENT', label: 'Rent' },
  { code: 'LAB_FEE', label: 'Lab fee' },
  { code: 'SUPPLIES', label: 'Raw materials / supplies' },
  { code: 'OTHER_EXPENSE', label: 'Other expense' },
]

export function AdminDashboardClient({
  data, branches, staff,
}: {
  data: any
  branches: { id: string; name: string }[]
  staff: { id: string; name: string; role: string }[]
}) {
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('SUPPLIES')
  const [expenseBranchId, setExpenseBranchId] = useState(branches[0]?.id ?? '')
  const [expenseNote, setExpenseNote] = useState('')
  const [expenseSaving, setExpenseSaving] = useState(false)

  const now = new Date()
  const [salaryUserId, setSalaryUserId] = useState(staff[0]?.id ?? '')
  const [salaryBranchId, setSalaryBranchId] = useState(branches[0]?.id ?? '')
  const [salaryYear, setSalaryYear] = useState(now.getFullYear())
  const [salaryMonth, setSalaryMonth] = useState(now.getMonth() + 1)
  const [salaryBase, setSalaryBase] = useState('')
  const [salaryAllowances, setSalaryAllowances] = useState('')
  const [salaryDeductions, setSalaryDeductions] = useState('')
  const [salaryNote, setSalaryNote] = useState('')
  const [salaryPayNow, setSalaryPayNow] = useState(true)
  const [salarySaving, setSalarySaving] = useState(false)

  async function addExpense() {
    const amount = Number(expenseAmount)
    if (!amount || amount <= 0) {
      showToast('error', 'Enter a valid expense amount')
      return
    }
    if (!expenseBranchId) {
      showToast('error', 'Choose a branch')
      return
    }

    setExpenseSaving(true)
    try {
      const res = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          category: expenseCategory,
          branchId: expenseBranchId,
          notes: expenseNote || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not record expense')
      showToast('success', 'Expense recorded')
      setExpenseAmount('')
      setExpenseNote('')
      window.location.reload()
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setExpenseSaving(false)
    }
  }

  async function addSalary() {
    if (!salaryUserId || !salaryBranchId) {
      showToast('error', 'Choose staff member and branch')
      return
    }
    const base = Number(salaryBase)
    if (!base || base <= 0) {
      showToast('error', 'Enter the base salary')
      return
    }

    setSalarySaving(true)
    try {
      const res = await fetch('/api/salaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: salaryUserId,
          periodYear: Number(salaryYear),
          periodMonth: Number(salaryMonth),
          base,
          allowances: Number(salaryAllowances || 0),
          deductions: Number(salaryDeductions || 0),
          notes: salaryNote || null,
        }),
      })
      const record = await res.json()
      if (!res.ok) throw new Error(record.error ?? 'Could not create salary record')

      if (salaryPayNow) {
        const payRes = await fetch(`/api/salaries/${record.id}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branchId: salaryBranchId }),
        })
        const payJson = await payRes.json()
        if (!payRes.ok) throw new Error(payJson.error ?? 'Salary created, but could not mark as paid')
      }

      showToast('success', salaryPayNow ? 'Salary recorded and paid' : 'Salary record created')
      setSalaryBase('')
      setSalaryAllowances('')
      setSalaryDeductions('')
      setSalaryNote('')
      window.location.reload()
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSalarySaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <MetricCard title="Revenue this month" value={formatCents(data.finance.revenueCents)} icon={TrendingUp} tone="green" />
        <MetricCard title="Expenses this month" value={formatCents(data.finance.expenseCents)} icon={TrendingDown} tone="red" />
        <MetricCard title="Net profit" value={formatCents(data.finance.profitCents)} icon={Banknote} tone={data.finance.profitCents >= 0 ? 'blue' : 'red'} />
        <MetricCard title="Future treatment charges" value={formatCents(data.finance.futureTreatmentChargesCents ?? 0)} icon={ClipboardList} tone="indigo" sub="Planned, not receivable yet" />
        <MetricCard title="Patient arrivals" value={data.patients.arrivalsMonth.toLocaleString()} icon={Users} tone="amber" sub={`${data.patients.newMonth} new, ${data.patients.existingMonth} existing`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Patient arrivals" icon={Users} className="xl:col-span-2">
          <StackedBars data={data.arrivalTrend} firstKey="new" secondKey="existing" firstLabel="New" secondLabel="Existing" />
        </Panel>
        <Panel title="Monthly expense mix" icon={Receipt}>
          <DonutLegend items={data.expenseMix} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Frequent teeth problems" icon={Activity}>
          <RankedBars items={data.toothProblems} valueKey="count" tone="red" empty="No tooth findings recorded this month" />
        </Panel>
        <Panel title="Most profitable treatments" icon={BarChart3}>
          <RankedBars items={data.profitableTreatments} valueKey="revenueCents" money tone="green" empty="No treatment revenue this month" />
        </Panel>
        <Panel title="Doctor collections" icon={BriefcaseBusiness}>
          <RankedBars items={data.doctorCollections} valueKey="cents" money tone="blue" empty="No collections this month" />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Future treatment charges" icon={ClipboardList} className="xl:col-span-2">
          <FutureTreatmentTable rows={data.futureTreatmentPlans ?? []} />
        </Panel>
        <Panel title="Future charges by doctor" icon={BriefcaseBusiness}>
          <RankedBars items={data.futureChargesByDoctor ?? []} valueKey="cents" money tone="blue" empty="No planned future treatment charges this month" />
        </Panel>
      </div>

      <Panel title="Doctor working time and patient speed" icon={Clock}>
        <DoctorTimeTable rows={data.doctorTimeStats ?? []} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Record expense / raw material cost" icon={Package}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount (Rs)">
              <input value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} type="number" min="0" className="form-input" placeholder="25000" />
            </Field>
            <Field label="Category">
              <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className="form-input">
                {EXPENSE_CATEGORIES.map(category => <option key={category.code} value={category.code}>{category.label}</option>)}
              </select>
            </Field>
            <Field label="Branch">
              <select value={expenseBranchId} onChange={e => setExpenseBranchId(e.target.value)} className="form-input">
                {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </Field>
            <Field label="Note">
              <input value={expenseNote} onChange={e => setExpenseNote(e.target.value)} className="form-input" placeholder="Composite, gloves, July rent..." />
            </Field>
          </div>
          <button onClick={addExpense} disabled={expenseSaving} className="btn-primary mt-4 w-full justify-center">
            <Plus className="h-4 w-4" />
            {expenseSaving ? 'Recording...' : 'Record expense'}
          </button>
        </Panel>

        <Panel title="Add staff salary" icon={BriefcaseBusiness}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Staff member">
              <select value={salaryUserId} onChange={e => setSalaryUserId(e.target.value)} className="form-input">
                {staff.map(user => <option key={user.id} value={user.id}>{user.name} - {user.role}</option>)}
              </select>
            </Field>
            <Field label="Branch paid from">
              <select value={salaryBranchId} onChange={e => setSalaryBranchId(e.target.value)} className="form-input">
                {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </Field>
            <Field label="Year">
              <input value={salaryYear} onChange={e => setSalaryYear(Number(e.target.value))} type="number" className="form-input" />
            </Field>
            <Field label="Month">
              <input value={salaryMonth} onChange={e => setSalaryMonth(Number(e.target.value))} type="number" min="1" max="12" className="form-input" />
            </Field>
            <Field label="Base salary">
              <input value={salaryBase} onChange={e => setSalaryBase(e.target.value)} type="number" min="0" className="form-input" placeholder="75000" />
            </Field>
            <Field label="Allowances">
              <input value={salaryAllowances} onChange={e => setSalaryAllowances(e.target.value)} type="number" min="0" className="form-input" placeholder="0" />
            </Field>
            <Field label="Deductions">
              <input value={salaryDeductions} onChange={e => setSalaryDeductions(e.target.value)} type="number" min="0" className="form-input" placeholder="0" />
            </Field>
            <Field label="Note">
              <input value={salaryNote} onChange={e => setSalaryNote(e.target.value)} className="form-input" placeholder="July salary" />
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input type="checkbox" checked={salaryPayNow} onChange={e => setSalaryPayNow(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Mark as paid and include in monthly expenses now
          </label>
          <button onClick={addSalary} disabled={salarySaving} className="btn-primary mt-4 w-full justify-center">
            <Plus className="h-4 w-4" />
            {salarySaving ? 'Saving...' : 'Save salary'}
          </button>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Outstanding risks" icon={AlertTriangle}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <RiskBox label="Overdue invoices" value={data.risks.overdueInvoices} tone="red" />
            <RiskBox label="Low stock items" value={data.risks.lowStockCount} tone="amber" />
            <RiskBox label="Unpaid salaries" value={data.risks.unpaidSalaries} tone="blue" />
          </div>
        </Panel>
        <Panel title="Recent salaries" icon={ClipboardList}>
          <SimpleList
            items={data.salaryRecords}
            empty="No salary records yet"
            render={(record: any) => (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{record.user.name}</p>
                  <p className="text-sm text-gray-500">{record.periodMonth}/{record.periodYear} - {record.paidAt ? `Paid ${formatDate(record.paidAt)}` : 'Unpaid'}</p>
                </div>
                <p className={cn('font-bold', record.paidAt ? 'text-green-700' : 'text-amber-700')}>{formatCents(record.netCents)}</p>
              </div>
            )}
          />
        </Panel>
      </div>
    </div>
  )
}

function formatDuration(ms: number) {
  if (!ms) return '0m'
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

function DoctorTimeTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <p className="py-8 text-center text-gray-400">No doctor timing data yet</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-3">Doctor</th>
            <th className="py-2 pr-3">Working</th>
            <th className="py-2 pr-3">With patients</th>
            <th className="py-2 pr-3">Break</th>
            <th className="py-2 pr-3">Patients</th>
            <th className="py-2 pr-3">Avg patient time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(row => (
            <tr key={row.id}>
              <td className="py-3 pr-3 font-semibold text-gray-900">{row.name}</td>
              <td className="py-3 pr-3 font-bold text-blue-700">{formatDuration(row.workingMs)}</td>
              <td className="py-3 pr-3 text-gray-700">{formatDuration(row.withPatientMs)}</td>
              <td className="py-3 pr-3 text-amber-700">{formatDuration(row.breakMs)}</td>
              <td className="py-3 pr-3 text-gray-700">{row.patientCount}</td>
              <td className="py-3 pr-3 font-bold text-gray-900">
                {row.completedPatientCount ? formatDuration(row.avgPatientMs) : 'Pending'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FutureTreatmentTable({ rows }: { rows: any[] }) {
  if (!rows.length) {
    return (
      <div className="py-8 text-center text-gray-400">
        <ClipboardList className="mx-auto mb-2 h-10 w-10 text-gray-300" />
        <p>No planned future treatment charges this month</p>
      </div>
    )
  }

  const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0)

  return (
    <div>
      <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
        These are planned treatment values only. They are not included in revenue, profit, overdue invoices, or receivables until the treatment is completed and billed.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Patient</th>
              <th className="py-2 pr-3">Doctor</th>
              <th className="py-2 pr-3">Pending procedures</th>
              <th className="py-2 text-right">Future charge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.slice(0, 8).map(row => (
              <tr key={row.id}>
                <td className="py-3 pr-3 whitespace-nowrap text-gray-500">{formatDate(row.date)}</td>
                <td className="py-3 pr-3">
                  <p className="font-semibold text-gray-900">{row.patient}</p>
                  <p className="font-mono text-xs text-gray-400">{row.patientNo}</p>
                </td>
                <td className="py-3 pr-3 text-gray-700">{row.doctor}</td>
                <td className="py-3 pr-3">
                  <p className="max-w-[340px] truncate font-medium text-gray-800">{row.procedures}</p>
                  <p className="text-xs text-gray-400">{row.count} pending procedure{row.count === 1 ? '' : 's'}</p>
                </td>
                <td className="py-3 text-right font-bold text-indigo-700">{formatCents(row.amountCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-indigo-100 bg-indigo-50 font-bold">
              <td colSpan={4} className="px-3 py-3 text-indigo-950">Total planned future charges</td>
              <td className="px-3 py-3 text-right text-indigo-700">{formatCents(totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, tone, sub }: { title: string; value: string; icon: any; tone: string; sub?: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  }
  const moneyMatch = typeof value === 'string' ? value.match(/^([A-Z]{3})\s+(.+)$/) : null
  const displayValue = moneyMatch ? moneyMatch[2] : value
  const currency = moneyMatch ? moneyMatch[1] : null

  return (
    <div className="stat-card">
      <div className="mb-3 flex items-start justify-between">
        <p className="stat-card-label max-w-[11rem] leading-snug">{title}</p>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', colors[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="min-w-0">
        {currency && <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{currency}</p>}
        <p className="break-words text-[clamp(1.15rem,1.6vw,1.45rem)] font-bold leading-tight text-gray-900">{displayValue}</p>
      </div>
      {sub && <p className="stat-card-sub mt-1">{sub}</p>}
    </div>
  )
}

function Panel({ title, icon: Icon, children, className }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('section-card', className)}>
      <div className="section-card-header">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
      </div>
      <div className="section-card-body">{children}</div>
    </div>
  )
}

function StackedBars({ data, firstKey, secondKey, firstLabel, secondLabel }: any) {
  const max = Math.max(1, ...data.map((item: any) => item[firstKey] + item[secondKey]))
  return (
    <div>
      <div className="mb-4 flex gap-4 text-sm font-semibold">
        <span className="flex items-center gap-1.5 text-blue-700"><span className="h-3 w-3 rounded-sm bg-blue-500" />{firstLabel}</span>
        <span className="flex items-center gap-1.5 text-green-700"><span className="h-3 w-3 rounded-sm bg-green-500" />{secondLabel}</span>
      </div>
      <div className="flex h-56 items-end gap-2">
        {data.map((item: any) => {
          const total = item[firstKey] + item[secondKey]
          const firstHeight = total ? (item[firstKey] / max) * 100 : 0
          const secondHeight = total ? (item[secondKey] / max) * 100 : 0
          return (
            <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-44 w-full max-w-[34px] flex-col justify-end overflow-hidden rounded-t-lg bg-gray-100">
                <div className="bg-blue-500" style={{ height: `${firstHeight}%` }} title={`${firstLabel}: ${item[firstKey]}`} />
                <div className="bg-green-500" style={{ height: `${secondHeight}%` }} title={`${secondLabel}: ${item[secondKey]}`} />
              </div>
              <span className="text-[11px] font-semibold text-gray-500">{item.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RankedBars({ items, valueKey, money, tone, empty }: { items: any[]; valueKey: string; money?: boolean; tone: 'red' | 'green' | 'blue'; empty: string }) {
  if (!items.length) return <p className="py-8 text-center text-gray-400">{empty}</p>
  const max = Math.max(1, ...items.map(item => item[valueKey]))
  const bar = tone === 'red' ? 'bg-red-500' : tone === 'green' ? 'bg-green-500' : 'bg-blue-500'
  return (
    <div className="space-y-3">
      {items.slice(0, 8).map(item => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-gray-800">{item.label}</p>
            <p className="text-sm font-bold text-gray-900">{money ? formatCents(item[valueKey]) : item[valueKey]}</p>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100">
            <div className={cn('h-2.5 rounded-full', bar)} style={{ width: `${Math.max(4, (item[valueKey] / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DonutLegend({ items }: { items: any[] }) {
  const total = items.reduce((sum, item) => sum + item.cents, 0)
  if (!items.length || total === 0) return <p className="py-8 text-center text-gray-400">No expenses recorded this month</p>
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const pct = Math.round((item.cents / total) * 100)
        const colors = ['bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-gray-500']
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <span className={cn('h-3 w-3 rounded-sm', colors[index % colors.length])} />
                {item.label}
              </p>
              <p className="text-sm font-bold text-gray-900">{pct}%</p>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div className={cn('h-2 rounded-full', colors[index % colors.length])} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-0.5 text-xs font-medium text-gray-500">{formatCents(item.cents)}</p>
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

function RiskBox({ label, value, tone }: { label: string; value: number; tone: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return (
    <div className={cn('rounded-xl px-4 py-3', colors[tone])}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  )
}

function SimpleList({ items, empty, render }: { items: any[]; empty: string; render: (item: any) => React.ReactNode }) {
  if (!items.length) return <p className="py-8 text-center text-gray-400">{empty}</p>
  return <div className="divide-y divide-gray-100">{items.slice(0, 8).map((item, index) => <div key={item.id ?? index} className="py-3">{render(item)}</div>)}</div>
}

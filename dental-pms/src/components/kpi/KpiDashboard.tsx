'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Building2, Download, Gauge, Info, RefreshCw, ShieldAlert,
} from 'lucide-react'
import { cn, formatLKR } from '@/lib/utils'
import { fromCents } from '@/lib/money'
import { showToast } from '@/components/ui/Toast'
import { KpiDoctorCard } from './KpiDoctorCard'

type Period = 'week' | 'month' | 'quarter' | 'year'

const PERIOD_LABELS: Record<Period, string> = {
  week:    'Last 7 days',
  month:   'This month',
  quarter: 'Last 3 months',
  year:    'This year',
}

const GROUPS = [
  { id: 'financial',    label: 'Financial' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'retention',    label: 'Retention' },
  { id: 'quality',      label: 'Quality' },
  { id: 'efficiency',   label: 'Efficiency' },
] as const

export type GroupId = typeof GROUPS[number]['id']

interface Props {
  branches: { id: string; name: string }[]
}

export function KpiDashboard({ branches }: Props) {
  const [period, setPeriod]     = useState<Period>('month')
  const [branchId, setBranchId] = useState('')
  const [group, setGroup]       = useState<GroupId>('financial')
  const [data, setData]         = useState<any>(null)
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async (p: Period, b: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period: p })
      if (b) params.set('branchId', b)
      const res = await fetch(`/api/kpi?${params}`)
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json())
    } catch {
      showToast('error', 'Could not load KPIs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(period, branchId) }, [period, branchId, load])

  function exportCSV() {
    if (!data?.doctors?.length) return
    const cols = [
      'Doctor', 'Visits', 'Unique patients', 'New patients',
      'Billed (LKR)', 'Collected (LKR)', 'Outstanding (LKR)', 'Collection rate %',
      'Discount (LKR)', 'Discount rate %',
      'Revenue per visit (LKR)', 'Revenue per patient (LKR)',
      'Quoted items', 'Converted items', 'Quote conversion %', 'Quote value conversion %',
      'Plan completion %', 'Avg visits per plan', 'Avg days plan to completion',
      'Chair minutes', 'Avg chair minutes', 'Chair utilisation %',
      'Follow-ups due', 'Follow-ups kept', 'Follow-up adherence %',
      'Patient return rate %', 'No-shows', 'Cancellations', 'No-show + cancel rate %',
      'Re-treatments', 'Re-treatment rate %', 'Prescriptions', 'Prescriptions per visit',
    ]
    const rows = data.doctors.map((d: any) => [
      d.doctorName, d.visits, d.uniquePatients, d.newPatients,
      fromCents(d.billedCents), fromCents(d.collectedCents), fromCents(d.outstandingCents), d.collectionRate ?? '',
      fromCents(d.discountCents), d.discountRate ?? '',
      fromCents(d.revenuePerVisitCents), fromCents(d.revenuePerPatientCents),
      d.quotedItems, d.convertedItems, d.quoteConversionRate ?? '', d.quoteValueConversionRate ?? '',
      d.planCompletionRate ?? '', d.avgVisitsPerCompletedPlan ?? '', d.avgDaysPlanToCompletion ?? '',
      d.chairMinutes, d.avgChairMinutes ?? '', d.chairUtilisation ?? '',
      d.followUpsDue, d.followUpsKept, d.followUpAdherence ?? '',
      d.patientReturnRate ?? '', d.noShows, d.cancellations, d.noShowRate ?? '',
      d.retreatments, d.retreatmentRate ?? '', d.prescriptions, d.prescriptionsPerVisit ?? '',
    ])
    const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [cols, ...rows].map(r => r.map(esc).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `lumora-kpi-${period}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('success', 'KPIs exported')
  }

  const clinic = data?.clinic
  const coverage = data?.coverage

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Gauge className="w-7 h-7 text-purple-600" />Practice KPIs
          </h1>
          <p className="text-base text-gray-500 mt-1">
            Per-doctor performance across finance, productivity, retention and efficiency.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(period, branchId)} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border-2 border-gray-200 text-gray-700 hover:border-purple-400 transition-colors disabled:opacity-50">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />Refresh
          </button>
          <button onClick={exportCSV} disabled={!data?.doctors?.length}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-40">
            <Download className="w-4 h-4" />Export CSV
          </button>
        </div>
      </div>

      {/* Admin-only banner — these figures name individuals. */}
      <div className="flex items-start gap-3 bg-purple-50 border-2 border-purple-200 rounded-xl px-5 py-3">
        <ShieldAlert className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-purple-900">
          <span className="font-semibold">Admin only.</span> These figures identify individual
          doctors. Read the quality and discounting metrics as prompts for a conversation, not as
          a verdict on clinical judgement.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors',
              period === p
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-400'
            )}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
        {branches.length > 1 && (
          <div className="relative ml-auto">
            <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select value={branchId} onChange={e => setBranchId(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-xl text-sm font-semibold bg-white border-2 border-gray-200 text-gray-700 appearance-none">
              <option value="">All branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="py-20 text-center text-gray-400">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-gray-300" />
          <p>Calculating KPIs…</p>
        </div>
      ) : !data ? null : (
        <>
          {/* Clinic roll-up */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <ClinicStat label="Collected"      value={formatLKR(fromCents(clinic.collectedCents))} tone="green" />
            <ClinicStat label="Billed"         value={formatLKR(fromCents(clinic.billedCents))} />
            <ClinicStat label="Collection rate" value={clinic.collectionRate === null ? '—' : `${clinic.collectionRate}%`}
              tone={clinic.collectionRate !== null && clinic.collectionRate < 80 ? 'amber' : 'green'} />
            <ClinicStat label="Visits"         value={String(clinic.visits)} />
            <ClinicStat label="New patients"   value={String(clinic.newPatients)} tone="blue" />
          </div>

          {/* Unattributed revenue — never silently folded into a doctor. */}
          {clinic.unattributed.invoices > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-200 rounded-xl px-5 py-3">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                <span className="font-semibold">
                  {clinic.unattributed.invoices} invoice{clinic.unattributed.invoices === 1 ? '' : 's'}
                  {' '}({formatLKR(fromCents(clinic.unattributed.collectedCents))} collected)
                </span>{' '}
                were raised without a visit behind them, so they belong to no doctor. They are
                excluded from every per-doctor figure below.
              </p>
            </div>
          )}

          <CoverageNotice coverage={coverage} />

          {/* Metric group tabs */}
          <div className="flex flex-wrap gap-2 border-b-2 border-gray-100 pb-3">
            {GROUPS.map(g => (
              <button key={g.id} onClick={() => setGroup(g.id)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
                  group === g.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-gray-400'
                )}>
                {g.label}
              </button>
            ))}
          </div>

          {data.doctors.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Gauge className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>No doctor activity in this period.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.doctors.map((doctor: any) => (
                <KpiDoctorCard key={doctor.doctorId} doctor={doctor} group={group} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ClinicStat({ label, value, tone = 'gray' }: {
  label: string; value: string; tone?: 'gray' | 'green' | 'amber' | 'blue'
}) {
  const tones = {
    gray:  'text-gray-900',
    green: 'text-green-700',
    amber: 'text-amber-600',
    blue:  'text-blue-700',
  }
  return (
    <div className="stat-card">
      <p className="stat-card-label">{label}</p>
      <p className={cn('text-2xl font-bold mt-2', tones[tone])}>{value}</p>
    </div>
  )
}

// Several KPIs depend on linkage columns added with the KPI work. Until enough
// rows carry them, the affected splits fall back to free-text grouping — say so
// plainly rather than presenting a thin number as fact.
function CoverageNotice({ coverage }: { coverage: any }) {
  if (!coverage) return null
  const gaps: string[] = []
  if ((coverage.invoiceLinesCoded ?? 0) < 80) {
    gaps.push(`${coverage.invoiceLinesCoded ?? 0}% of billed lines are linked to the fee catalog — revenue by category groups the rest by description text`)
  }
  if ((coverage.visitsWithNextVisitDate ?? 0) < 80) {
    gaps.push(`${coverage.visitsWithNextVisitDate ?? 0}% of visits record a next-visit date — follow-up adherence covers only those`)
  }
  if ((coverage.planItemsVisitLinked ?? 0) < 80) {
    gaps.push(`${coverage.planItemsVisitLinked ?? 0}% of completed plan items name the visit that closed them — visits-per-plan is approximate below that`)
  }
  if (!gaps.length) return null

  return (
    <div className="flex items-start gap-3 bg-blue-50 border-2 border-blue-200 rounded-xl px-5 py-3">
      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-blue-900">
        <p className="font-semibold mb-1">Data coverage</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-800">
          {gaps.map(g => <li key={g}>{g}</li>)}
        </ul>
        <p className="mt-1.5 text-blue-700 text-xs">
          Coverage rises as new visits are recorded; historical rows stay unlinked.
        </p>
      </div>
    </div>
  )
}

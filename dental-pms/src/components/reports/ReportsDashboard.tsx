'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, Users, CalendarDays, Receipt,
  AlertTriangle, Download, RefreshCw,
  Building2, ChevronDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import { cn, formatLKR, formatUSD, formatDate } from '@/lib/utils'
import { RevenueChart }      from './RevenueChart'
import { AppointmentChart }  from './AppointmentChart'
import { BranchComparison }  from './BranchComparison'
import { ProviderTable }     from './ProviderTable'
import { ARAgingChart }      from './ARAgingChart'
import { showToast }         from '@/components/ui/Toast'

type Period = 'week' | 'month' | 'quarter' | 'year'

interface Props {
  branches: { id: string; name: string }[]
}

const PERIOD_LABELS: Record<Period, string> = {
  week:    'This week',
  month:   'This month',
  quarter: 'Last 3 months',
  year:    'This year',
}

export function ReportsDashboard({ branches }: Props) {
  const [period,   setPeriod]   = useState<Period>('month')
  const [branchId, setBranchId] = useState('')
  const [data,     setData]     = useState<any>(null)
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async (p: Period, b: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period: p })
      if (b) params.set('branchId', b)
      const res  = await fetch(`/api/reports?${params}`)
      const json = await res.json()
      setData(json)
    } catch {
      showToast('error', 'Could not load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(period, branchId) }, [period, branchId, load])

  async function exportCSV() {
    if (!data) return
    const rows = [
      ['Metric', 'Value'],
      ['Period', PERIOD_LABELS[period]],
      ['LKR Billed', data.revenue.lkr],
      ['LKR Collected', data.revenue.lkrCollected],
      ['LKR Outstanding', data.revenue.lkrOutstanding],
      ['USD Billed', data.revenue.usd],
      ['USD Collected', data.revenue.usdCollected],
      ['Total Appointments', data.appointments.total],
      ['Completed', data.appointments.completed],
      ['Cancelled', data.appointments.cancelled],
      ['No Shows', data.appointments.noShow],
      ['Walk-ins', data.appointments.walkIn],
      ['Fill Rate %', data.appointments.fillRate],
      ['No-show Rate %', data.appointments.noShowRate],
      ['New Patients', data.patients.new],
      ['Total Patients', data.patients.total],
      ['Overdue Recalls', data.recalls.overdue],
    ]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `dentalcare-report-${period}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('success', 'Report exported')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-base text-gray-500 mt-1">
            {data ? `${formatDate(data.dateRange.start)} — ${formatDate(data.dateRange.end)}` : 'Loading…'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-4 py-2 text-sm font-semibold transition-colors min-h-[44px]',
                  period === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Branch filter */}
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="form-input !py-2 !text-sm pl-9 pr-8 min-w-[140px]"
            >
              <option value="">All branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Export */}
          <button
            onClick={exportCSV}
            disabled={!data}
            className="btn-secondary !text-sm !px-4 !py-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          {/* Refresh */}
          <button
            onClick={() => load(period, branchId)}
            disabled={loading}
            className="btn-secondary !px-3 !py-2"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-10 h-10 text-gray-300 animate-spin mx-auto mb-3" />
            <p className="text-base text-gray-500">Loading analytics…</p>
          </div>
        </div>
      ) : data ? (
        <>
          {/* ── KPI CARDS ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="LKR collected"
              value={formatLKR(data.revenue.lkrCollected)}
              sub={`${formatLKR(data.revenue.lkrOutstanding)} outstanding`}
              icon={Receipt}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              subColor={data.revenue.lkrOutstanding > 0 ? 'text-red-500' : 'text-green-600'}
            />
            <KpiCard
              label="USD collected"
              value={formatUSD(data.revenue.usdCollected)}
              sub={`${data.revenue.invoiceCount} invoices total`}
              icon={TrendingUp}
              iconBg="bg-green-100"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Appointments"
              value={data.appointments.total.toLocaleString()}
              sub={`${data.appointments.fillRate}% fill rate · ${data.appointments.noShowRate}% no-show`}
              icon={CalendarDays}
              iconBg="bg-purple-100"
              iconColor="text-purple-600"
            />
            <KpiCard
              label="New patients"
              value={data.patients.new.toLocaleString()}
              sub={`${data.patients.total.toLocaleString()} total active`}
              icon={Users}
              iconBg="bg-teal-100"
              iconColor="text-teal-600"
            />
          </div>

          {/* ── ALERT STRIP ─────────────────────────────────────── */}
          {(data.recalls.overdue > 0 || data.revenue.lkrOutstanding > 50000) && (
            <div className="flex flex-wrap gap-3">
              {data.recalls.overdue > 0 && (
                <div className="flex items-center gap-3 bg-amber-50 border-2 border-amber-300 rounded-xl px-5 py-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-base font-semibold text-amber-900">
                    {data.recalls.overdue} patient{data.recalls.overdue !== 1 ? 's' : ''} overdue for recall
                  </p>
                </div>
              )}
              {data.revenue.lkrOutstanding > 50000 && (
                <div className="flex items-center gap-3 bg-red-50 border-2 border-red-300 rounded-xl px-5 py-3">
                  <Receipt className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-base font-semibold text-red-900">
                    {formatLKR(data.revenue.lkrOutstanding)} outstanding — review AR aging
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── CHARTS ROW 1 ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="section-card">
              <div className="section-card-header">
                <h2 className="text-lg font-semibold text-gray-900">Revenue (LKR)</h2>
                <span className="text-sm text-gray-400">Daily collections</span>
              </div>
              <div className="section-card-body">
                <RevenueChart data={data.revenue.daily} />
              </div>
            </div>

            <div className="section-card">
              <div className="section-card-header">
                <h2 className="text-lg font-semibold text-gray-900">Appointments</h2>
                <span className="text-sm text-gray-400">Daily volume</span>
              </div>
              <div className="section-card-body">
                <AppointmentChart data={data.appointments.daily} />
              </div>
            </div>
          </div>

          {/* ── CHARTS ROW 2 ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Branch comparison */}
            <div className="section-card">
              <div className="section-card-header">
                <h2 className="text-lg font-semibold text-gray-900">Branch comparison</h2>
              </div>
              <div className="section-card-body">
                <BranchComparison data={data.branchComparison} />
              </div>
            </div>

            {/* Booking sources */}
            <div className="section-card">
              <div className="section-card-header">
                <h2 className="text-lg font-semibold text-gray-900">Booking sources</h2>
              </div>
              <div className="section-card-body space-y-3">
                {data.appointments.bySource.map((s: any) => {
                  const pct = data.appointments.total > 0
                    ? Math.round((s._count.id / data.appointments.total) * 100)
                    : 0
                  const colors: Record<string, string> = {
                    WHATSAPP:     'bg-green-500',
                    PHONE:        'bg-blue-500',
                    WALKIN:       'bg-orange-500',
                    ONLINE:       'bg-purple-500',
                    RECEPTIONIST: 'bg-gray-400',
                  }
                  const labels: Record<string, string> = {
                    WHATSAPP: 'WhatsApp', PHONE: 'Phone', WALKIN: 'Walk-in',
                    ONLINE: 'Online', RECEPTIONIST: 'Receptionist',
                  }
                  return (
                    <div key={s.bookingSource}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold text-gray-700">{labels[s.bookingSource] ?? s.bookingSource}</span>
                        <span className="text-gray-500">{s._count.id} ({pct}%)</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', colors[s.bookingSource] ?? 'bg-gray-400')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                {data.appointments.bySource.length === 0 && (
                  <p className="text-sm text-gray-400 italic text-center py-4">No appointment data</p>
                )}
              </div>
            </div>

            {/* Payment methods */}
            <div className="section-card">
              <div className="section-card-header">
                <h2 className="text-lg font-semibold text-gray-900">Payment methods</h2>
              </div>
              <div className="section-card-body space-y-3">
                {Object.entries(data.revenue.methodBreakdown).length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-4">No payment data</p>
                ) : (
                  Object.entries(data.revenue.methodBreakdown)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([method, amount]) => {
                      const total = Object.values(data.revenue.methodBreakdown).reduce((s: number, v) => s + (v as number), 0)
                      const pct   = total > 0 ? Math.round(((amount as number) / total) * 100) : 0
                      const colors: Record<string, string> = {
                        cash: 'bg-green-500', card: 'bg-blue-500',
                        bank_transfer: 'bg-purple-500', insurance: 'bg-amber-500',
                      }
                      const labels: Record<string, string> = {
                        cash: 'Cash', card: 'Card',
                        bank_transfer: 'Bank transfer', insurance: 'Insurance',
                      }
                      return (
                        <div key={method}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-semibold text-gray-700 capitalize">{labels[method] ?? method}</span>
                            <span className="text-gray-500">{formatLKR(amount as number)} ({pct}%)</span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', colors[method] ?? 'bg-gray-400')}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          </div>

          {/* ── ROW 3: Provider + AR Aging ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="section-card">
              <div className="section-card-header">
                <h2 className="text-lg font-semibold text-gray-900">Provider performance</h2>
                <span className="text-sm text-gray-400">Completed appointments</span>
              </div>
              <div className="section-card-body">
                <ProviderTable providers={data.providers} />
              </div>
            </div>

            <div className="section-card">
              <div className="section-card-header">
                <h2 className="text-lg font-semibold text-gray-900">AR aging</h2>
                <span className="text-sm text-gray-400">Outstanding balances (LKR)</span>
              </div>
              <div className="section-card-body">
                <ARAgingChart aging={data.aging} />
              </div>
            </div>
          </div>

          {/* ── TOP PROCEDURES ───────────────────────────────────── */}
          {data.appointments.byType.length > 0 && (
            <div className="section-card">
              <div className="section-card-header">
                <h2 className="text-lg font-semibold text-gray-900">Top procedure types</h2>
              </div>
              <div className="section-card-body">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {data.appointments.byType.map((t: any, i: number) => {
                    const labels: Record<string, string> = {
                      CHECKUP: 'Checkup', CLEANING: 'Scaling', FILLING: 'Filling',
                      CROWN: 'Crown', ROOT_CANAL: 'Root Canal', EXTRACTION: 'Extraction',
                      CONSULTATION: 'Consult', WALKIN: 'Walk-in', EMERGENCY: 'Emergency',
                    }
                    const colors = ['bg-blue-100 text-blue-700','bg-teal-100 text-teal-700',
                      'bg-purple-100 text-purple-700','bg-amber-100 text-amber-700',
                      'bg-rose-100 text-rose-700','bg-green-100 text-green-700']
                    return (
                      <div key={t.type} className={cn('rounded-xl p-4 text-center', colors[i % colors.length])}>
                        <p className="text-2xl font-bold">{t._count.id}</p>
                        <p className="text-xs font-semibold mt-1">{labels[t.type] ?? t.type}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── RECALL STATUS ────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={cn('section-card border-2', data.recalls.overdue > 0 ? 'border-amber-300' : 'border-gray-200')}>
              <div className="section-card-body flex items-center gap-4">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center',
                  data.recalls.overdue > 0 ? 'bg-amber-100' : 'bg-green-100')}>
                  <AlertTriangle className={cn('w-6 h-6', data.recalls.overdue > 0 ? 'text-amber-600' : 'text-green-600')} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{data.recalls.overdue}</p>
                  <p className="text-sm text-gray-500">Overdue recalls</p>
                </div>
              </div>
            </div>
            <div className="section-card">
              <div className="section-card-body flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <CalendarDays className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{data.recalls.dueThisMonth}</p>
                  <p className="text-sm text-gray-500">Recalls due this month</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, subColor }: {
  label: string; value: string; sub: string
  icon: React.ElementType; iconBg: string; iconColor: string; subColor?: string
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <p className="stat-card-label">{label}</p>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
      </div>
      <p className="stat-card-value">{value}</p>
      <p className={cn('stat-card-sub', subColor)}>{sub}</p>
    </div>
  )
}

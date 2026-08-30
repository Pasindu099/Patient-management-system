'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw, Receipt } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { formatCents } from '@/lib/money'
import { showToast } from '@/components/ui/Toast'

interface Props {
  branches: { id: string; name: string }[]
}

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export function NetCashReport({ branches }: Props) {
  const [branchId, setBranchId] = useState('')
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(isoDaysAgo(0))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      if (branchId) params.set('branchId', branchId)
      const res = await fetch(`/api/finance/earnings?${params}`)
      if (!res.ok) throw new Error('Could not load report')
      setData(await res.json())
    } catch (e: any) {
      showToast('error', 'Could not load report', e.message)
    } finally {
      setLoading(false)
    }
  }, [from, to, branchId])

  useEffect(() => { load() }, [load])

  function exportCSV() {
    if (!data) return
    const rows = data.actualReport ?? []
    const headers = [
      'Date',
      'Invoice',
      'Patient number',
      'Patient',
      'Phone',
      'Branch',
      'Doctor',
      'Method',
      'Amount',
      'Reference',
      'Notes',
    ]
    const csvRows = rows.map((row: any) => [
      formatDate(row.paidAt),
      row.invoiceNumber,
      row.patient.patientNumber,
      `${row.patient.firstName} ${row.patient.lastName}`,
      row.patient.phone ?? '',
      row.branch?.name ?? 'No branch',
      row.doctor?.name ?? 'No doctor linked',
      paymentMethodLabel(row.method),
      centsForCSV(row.reportCents),
      row.reference ?? '',
      row.notes ?? '',
    ])
    const csv = [headers, ...csvRows].map(row => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `earnings-report-${from}-to-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('success', 'Report exported')
  }

  const rows = data?.actualReport ?? []

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Earnings Report</h1>
          <p className="text-base text-gray-500 mt-1">Recorded patient payments by date and branch.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input !w-auto !py-2 !text-sm" />
          <span className="text-gray-400">-</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="form-input !w-auto !py-2 !text-sm" />
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className="form-input !w-auto !py-2 !text-sm">
            <option value="">All branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button onClick={exportCSV} disabled={!rows.length} className="btn-secondary !text-sm !px-4 !py-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TotalCard label="Total" value={formatCents(data.totals.actualCents)} />
          <TotalCard label="Cash" value={formatCents(data.totals.cashActualCents)} />
          <TotalCard label="Card / bank" value={formatCents(data.totals.nonCashCents)} />
        </div>
      )}

      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Earnings Report</h2>
          </div>
          <span className="text-sm text-gray-400">{rows.length} payment{rows.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="section-card-body">
          <SimpleTable
            headers={['Date', 'Patient', 'Method', 'Amount']}
            rows={rows.map((row: any) => [
              formatDate(row.paidAt),
              `${row.patient.firstName} ${row.patient.lastName}`,
              paymentMethodLabel(row.method),
              <span key="amount" className="font-semibold">{formatCents(row.reportCents)}</span>,
            ])}
            empty="No patient payments in this period"
          />
        </div>
      </div>
    </div>
  )
}

function TotalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="section-card p-5">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    bank_transfer: 'Bank transfer',
  }
  return labels[method] ?? method
}

function centsForCSV(cents: number) {
  return (cents / 100).toFixed(2)
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-base text-gray-400 py-4 text-center">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
            {headers.map(h => <th key={h} className="pb-2 pr-4 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0">
              {cells.map((c, j) => <td key={j} className="py-2.5 pr-4">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

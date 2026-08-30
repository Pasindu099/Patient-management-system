'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  VIEW:   'bg-gray-100 text-gray-600',
  LOGIN:  'bg-purple-100 text-purple-700',
}

const RESOURCE_FILTERS = [
  { value: '',                    label: 'All activity' },
  { value: 'payment',             label: 'Payments' },
  { value: 'expense',             label: 'Expenses' },
  { value: 'treatment_fee_price', label: 'Price changes' },
  { value: 'visit',               label: 'Visits' },
  { value: 'reception_queue',     label: 'Queue' },
  { value: 'appointment',         label: 'Appointments' },
  { value: 'invoice',             label: 'Invoices' },
]

export function AuditLogViewer() {
  const [logs, setLogs]         = useState<any[]>([])
  const [resource, setResource] = useState('')
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '150' })
      if (resource) params.set('resource', resource)
      const res = await fetch(`/api/audit?${params}`)
      if (!res.ok) throw new Error()
      setLogs(await res.json())
    } catch {
      showToast('error', 'Could not load audit log')
    } finally {
      setLoading(false)
    }
  }, [resource])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit log</h1>
          <p className="text-base text-gray-500 mt-1">Who changed what, and when.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={resource} onChange={e => setResource(e.target.value)} className="form-input !w-auto !py-2 !text-sm">
            {RESOURCE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
        </div>
      </div>

      <div className="section-card">
        {logs.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            No audit entries
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map(log => (
              <div key={log.id} className="px-6 py-3.5 flex items-start gap-4">
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5',
                  ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600')}>
                  {log.action}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base text-gray-900">
                    <span className="font-semibold">{log.user?.name ?? 'System'}</span>
                    {' '}<span className="text-gray-500">{log.action.toLowerCase()}d</span>{' '}
                    <span className="font-medium">{log.resource.replace(/_/g, ' ')}</span>
                    {log.patient && (
                      <span className="text-gray-500"> — {log.patient.firstName} {log.patient.lastName} ({log.patient.patientNumber})</span>
                    )}
                  </p>
                  {log.details && (
                    <p className="text-sm text-gray-400 truncate">{JSON.stringify(log.details)}</p>
                  )}
                </div>
                <p className="text-sm text-gray-400 flex-shrink-0">{formatDateTime(log.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

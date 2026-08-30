'use client'

import { useEffect, useState } from 'react'
import { Coffee, LogOut, PlayCircle, RefreshCw, UserCheck } from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  READY: 'Ready for patients',
  WITH_PATIENT: 'With patient',
  SHORT_BREAK: 'Short break',
  UNAVAILABLE: 'Unavailable',
  SESSION_ENDED: 'Session ended',
}

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-700',
  READY: 'bg-green-100 text-green-800',
  WITH_PATIENT: 'bg-blue-100 text-blue-800',
  SHORT_BREAK: 'bg-amber-100 text-amber-800',
  UNAVAILABLE: 'bg-red-100 text-red-800',
  SESSION_ENDED: 'bg-gray-100 text-gray-600',
}

export function DoctorStatusPanel({ currentUser }: { currentUser: any }) {
  const [status, setStatus] = useState<any>(null)
  const [saving, setSaving] = useState<string | null>(null)

  async function loadStatus() {
    const res = await fetch('/api/doctor-status')
    if (!res.ok) return
    const rows = await res.json()
    setStatus(rows.find((row: any) => row.id === currentUser.id) ?? null)
  }

  useEffect(() => {
    loadStatus()
  }, [])

  async function setDoctorStatus(nextStatus: 'READY' | 'SHORT_BREAK' | 'SESSION_ENDED') {
    setSaving(nextStatus)
    try {
      const res = await fetch('/api/doctor-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not update status')
      setStatus({
        id: currentUser.id,
        name: currentUser.name,
        status: json.status,
        statusChangedAt: json.createdAt,
        note: json.note,
      })
      window.dispatchEvent(new CustomEvent('doctor-status-changed', { detail: { status: json.status } }))
      showToast('success', STATUS_LABELS[nextStatus])
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(null)
    }
  }

  const currentStatus = status?.status ?? 'NOT_STARTED'
  const changedAt = status?.statusChangedAt ? formatTime(status.statusChangedAt) : null

  return (
    <div className="section-card">
      <div className="section-card-body">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">Doctor availability</h2>
              <span className={cn('rounded-full px-3 py-1 text-sm font-bold', STATUS_COLORS[currentStatus])}>
                {STATUS_LABELS[currentStatus]}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-gray-500">
              {changedAt
                ? `Last changed at ${changedAt}`
                : 'Click ready when you arrive at the chair or start a session.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDoctorStatus('READY')}
              disabled={!!saving}
              className="btn-primary !px-4 !py-2.5"
            >
              {saving === 'READY' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              Start session
            </button>
            <button
              type="button"
              onClick={() => setDoctorStatus('SHORT_BREAK')}
              disabled={!!saving}
              className="btn-secondary !px-4 !py-2.5"
            >
              {saving === 'SHORT_BREAK' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Coffee className="h-4 w-4" />}
              Short break
            </button>
            <button
              type="button"
              onClick={() => setDoctorStatus('SESSION_ENDED')}
              disabled={!!saving}
              className="btn-secondary !px-4 !py-2.5"
            >
              {saving === 'SESSION_ENDED' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              End session
            </button>
          </div>
        </div>
        {currentStatus !== 'READY' && currentStatus !== 'WITH_PATIENT' && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Reception will see that you are not ready for the next patient.
          </div>
        )}
        {currentStatus === 'READY' && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            Reception can send the next patient to you now.
          </div>
        )}
      </div>
    </div>
  )
}

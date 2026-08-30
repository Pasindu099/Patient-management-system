'use client'

import { useState } from 'react'
import { MessageCircle, Phone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Clock, AlertCircle, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface Props {
  appointmentId: string
  currentStatus: string
  startTime?: string
}

export function AppointmentActions({ appointmentId, currentStatus, startTime }: Props) {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [newDate, setNewDate] = useState(startTime ? startTime.slice(0, 10) : '')
  const [newTime, setNewTime] = useState(startTime ? new Date(startTime).toTimeString().slice(0, 5) : '')

  async function sendReminder(channel: 'sms' | 'whatsapp') {
    setLoading(true)
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, type: 'appointment_24h', channel }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')
      showToast('success', `Reminder sent via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`)
    } catch (e: any) {
      showToast('error', 'Could not send reminder', e.message)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(status: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      showToast('success', `Appointment ${status.toLowerCase().replace('_', ' ')}`)
      router.refresh()
    } catch {
      showToast('error', 'Could not update appointment')
    } finally {
      setLoading(false)
    }
  }

  async function reschedule() {
    if (!newDate || !newTime) return
    setLoading(true)
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: new Date(`${newDate}T${newTime}`).toISOString() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not reschedule')
      showToast('success', 'Appointment moved to the new time')
      setShowReschedule(false)
      router.refresh()
    } catch (e: any) {
      showToast('error', 'Could not reschedule', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {currentStatus === 'SCHEDULED' && (
          <button
            onClick={() => updateStatus('CONFIRMED')}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                       bg-green-100 text-green-800 hover:bg-green-200 transition-colors min-h-[44px]"
          >
            <CheckCircle className="w-4 h-4" />
            Confirm
          </button>
        )}
        {(currentStatus === 'SCHEDULED' || currentStatus === 'CONFIRMED') && (
          <button
            onClick={() => updateStatus('IN_PROGRESS')}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                       bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors min-h-[44px]"
          >
            <Clock className="w-4 h-4" />
            Start
          </button>
        )}
        {currentStatus === 'IN_PROGRESS' && (
          <button
            onClick={() => updateStatus('COMPLETED')}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                       bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors min-h-[44px]"
          >
            <CheckCircle className="w-4 h-4" />
            Mark complete
          </button>
        )}
        {(currentStatus === 'SCHEDULED' || currentStatus === 'CONFIRMED') && (
          <>
            <button
              onClick={() => setShowReschedule(v => !v)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                         bg-purple-50 text-purple-800 hover:bg-purple-100 transition-colors min-h-[44px]"
            >
              <CalendarClock className="w-4 h-4" />
              Reschedule
            </button>
            <button
              onClick={() => updateStatus('NO_SHOW')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                         bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors min-h-[44px]"
            >
              <AlertCircle className="w-4 h-4" />
              No show
            </button>
            <button
              onClick={() => setCancelConfirm(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                         bg-red-50 text-red-700 hover:bg-red-100 transition-colors min-h-[44px]"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          </>
        )}
      </div>

      {showReschedule && (
        <div className="mt-3 flex items-end gap-2 flex-wrap rounded-xl border-2 border-purple-200 bg-purple-50 p-3">
          <div>
            <label className="block text-xs font-semibold text-purple-800 mb-1">New date</label>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="form-input !py-2 !text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-purple-800 mb-1">New time</label>
            <input
              type="time"
              value={newTime}
              onChange={e => setNewTime(e.target.value)}
              className="form-input !py-2 !text-sm"
            />
          </div>
          <button
            onClick={reschedule}
            disabled={loading || !newDate || !newTime}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                       bg-purple-600 text-white hover:bg-purple-700 transition-colors min-h-[42px] disabled:opacity-50"
          >
            <CalendarClock className="w-4 h-4" />
            Move appointment
          </button>
          <button
            onClick={() => setShowReschedule(false)}
            className="px-3 py-2 text-sm font-semibold text-gray-500 hover:text-gray-800 min-h-[42px]"
          >
            Cancel
          </button>
        </div>
      )}

      <ConfirmDialog
        open={cancelConfirm}
        title="Cancel this appointment?"
        description="This will mark the appointment as cancelled. The patient's record will be updated. You can re-book at any time."
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep appointment"
        variant="danger"
        onConfirm={() => { setCancelConfirm(false); updateStatus('CANCELLED') }}
        onCancel={() => setCancelConfirm(false)}
      />
    </>
  )
}

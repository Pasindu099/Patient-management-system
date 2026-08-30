'use client'

import { useState } from 'react'
import { Globe, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

const TIME_SLOTS = [
  ...buildTimeSlots(9, 14),
  ...buildTimeSlots(16, 21),
]

function buildTimeSlots(startHour: number, endHour: number) {
  const slots: string[] = []
  for (let mins = startHour * 60; mins < endHour * 60; mins += 30) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
  }
  return slots
}

function isVisibleSlot(time: string) {
  return TIME_SLOTS.includes(time)
}

interface Slot { id: string; doctorId: string; dayOfWeek: string; startTime: string; isActive: boolean }

interface Props {
  doctors:       { id: string; name: string; role: string }[]
  initialSlots:  Slot[]
  currentUserId: string
  isAdmin:       boolean
}

export function OnlineSlotsManager({ doctors, initialSlots, currentUserId, isAdmin }: Props) {
  const [selectedDoctor, setSelectedDoctor] = useState(doctors[0]?.id ?? '')
  const [slots,  setSlots]  = useState<Slot[]>(initialSlots)
  const [saving, setSaving] = useState<string | null>(null) // "day:time" being saved

  function isEnabled(doctorId: string, day: string, time: string) {
    return slots.some(s => s.doctorId === doctorId && s.dayOfWeek === day && s.startTime === time && s.isActive)
  }

  async function toggleSlot(doctorId: string, day: string, time: string) {
    const key     = `${day}:${time}`
    const enabled = isEnabled(doctorId, day, time)

    setSaving(key)
    try {
      const res = await fetch('/api/settings/slots', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ doctorId, dayOfWeek: day, startTime: time, enable: !enabled }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')

      if (!enabled) {
        // Add slot
        setSlots(prev => [...prev.filter(s => !(s.doctorId === doctorId && s.dayOfWeek === day && s.startTime === time)),
          { id: json.id, doctorId, dayOfWeek: day, startTime: time, isActive: true }])
      } else {
        // Remove slot
        setSlots(prev => prev.filter(s => !(s.doctorId === doctorId && s.dayOfWeek === day && s.startTime === time)))
      }
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(null)
    }
  }

  async function copyDayToAll(fromDay: string) {
    // Copy all enabled slots from one day to all weekdays
    const fromSlots = slots.filter(s => s.doctorId === selectedDoctor && s.dayOfWeek === fromDay && s.isActive && isVisibleSlot(s.startTime))
    if (fromSlots.length === 0) { showToast('error', 'No slots enabled on this day to copy'); return }

    setSaving('bulk')
    try {
      const res = await fetch('/api/settings/slots/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          doctorId: selectedDoctor,
          fromDay,
          times: fromSlots.map(s => s.startTime),
          toDays: DAYS.filter(d => d !== 'sunday'),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      // Reload by refetching
      const fresh = await fetch(`/api/settings/slots?doctorId=${selectedDoctor}`)
      const data  = await fresh.json()
      setSlots(prev => [
        ...prev.filter(s => s.doctorId !== selectedDoctor),
        ...data,
      ])
      showToast('success', `Copied ${fromDay} schedule to all weekdays`)
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(null)
    }
  }

  async function clearAll() {
    setSaving('bulk')
    try {
      const res = await fetch('/api/settings/slots/bulk', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ doctorId: selectedDoctor }),
      })
      if (!res.ok) throw new Error('Failed')
      setSlots(prev => prev.filter(s => s.doctorId !== selectedDoctor))
      showToast('success', 'All online slots cleared')
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(null)
    }
  }

  const doctor = doctors.find(d => d.id === selectedDoctor)
  const enabledCount = slots.filter(s => s.doctorId === selectedDoctor && s.isActive && isVisibleSlot(s.startTime)).length

  return (
    <div className="space-y-5">

      {/* Doctor selector */}
      {doctors.length > 1 && (
        <div className="section-card">
          <div className="section-card-body">
            <label className="form-label">Managing slots for</label>
            <div className="flex gap-3 flex-wrap">
              {doctors.map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDoctor(d.id)}
                  className={cn(
                    'px-5 py-3 rounded-xl text-base font-semibold border-2 transition-colors min-h-[44px]',
                    selectedDoctor === d.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                  )}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary strip */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-base font-semibold text-gray-900">
              {doctor?.name ?? ''} — <span className="text-blue-600">{enabledCount} slots enabled</span>
            </p>
            <p className="text-sm text-gray-500">
              Click a time slot to enable or disable it on the public website
            </p>
          </div>
        </div>
        <button
          onClick={clearAll}
          disabled={saving === 'bulk' || enabledCount === 0}
          className="btn-secondary !text-sm !px-4 !py-2 text-red-600 hover:text-red-700 disabled:opacity-40"
        >
          Clear all slots
        </button>
      </div>

      {/* Grid */}
      <div className="section-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
                  Time
                </th>
                {DAYS.map(day => (
                  <th key={day} className="px-2 py-3 text-center min-w-[80px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        {DAY_LABELS[day]}
                      </span>
                      <button
                        onClick={() => copyDayToAll(day)}
                        className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                        title={`Copy ${day} schedule to all weekdays`}
                      >
                        Copy →
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map(time => {
                const isHour = time.endsWith(':00')
                return (
                  <tr key={time} className={cn('border-t border-gray-100', isHour && 'bg-gray-50/50')}>
                    <td className="px-4 py-1.5 text-xs font-mono text-gray-500 font-medium">
                      {time}
                    </td>
                    {DAYS.map(day => {
                      const enabled  = isEnabled(selectedDoctor, day, time)
                      const key      = `${day}:${time}`
                      const isSaving = saving === key

                      return (
                        <td key={day} className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => toggleSlot(selectedDoctor, day, time)}
                            disabled={!!saving}
                            className={cn(
                              'w-10 h-8 rounded-lg border transition-all mx-auto block',
                              'disabled:cursor-wait',
                              enabled
                                ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                                : 'bg-white border-gray-200 text-gray-300 hover:border-blue-400 hover:text-blue-400'
                            )}
                            aria-label={`${enabled ? 'Disable' : 'Enable'} ${time} on ${day}`}
                          >
                            {isSaving
                              ? <RefreshCw className="w-3 h-3 animate-spin mx-auto" />
                              : enabled
                                ? <Check className="w-3 h-3 mx-auto" />
                                : <span className="text-xs">+</span>}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-500 px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
          <span>Enabled - patients can book this time online</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg border border-gray-200 bg-white" />
          <span>Disabled - hidden from online booking</span>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Search, AlertCircle, UserPlus, CalendarDays } from 'lucide-react'
import { cn, APPOINTMENT_TYPE_LABELS, APPOINTMENT_TYPE_DURATIONS, formatDate } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

const schema = z.object({
  patientId:    z.string().min(1, 'Please select a patient'),
  providerId:   z.string().min(1, 'Please select a provider'),
  branchId:     z.string().min(1, 'Please select a branch'),
  type:         z.string().min(1, 'Please select appointment type'),
  date:         z.string().min(1, 'Please select a date'),
  time:         z.string().min(1, 'Please select a time'),
  durationMins: z.number().int().min(10),
  chair:        z.string().optional(),
  reason:       z.string().optional(),
  bookingSource: z.string().default('RECEPTIONIST'),
})

type FormData = z.infer<typeof schema>

const TIME_SLOTS = [
  ...buildTimeSlots(9, 14),
  ...buildTimeSlots(16, 21),
]

function buildTimeSlots(startHour: number, endHour: number) {
  const slots: string[] = []
  for (let mins = startHour * 60; mins < endHour * 60; mins += 30) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return slots
}

function toLocalDateInputValue(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function timeFallsInSession(time: string) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + (m || 0)
  return (total >= 9 * 60 && total < 14 * 60) || (total >= 16 * 60 && total < 21 * 60)
}

function dayKeyForDate(date: string) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[new Date(`${date}T12:00:00`).getDay()]
}

const BOOKING_SOURCES = [
  { value: 'RECEPTIONIST', label: 'Receptionist (phone/in-person)' },
  { value: 'WHATSAPP',     label: 'WhatsApp' },
  { value: 'PHONE',        label: 'Phone call' },
  { value: 'ONLINE',       label: 'Online booking' },
]

interface Props {
  providers:       any[]
  branches:        any[]
  defaultBranchId: string
  defaultDate:     Date
  defaultTime?:    string
  defaultProviderId?: string
  isWalkIn:        boolean
  canBookAnyTime?: boolean
  onClose:         () => void
  onCreated:       (appointment?: any) => void
}

export function NewAppointmentModal({
  providers, branches, defaultBranchId, defaultDate, defaultTime, defaultProviderId, isWalkIn, canBookAnyTime = false, onClose, onCreated,
}: Props) {
  const [patientSearch, setPatientSearch]   = useState('')
  const [patientResults, setPatientResults] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [searching, setSearching]           = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [submitError, setSubmitError]       = useState('')
  const [offeredTimes, setOfferedTimes]     = useState<string[]>([])
  const [loadingTimes, setLoadingTimes]     = useState(false)
  const searchRef = useRef<NodeJS.Timeout>()

  const defaultDateStr = toLocalDateInputValue(defaultDate)
  const nowTime = `${String(new Date().getHours()).padStart(2,'0')}:${String(Math.ceil(new Date().getMinutes()/30)*30%60).padStart(2,'0')}`

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      branchId:      defaultBranchId,
      providerId:    defaultProviderId ?? '',
      date:          defaultDateStr,
      time:          defaultTime ?? (isWalkIn ? nowTime : ''),
      durationMins:  30,
      bookingSource: isWalkIn ? 'WALKIN' : 'RECEPTIONIST',
      type:          isWalkIn ? 'WALKIN' : '',
    },
  })

  const watchedType = watch('type')
  const watchedProviderId = watch('providerId')
  const watchedDate = watch('date')
  const watchedTime = watch('time')
  const availableTimes = canBookAnyTime ? TIME_SLOTS : offeredTimes

  // Auto-set duration when type changes
  useEffect(() => {
    if (watchedType && APPOINTMENT_TYPE_DURATIONS[watchedType]) {
      setValue('durationMins', APPOINTMENT_TYPE_DURATIONS[watchedType])
    }
  }, [watchedType, setValue])

  useEffect(() => {
    if (canBookAnyTime) return
    if (!watchedProviderId || !watchedDate) {
      setOfferedTimes([])
      if (watchedTime) setValue('time', '')
      return
    }

    let cancelled = false
    setLoadingTimes(true)
    fetch(`/api/settings/slots?doctorId=${watchedProviderId}`)
      .then(res => res.ok ? res.json() : [])
      .then(slots => {
        if (cancelled) return
        const day = dayKeyForDate(watchedDate)
        const times = slots
          .filter((slot: any) => slot.dayOfWeek === day && slot.isActive)
          .map((slot: any) => slot.startTime)
          .filter(timeFallsInSession)
          .sort()
        setOfferedTimes(times)
        if (watchedTime && !times.includes(watchedTime)) setValue('time', '')
      })
      .catch(() => {
        if (!cancelled) setOfferedTimes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTimes(false)
      })

    return () => { cancelled = true }
  }, [canBookAnyTime, watchedProviderId, watchedDate, watchedTime, setValue])

  // Debounced patient search
  useEffect(() => {
    if (!patientSearch.trim()) { setPatientResults([]); return }
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res  = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=6`)
        const data = await res.json()
        setPatientResults(data)
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [patientSearch])

  async function onSubmit(data: FormData) {
    setSubmitError('')
    if (!timeFallsInSession(data.time)) {
      const message = 'Appointments can be booked 09:00-14:00 or 16:00-21:00.'
      setSubmitError(message)
      showToast('error', 'Choose a session time', message)
      return
    }
    setSaving(true)
    try {
      const startTime = new Date(`${data.date}T${data.time}:00`)
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, startTime: startTime.toISOString() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to book')
      onCreated(json)
    } catch (e: any) {
      setSubmitError(e.message)
      showToast('error', 'Booking failed', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className={cn(
          'flex items-center justify-between px-6 py-4 border-b border-gray-200',
          isWalkIn ? 'bg-orange-50' : 'bg-white'
        )}>
          <div className="flex items-center gap-3">
            {isWalkIn
              ? <UserPlus className="w-6 h-6 text-orange-600" />
              : <CalendarDays className="w-6 h-6 text-blue-600" />}
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isWalkIn ? 'Register walk-in patient' : 'Book appointment'}
              </h2>
              <p className="text-sm text-gray-500">
                {isWalkIn ? 'Add to today\'s walk-in queue' : formatDate(defaultDate, 'EEEE, d MMMM yyyy')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">

          {/* Patient search */}
          <div>
            <label className="form-label">Patient *</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedPatient.patientNumber}
                    {selectedPatient.nicNumber ? ` · NIC: ${selectedPatient.nicNumber}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedPatient(null); setValue('patientId', ''); setPatientSearch('') }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Search by name, NIC or phone…"
                  className="form-input pl-11"
                  autoFocus
                />
                {patientResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-200
                                  rounded-xl shadow-xl z-10 overflow-hidden">
                    {patientResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p)
                          setValue('patientId', p.id)
                          setPatientSearch('')
                          setPatientResults([])
                        }}
                        className="w-full flex items-center justify-between px-4 py-3
                                   hover:bg-blue-50 transition-colors text-left border-b
                                   border-gray-100 last:border-0"
                      >
                        <div>
                          <p className="text-base font-semibold text-gray-900">
                            {p.firstName} {p.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {p.patientNumber}
                            {p.nicNumber ? ` · ${p.nicNumber}` : ''}
                          </p>
                        </div>
                        <span className="text-sm text-gray-400">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {patientSearch.length > 2 && patientResults.length === 0 && !searching && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-200
                                  rounded-xl shadow-xl z-10 p-4 text-center">
                    <p className="text-sm text-gray-500">No patients found</p>
                    <a href="/patients/new" target="_blank"
                       className="text-sm text-blue-600 font-semibold hover:underline">
                      Register new patient →
                    </a>
                  </div>
                )}
              </div>
            )}
            {errors.patientId && (
              <p className="form-error flex items-center gap-1.5 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />{errors.patientId.message}
              </p>
            )}
          </div>

          {/* Branch + Provider */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Branch *</label>
              <select {...register('branchId')} className="form-input">
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Provider *</label>
              <select {...register('providerId')} className="form-input">
                <option value="">Select provider…</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {errors.providerId && <p className="form-error text-xs mt-1">{errors.providerId.message}</p>}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="form-label">Appointment type *</label>
            <select {...register('type')} className="form-input">
              <option value="">Select type…</option>
              {Object.entries(APPOINTMENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {errors.type && <p className="form-error text-xs mt-1">{errors.type.message}</p>}
          </div>

          {/* Date + Time + Duration */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Date *</label>
              <input {...register('date')} type="date" className="form-input"
                min={toLocalDateInputValue(new Date())} />
            </div>
            <div>
              <label className="form-label">Time *</label>
              <select {...register('time')} className="form-input" disabled={!canBookAnyTime && (!watchedProviderId || loadingTimes || availableTimes.length === 0)}>
                <option value="">
                  {canBookAnyTime
                    ? 'Select...'
                    : !watchedProviderId
                      ? 'Choose provider first'
                      : loadingTimes
                        ? 'Loading offered times...'
                        : availableTimes.length === 0
                          ? 'No offered times'
                          : 'Select offered time...'}
                </option>
                {availableTimes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {!canBookAnyTime && watchedProviderId && watchedDate && !loadingTimes && availableTimes.length === 0 && (
                <p className="mt-1 text-xs font-semibold text-amber-600">
                  This doctor has not offered appointment times for this day.
                </p>
              )}
            </div>
            <div>
              <label className="form-label">Duration</label>
              <select {...register('durationMins', { valueAsNumber: true })} className="form-input">
                {[15,20,30,45,60,75,90,120].map(d => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
          </div>

          {/* Chair + Booking source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Chair / Room</label>
              <select {...register('chair')} className="form-input">
                <option value="">Not assigned</option>
                {['Chair 1','Chair 2','Chair 3','Chair 4'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Booked via</label>
              <select {...register('bookingSource')} className="form-input">
                {isWalkIn
                  ? <option value="WALKIN">Walk-in</option>
                  : BOOKING_SOURCES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
              </select>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="form-label">Reason / notes</label>
            <input {...register('reason')} className="form-input"
              placeholder="e.g. Toothache upper left, follow-up from last visit…" />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              type="submit"
              disabled={saving || !selectedPatient}
              className={cn('btn-primary min-w-[150px]', isWalkIn && 'bg-orange-600 hover:bg-orange-700')}
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : isWalkIn ? 'Add to queue' : 'Book appointment'}
            </button>
          </div>
          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {submitError}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

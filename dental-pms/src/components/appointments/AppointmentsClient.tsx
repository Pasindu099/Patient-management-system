'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, Plus, Clock,
  CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, MapPin,
  Phone, MessageCircle, UserPlus,
  Filter, RefreshCw,
} from 'lucide-react'
import {
  cn, formatTime, formatDate,
  APPOINTMENT_TYPE_LABELS, APPOINTMENT_TYPE_DURATIONS,
  BOOKING_SOURCE_COLORS, BOOKING_SOURCE_LABELS,
  APPOINTMENT_STATUS_COLORS,
} from '@/lib/utils'
import { NewAppointmentModal } from './NewAppointmentModal'
import { showToast } from '@/components/ui/Toast'

interface Props {
  initialAppointments: any[]
  walkInQueue:         any[]
  branches:            any[]
  providers:           any[]
  currentUser:         any
  selectedBranchId:    string
}

const CALENDAR_TIMES = [
  ...buildTimeSlots(9, 14),
  ...buildTimeSlots(16, 21),
]
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function buildTimeSlots(startHour: number, endHour: number) {
  const slots: string[] = []
  for (let mins = startHour * 60; mins < endHour * 60; mins += 30) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return slots
}

function formatSlotLabel(time: string) {
  const [rawHour, minute] = time.split(':').map(Number)
  const hour = rawHour % 12 || 12
  return `${hour}:${String(minute).padStart(2, '0')}`
}

function slotPeriodLabel(time: string) {
  const [hour] = time.split(':').map(Number)
  return hour >= 12 ? 'PM' : 'AM'
}

function dayKeyForDate(date: Date) {
  return DAY_KEYS[date.getDay()]
}

function timeFallsInSession(time: string) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + (m || 0)
  return (total >= 9 * 60 && total < 14 * 60) || (total >= 16 * 60 && total < 21 * 60)
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; label: string; bg: string; text: string; border: string }> = {
  SCHEDULED:   { icon: Clock,        label: 'Scheduled',   bg: 'bg-blue-50',   text: 'text-blue-800',  border: 'border-l-blue-500' },
  CONFIRMED:   { icon: CheckCircle,  label: 'Confirmed',   bg: 'bg-green-50',  text: 'text-green-800', border: 'border-l-green-500' },
  IN_PROGRESS: { icon: AlertCircle,  label: 'In progress', bg: 'bg-amber-50',  text: 'text-amber-800', border: 'border-l-amber-500' },
  COMPLETED:   { icon: CheckCircle,  label: 'Completed',   bg: 'bg-gray-100',  text: 'text-gray-600',  border: 'border-l-gray-400' },
  CANCELLED:   { icon: XCircle,      label: 'Cancelled',   bg: 'bg-red-50',    text: 'text-red-700',   border: 'border-l-red-400' },
  NO_SHOW:     { icon: XCircle,      label: 'No show',     bg: 'bg-red-50',    text: 'text-red-700',   border: 'border-l-red-400' },
  RESCHEDULED: { icon: RefreshCw,    label: 'Rescheduled', bg: 'bg-purple-50', text: 'text-purple-800',border: 'border-l-purple-500' },
  WALKIN:      { icon: UserPlus,     label: 'Walk-in',     bg: 'bg-orange-50', text: 'text-orange-800',border: 'border-l-orange-500' },
}

export function AppointmentsClient({
  initialAppointments, walkInQueue, branches, providers, currentUser, selectedBranchId,
}: Props) {
  const router = useRouter()
  const [appointments, setAppointments] = useState(initialAppointments)
  const [branchId, setBranchId]         = useState(selectedBranchId)
  const [providerId, setProviderId]     = useState('')
  const [showModal, setShowModal]       = useState(false)
  const [selectedSlotTime, setSelectedSlotTime] = useState('')
  const [offeredTimes, setOfferedTimes] = useState<string[]>([])
  const [loadingOfferedTimes, setLoadingOfferedTimes] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [view, setView]                 = useState<'day' | 'list'>('day')
  const dateInputRef = useRef<HTMLInputElement>(null)

  const selectedBranch = branches.find(b => b.id === branchId)
  const canBookAnyTime = currentUser.role === 'DOCTOR'

  const dateStr = selectedDate.toISOString().split('T')[0]

  useEffect(() => {
    if (canBookAnyTime) return
    if (!providerId) {
      setOfferedTimes([])
      return
    }

    let cancelled = false
    setLoadingOfferedTimes(true)
    fetch(`/api/settings/slots?doctorId=${providerId}`)
      .then(res => res.ok ? res.json() : [])
      .then(slots => {
        if (cancelled) return
        const day = dayKeyForDate(selectedDate)
        const times = slots
          .filter((slot: any) => slot.dayOfWeek === day && slot.isActive)
          .map((slot: any) => slot.startTime)
          .filter(timeFallsInSession)
          .sort()
        setOfferedTimes(times)
      })
      .catch(() => {
        if (!cancelled) setOfferedTimes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingOfferedTimes(false)
      })

    return () => { cancelled = true }
  }, [canBookAnyTime, providerId, selectedDate])

  async function loadAppointments(date: Date, bId = branchId, pId = providerId) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ date: date.toISOString().split('T')[0] })
      if (bId) params.set('branchId', bId)
      if (pId) params.set('providerId', pId)
      const res  = await fetch(`/api/appointments?${params}`)
      const data = await res.json()
      setAppointments(data)
    } catch {
      showToast('error', 'Could not load appointments')
    } finally {
      setLoading(false)
    }
  }

  function prevDay() {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d)
    loadAppointments(d)
  }

  function nextDay() {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d)
    loadAppointments(d)
  }

  function goToday() {
    const d = new Date()
    setSelectedDate(d)
    loadAppointments(d)
  }

  function openDatePicker() {
    const input = dateInputRef.current
    if (!input) return
    if (typeof (input as any).showPicker === 'function') (input as any).showPicker()
    else input.click()
  }

  function jumpToDate(value: string) {
    if (!value) return
    const d = new Date(`${value}T12:00:00`)
    setSelectedDate(d)
    loadAppointments(d)
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      showToast('success', `Appointment marked as ${status.toLowerCase()}`)
      loadAppointments(selectedDate)
    } catch {
      showToast('error', 'Could not update appointment')
    }
  }

  async function addAppointmentToQueue(appt: any) {
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: appt.patient.id,
          branchId: appt.branch.id,
          assignedDoctorId: appt.provider.id,
          appointmentId: appt.id,
          source: 'APPOINTMENT',
          reason: appt.reason || APPOINTMENT_TYPE_LABELS[appt.type] || appt.type,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not add patient to queue')
      showToast('success', `${appt.patient.firstName} added to reception queue`)
      loadAppointments(selectedDate)
    } catch (e: any) {
      showToast('error', e.message)
    }
  }

  function onAppointmentCreated(appointment?: any) {
    setShowModal(false)
    if (appointment?.startTime) {
      const bookedDate = new Date(appointment.startTime)
      setSelectedDate(bookedDate)
      loadAppointments(bookedDate)
    } else {
      loadAppointments(selectedDate)
    }
    showToast('success', 'Appointment booked successfully')
  }

  // Group appointments by start time for day view
  const apptsByTime: Record<string, any[]> = {}
  CALENDAR_TIMES.forEach(t => { apptsByTime[t] = [] })
  appointments.forEach(a => {
    const time = formatTime(a.startTime)
    if (apptsByTime[time]) apptsByTime[time].push(a)
  })
  const bookedOfferedTimes = new Set(
    appointments
      .map(a => formatTime(a.startTime))
      .filter(time => offeredTimes.includes(time))
  )
  const availableOfferedCount = offeredTimes.filter(time => !bookedOfferedTimes.has(time)).length

  const isToday = selectedDate.toDateString() === new Date().toDateString()

  return (
    <div className="flex h-full">

      {/* ── MAIN CALENDAR AREA ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Toolbar */}
        <div className="bg-white border-b-2 border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap">

          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <button onClick={prevDay} className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Previous day">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="relative min-w-[160px] text-center">
              <input
                ref={dateInputRef}
                type="date"
                value={dateStr}
                onChange={e => jumpToDate(e.target.value)}
                className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                aria-label="Choose appointment date"
                tabIndex={-1}
              />
              <button
                type="button"
                onClick={openDatePicker}
                className="w-full rounded-lg px-3 py-1.5 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Open appointment calendar"
              >
              <p className="text-base font-bold text-gray-900">{formatDate(selectedDate, 'EEEE')}</p>
              <p className="text-sm text-gray-500">{formatDate(selectedDate, 'd MMMM yyyy')}</p>
              </button>
            </div>
            <button onClick={nextDay} className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Next day">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {!isToday && (
            <button onClick={goToday} className="btn-secondary !text-sm !px-3 !py-2">
              Today
            </button>
          )}

          {/* Branch selector */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select
              value={branchId}
              onChange={e => { setBranchId(e.target.value); loadAppointments(selectedDate, e.target.value) }}
              className="form-input !py-2 !text-sm min-w-[140px]"
              aria-label="Select branch"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Provider filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select
              value={providerId}
              onChange={e => { setProviderId(e.target.value); loadAppointments(selectedDate, branchId, e.target.value) }}
              className="form-input !py-2 !text-sm min-w-[160px]"
              aria-label="Filter by provider"
            >
              <option value="">All providers</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border-2 border-gray-200 overflow-hidden">
            {(['day', 'list'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-4 py-2 text-sm font-semibold transition-colors',
                  view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                {v === 'day' ? 'Day view' : 'List view'}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}

          {/* New appointment */}
          <button
            onClick={() => { setSelectedSlotTime(''); setShowModal(true) }}
            className="btn-primary !text-sm !px-4 !py-2"
          >
            <Plus className="w-4 h-4" />
            New appointment
          </button>
        </div>

        {/* Calendar body */}
        <div className="flex-1 overflow-y-auto">
          {view === 'day' ? (
            // ── DAY VIEW ────────────────────────────────────────────
            <div className="p-4">
              {!canBookAnyTime && (
                <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                  {providerId
                    ? loadingOfferedTimes
                      ? 'Loading this doctor\'s offered appointment slots...'
                      : `${availableOfferedCount} free offered slots, ${bookedOfferedTimes.size} already booked for this doctor on ${formatDate(selectedDate, 'EEEE')}.`
                    : 'Select one provider to see and book only that doctor\'s offered appointment slots.'}
                </div>
              )}
              {CALENDAR_TIMES.map(slotTime => {
                const appts  = apptsByTime[slotTime] || []
                const [slotHour, slotMinute] = slotTime.split(':').map(Number)
                const now = new Date()
                const isNow  = isToday && now.getHours() === slotHour && Math.floor(now.getMinutes() / 30) * 30 === slotMinute
                const isOfferedSlot = offeredTimes.includes(slotTime)
                const isBookedOfferedSlot = !canBookAnyTime && !!providerId && isOfferedSlot && appts.length > 0
                const canOpenSlot = canBookAnyTime || (!!providerId && isOfferedSlot && appts.length === 0)
                return (
                  <div key={slotTime} className={cn(
                    'flex gap-3 min-h-[56px] border-b border-gray-100 rounded-lg',
                    isNow && 'bg-blue-50/40',
                    !canBookAnyTime && providerId && isOfferedSlot && appts.length === 0 && 'bg-green-50/80 ring-1 ring-green-200',
                    isBookedOfferedSlot && 'bg-blue-50/70 ring-1 ring-blue-100',
                    !canBookAnyTime && providerId && !isOfferedSlot && 'opacity-60'
                  )}>
                    {/* Time label */}
                    <div className="w-16 flex-shrink-0 pt-2 text-right">
                      <span className={cn(
                        'text-sm font-semibold',
                        isNow ? 'text-blue-600' : slotMinute === 0 ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        {formatSlotLabel(slotTime)}
                        <span className="text-xs ml-0.5">{slotPeriodLabel(slotTime)}</span>
                      </span>
                    </div>

                    {/* Appointments in this slot */}
                    <div className="flex-1 py-1 space-y-1.5">
                      {appts.map(appt => {
                        const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.SCHEDULED
                        const StatusIcon = cfg.icon
                        const isHighRisk = (appt.noShowRisk ?? 0) > 0.3
                        return (
                          <div
                            key={appt.id}
                            className={cn(
                              'rounded-xl border-l-4 px-3 py-2.5 cursor-pointer',
                              'hover:shadow-sm transition-shadow group',
                              cfg.bg, cfg.border
                            )}
                            onClick={() => router.push(`/appointments/${appt.id}`)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-bold text-gray-900 flex-shrink-0">
                                  {formatTime(appt.startTime)}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 truncate">
                                  {appt.patient.firstName} {appt.patient.lastName}
                                </span>
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                  {appt.patient.patientNumber}
                                </span>
                                {!canBookAnyTime && providerId && isOfferedSlot && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                                    Booked slot
                                  </span>
                                )}
                                {isHighRisk && (
                                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                                    No-show risk
                                  </span>
                                )}
                              </div>

                              {/* Status + actions */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={cn(
                                  'text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1',
                                  cfg.bg, cfg.text
                                )}>
                                  <StatusIcon className="w-3 h-3" />
                                  {cfg.label}
                                </span>

                                {/* Quick action buttons */}
                                <div className="hidden group-hover:flex items-center gap-1">
                                  {appt.status === 'SCHEDULED' && (
                                    <button
                                      onClick={e => { e.stopPropagation(); updateStatus(appt.id, 'CONFIRMED') }}
                                      className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg
                                                 hover:bg-green-200 transition-colors font-semibold"
                                    >
                                      Confirm
                                    </button>
                                  )}
                                  {(appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') && (
                                    <button
                                      onClick={e => { e.stopPropagation(); addAppointmentToQueue(appt) }}
                                      className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg
                                                 hover:bg-amber-200 transition-colors font-semibold"
                                    >
                                      Arrived
                                    </button>
                                  )}
                                  {appt.status === 'IN_PROGRESS' && (
                                    <button
                                      onClick={e => { e.stopPropagation(); updateStatus(appt.id, 'COMPLETED') }}
                                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg
                                                 hover:bg-blue-200 transition-colors font-semibold"
                                    >
                                      Complete
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500">
                                {APPOINTMENT_TYPE_LABELS[appt.type] ?? appt.type}
                                {' · '}{appt.durationMins}m
                                {appt.chair ? ` · ${appt.chair}` : ''}
                                {' · '}{appt.provider.name}
                              </span>
                              {/* Booking source badge */}
                              <span className={cn(
                                'text-xs font-semibold px-1.5 py-0.5 rounded-full',
                                BOOKING_SOURCE_COLORS[appt.bookingSource] ?? 'bg-gray-100 text-gray-600'
                              )}>
                                {BOOKING_SOURCE_LABELS[appt.bookingSource] ?? appt.bookingSource}
                              </span>
                              {/* Contact icons */}
                              <div className="flex gap-1.5 ml-auto">
                                {appt.patient.phone && (
                                  <a
                                    href={`tel:${appt.patient.phone}`}
                                    onClick={e => e.stopPropagation()}
                                    className="text-gray-400 hover:text-blue-600 transition-colors"
                                    title="Call patient"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {appt.patient.phone && (
                                  <a
                                    href={`https://wa.me/${appt.patient.phone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    onClick={e => e.stopPropagation()}
                                    className="text-gray-400 hover:text-green-600 transition-colors"
                                    title="WhatsApp patient"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {/* Empty slot indicator */}
                      {appts.length === 0 && (
                        <div
                          className={cn(
                            'h-10 rounded-lg border-2 border-dashed transition-colors group flex items-center px-3',
                            canOpenSlot
                              ? 'border-green-300 bg-green-50 hover:border-green-500 hover:bg-green-100 cursor-pointer'
                              : 'border-transparent cursor-not-allowed opacity-50'
                          )}
                          onClick={() => {
                            if (!canOpenSlot) {
                              if (!providerId) {
                                showToast('error', 'Choose a provider first')
                              } else {
                                showToast('error', 'Slot not offered', 'Receptionists can book only the doctor\'s enabled slots.')
                              }
                              return
                            }
                            setSelectedSlotTime(slotTime)
                            setShowModal(true)
                          }}
                        >
                          <span className={cn(
                            'text-xs font-semibold',
                            canOpenSlot ? 'text-green-700' : 'hidden group-hover:block text-amber-600'
                          )}>
                            {canOpenSlot ? 'Available slot - add appointment' : providerId ? 'Not offered' : 'Select provider first'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            // ── LIST VIEW ────────────────────────────────────────────
            <div className="p-4 space-y-2">
              {appointments.length === 0 ? (
                <div className="text-center py-16">
                  <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-gray-500">No appointments on {formatDate(selectedDate)}</p>
                </div>
              ) : (
                appointments.map(appt => {
                  const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.SCHEDULED
                  const StatusIcon = cfg.icon
                  return (
                    <div
                      key={appt.id}
                      className={cn(
                        'flex items-center gap-4 px-5 py-4 rounded-xl border-l-4 cursor-pointer',
                        'hover:shadow-sm transition-shadow',
                        cfg.bg, cfg.border
                      )}
                      onClick={() => router.push(`/appointments/${appt.id}`)}
                    >
                      <div className="w-14 flex-shrink-0 text-center">
                        <p className="text-lg font-bold text-gray-900">{formatTime(appt.startTime)}</p>
                        <p className="text-xs text-gray-400">{appt.durationMins}m</p>
                      </div>
                      <div className="w-0.5 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-semibold text-gray-900">
                            {appt.patient.firstName} {appt.patient.lastName}
                          </p>
                          <span className="text-xs text-gray-400">{appt.patient.patientNumber}</span>
                          {(appt.noShowRisk ?? 0) > 0.3 && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                              No-show risk
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {APPOINTMENT_TYPE_LABELS[appt.type]} · {appt.provider.name}
                          {appt.chair ? ` · ${appt.chair}` : ''}
                          {appt.reason ? ` · "${appt.reason}"` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn(
                          'text-sm font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5',
                          cfg.bg, cfg.text
                        )}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          BOOKING_SOURCE_COLORS[appt.bookingSource] ?? 'bg-gray-100 text-gray-600'
                        )}>
                          {BOOKING_SOURCE_LABELS[appt.bookingSource]}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Booking modals */}
      {showModal && (
        <NewAppointmentModal
          providers={providers}
          branches={branches}
          defaultBranchId={branchId}
          defaultDate={selectedDate}
          defaultTime={selectedSlotTime}
          defaultProviderId={canBookAnyTime ? currentUser.id : providerId || undefined}
          isWalkIn={false}
          canBookAnyTime={canBookAnyTime}
          onClose={() => setShowModal(false)}
          onCreated={onAppointmentCreated}
        />
      )}
    </div>
  )
}

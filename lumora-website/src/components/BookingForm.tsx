'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const REASONS = [
  'Routine Check-up & Cleaning',
  'Toothache / Pain',
  'Cosmetic Consultation',
  'Teeth Whitening',
  'Filling / Restoration',
  'Extraction',
  'Root Canal',
  'Crown or Bridge',
  'Dental Implant Consultation',
  'Orthodontic Consultation',
  'Gum Treatment',
  'Dentures',
  'Emergency',
  'Other',
]

const TITLES = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Rev.']

interface Doctor {
  id: string
  name: string
}

interface Slot {
  time: string
  available: boolean
}

interface DayAvailability {
  date: string
  dayLabel: string
  dateLabel: string
  slots: Slot[]
  availableCount: number
}

type Step = 1 | 2 | 3

function parseLocalDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateStr: string, amount: number) {
  const date = parseLocalDate(dateStr)
  date.setDate(date.getDate() + amount)
  return toDateKey(date)
}

function getTomorrowKey() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return toDateKey(date)
}

function getMaxDateKey() {
  const date = new Date()
  date.setDate(date.getDate() + 60)
  return toDateKey(date)
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-0 mb-6 sm:mb-8">
      {[
        { n: 1, label: 'Your Details' },
        { n: 2, label: 'Appointment' },
        { n: 3, label: 'Review' },
      ].map((item, index) => (
        <div key={item.n} className="flex items-center flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div
              className={cn(
                'w-8 h-8 flex-shrink-0 flex items-center justify-center text-sm font-medium transition-all',
                step === item.n ? 'bg-gold text-white' :
                step > item.n ? 'bg-stone-dark text-white' :
                'bg-cream-dark text-stone'
              )}
            >
              {step > item.n ? <Check className="w-4 h-4" /> : item.n}
            </div>
            <span
              className={cn(
                'text-xs tracking-widest uppercase hidden sm:block',
                step === item.n ? 'text-gold' : 'text-stone/50'
              )}
            >
              {item.label}
            </span>
          </div>
          {index < 2 && <div className={cn('flex-1 h-px mx-1.5 sm:mx-3', step > item.n ? 'bg-gold' : 'bg-cream-dark')} />}
        </div>
      ))}
    </div>
  )
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="form-label">
        {label}
        {required && <span className="text-gold ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-red-500 text-xs mt-1.5">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  )
}

export function BookingForm() {
  const [step, setStep] = useState<Step>(1)
  const minDate = getTomorrowKey()
  const maxDate = getMaxDateKey()

  const [title, setTitle] = useState('Mr.')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [nic, setNic] = useState('')
  const [address, setAddress] = useState('')

  const [reason, setReason] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [date, setDate] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('')
  const [weekStart, setWeekStart] = useState(minDate)

  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [weekSlots, setWeekSlots] = useState<DayAvailability[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [refNumber, setRefNumber] = useState('')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/slots/doctors')
      .then(r => r.json())
      .then(data => setDoctors(data))
      .catch(() => setDoctors([]))
      .finally(() => setLoadingDocs(false))
  }, [])

  useEffect(() => {
    setWeekStart(minDate)
    setDate('')
    setTimeSlot('')
  }, [doctorId, minDate])

  useEffect(() => {
    if (!doctorId || !weekStart) {
      setWeekSlots([])
      return
    }

    setLoadingSlots(true)
    fetch(`/api/slots?doctorId=${doctorId}&startDate=${weekStart}&days=7`)
      .then(r => r.json())
      .then((data: DayAvailability[]) => {
        setWeekSlots(data)

        const visibleDates = new Set(data.map(day => day.date))
        if (!date || !visibleDates.has(date)) {
          const firstAvailable = data.find(day => day.availableCount > 0)?.date
          setDate(firstAvailable ?? data[0]?.date ?? '')
        }
      })
      .catch(() => setWeekSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [doctorId, weekStart, date])

  useEffect(() => {
    const selectedDay = weekSlots.find(day => day.date === date)
    if (!selectedDay) {
      setTimeSlot('')
      return
    }

    const selectedStillAvailable = selectedDay.slots.some(slot => slot.time === timeSlot && slot.available)
    if (!selectedStillAvailable) {
      setTimeSlot('')
    }
  }, [date, timeSlot, weekSlots])

  const selectedDay = weekSlots.find(day => day.date === date)
  const selectedSlots = selectedDay?.slots ?? []
  const canGoPrevWeek = weekStart > minDate
  const canGoNextWeek = addDays(weekStart, 7) <= maxDate

  function shiftWeek(direction: -1 | 1) {
    const nextWeekStart = addDays(weekStart, direction * 7)
    if (nextWeekStart < minDate || nextWeekStart > maxDate) return
    setWeekStart(nextWeekStart)
  }

  function jumpToDate(nextDate: string) {
    if (!nextDate) return
    setWeekStart(nextDate)
    setDate(nextDate)
    setTimeSlot('')
  }

  function validateStep1() {
    const nextErrors: Record<string, string> = {}
    if (!firstName.trim()) nextErrors.firstName = 'First name is required'
    if (!lastName.trim()) nextErrors.lastName = 'Last name is required'
    if (!dob) nextErrors.dob = 'Date of birth is required'
    if (!gender) nextErrors.gender = 'Please select your gender'
    if (!phone.trim()) nextErrors.phone = 'Phone number is required'
    if (phone && !/^[\d\s\+\-\(\)]{7,15}$/.test(phone)) nextErrors.phone = 'Please enter a valid phone number'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Please enter a valid email'
    if (!nic.trim()) nextErrors.nic = 'NIC number is required'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function validateStep2() {
    const nextErrors: Record<string, string> = {}
    if (!reason) nextErrors.reason = 'Please select the reason for your visit'
    if (!doctorId) nextErrors.doctorId = 'Please select a doctor'
    if (!date) nextErrors.date = 'Please select a date'
    if (!timeSlot) nextErrors.timeSlot = 'Please select a time slot'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function goToStep2() {
    if (validateStep1()) setStep(2)
  }

  async function handleSubmit() {
    if (!validateStep2()) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, firstName, lastName, dob, gender,
          phone, email, nic, address,
          reason, doctorId, date, timeSlot, notes, website,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Booking failed')

      setRefNumber(json.referenceNumber)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white border border-cream-dark p-5 sm:p-10 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="font-serif text-3xl text-stone-dark mb-2">Appointment Confirmed</h2>
        <p className="text-gold text-sm tracking-widest uppercase mb-5">Reference: {refNumber}</p>
        <p className="text-stone leading-relaxed mb-2">
          Thank you, {firstName}. Your appointment is confirmed for{' '}
          <strong>{date}</strong> at <strong>{timeSlot}</strong>.
        </p>
        <p className="text-stone leading-relaxed mb-8">
          If anything changes, our team will reach you by phone or WhatsApp on{' '}
          <strong>{phone}</strong>.
        </p>
        <div className="border-t border-cream-dark pt-6">
          <p className="text-xs text-stone/50 tracking-wide">
            Please save your reference number: <strong>{refNumber}</strong>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-cream-dark p-4 sm:p-6 md:p-10 overflow-hidden">
      <StepIndicator step={step} />

      {step === 1 && (
        <div className="space-y-5">
          <h2 className="font-serif text-2xl text-stone-dark mb-6">Personal Information</h2>
          <input
            type="text"
            name="website"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field label="Title" required>
              <select value={title} onChange={e => setTitle(e.target.value)} className="form-field">
                {TITLES.map(item => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-3">
              <Field label="First name" required error={errors.firstName}>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className={cn('form-field', errors.firstName && 'border-red-300')}
                  placeholder="Dilini"
                  autoFocus
                />
              </Field>
            </div>
          </div>

          <Field label="Last name" required error={errors.lastName}>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              className={cn('form-field', errors.lastName && 'border-red-300')}
              placeholder="Wickramasinghe"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Date of birth" required error={errors.dob}>
              <input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                max={toDateKey(new Date())}
                className={cn('form-field', errors.dob && 'border-red-300')}
              />
            </Field>
            <Field label="Gender" required error={errors.gender}>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
                className={cn('form-field', errors.gender && 'border-red-300')}
              >
                <option value="">Select gender...</option>
                <option>Male</option>
                <option>Female</option>
                <option>Prefer not to say</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Phone number" required error={errors.phone}>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className={cn('form-field', errors.phone && 'border-red-300')}
                placeholder="+94 77 123 4567"
              />
            </Field>
            <Field label="Email address" error={errors.email}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={cn('form-field', errors.email && 'border-red-300')}
                placeholder="your@email.com"
              />
            </Field>
          </div>

          <Field label="NIC number" required error={errors.nic}>
            <input
              type="text"
              value={nic}
              onChange={e => setNic(e.target.value.toUpperCase())}
              className={cn('form-field font-mono', errors.nic && 'border-red-300')}
              placeholder="123456789V or 200012345678"
              maxLength={12}
            />
            <p className="text-xs text-stone/50 mt-1.5">Sri Lanka NIC - old format (9 digits + V) or new (12 digits)</p>
          </Field>

          <Field label="Address">
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="form-field resize-none"
              rows={2}
              placeholder="Your home or correspondence address"
            />
          </Field>

          <div className="pt-4">
            <button onClick={goToStep2} className="btn-gold w-full justify-center">
              Continue to Appointment Details
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h2 className="font-serif text-2xl text-stone-dark mb-6">Appointment Details</h2>

          <Field label="Reason for visit" required error={errors.reason}>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className={cn('form-field', errors.reason && 'border-red-300')}
            >
              <option value="">Select reason...</option>
              {REASONS.map(item => <option key={item}>{item}</option>)}
            </select>
          </Field>

          <Field label="Preferred doctor" required error={errors.doctorId}>
            {loadingDocs ? (
              <div className="form-field flex items-center gap-2 text-stone/50">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading doctors...
              </div>
            ) : (
              <select
                value={doctorId}
                onChange={e => setDoctorId(e.target.value)}
                className={cn('form-field', errors.doctorId && 'border-red-300')}
              >
                <option value="">Select doctor...</option>
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Available this week" required error={errors.date}>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  disabled={!doctorId || !canGoPrevWeek}
                  className="btn-outline px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-sm text-stone/70 text-center flex-1">
                  {weekSlots[0] && weekSlots[weekSlots.length - 1]
                    ? `${weekSlots[0].dateLabel} to ${weekSlots[weekSlots.length - 1].dateLabel}`
                    : 'Choose a doctor to see this week'}
                </p>
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  disabled={!doctorId || !canGoNextWeek}
                  className="btn-outline px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {!doctorId ? (
                <p className="text-xs text-stone/50">Please select a doctor first</p>
              ) : loadingSlots ? (
                <div className="flex items-center gap-2 text-stone/50 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading weekly availability...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {weekSlots.map(day => (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => {
                        setDate(day.date)
                        setTimeSlot('')
                      }}
                      className={cn(
                        'border px-2.5 sm:px-3 py-3 text-left transition-all min-h-[92px] overflow-hidden',
                        date === day.date
                          ? 'border-gold bg-gold text-white'
                          : 'border-cream-dark bg-white text-stone-dark hover:border-gold'
                      )}
                    >
                      <p className={cn('text-xs tracking-widest uppercase', date === day.date ? 'text-white/80' : 'text-stone/50')}>
                        {day.dayLabel}
                      </p>
                      <p className="text-sm sm:text-base font-medium mt-2">{day.dateLabel}</p>
                      <p className={cn('text-xs mt-3', date === day.date ? 'text-white/80' : day.availableCount > 0 ? 'text-gold' : 'text-stone/40')}>
                        {day.availableCount > 0 ? `${day.availableCount} slots open` : 'No online slots'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field label="Custom date">
            <input
              type="date"
              value={date}
              onChange={e => jumpToDate(e.target.value)}
              min={minDate}
              max={maxDate}
              disabled={!doctorId}
              className="form-field disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-stone/50 mt-1.5">
              Jump to a different day and the weekly view will shift around it.
            </p>
          </Field>

          {doctorId && date && (
            <Field
              label={selectedDay ? `Available time slots for ${selectedDay.dayLabel}, ${selectedDay.dateLabel}` : 'Available time slots'}
              required
              error={errors.timeSlot}
            >
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-stone/50 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading available slots...
                </div>
              ) : selectedSlots.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                  No online slots are configured for this day. Try another day from the week above.
                </div>
              ) : selectedDay?.availableCount === 0 ? (
                <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                  This day is fully booked. Try another day from the week above.
                </div>
              ) : (
                <div className="grid grid-cols-2 min-[360px]:grid-cols-3 sm:grid-cols-4 gap-2 mt-1">
                  {selectedSlots.map(slot => (
                    <button
                      key={`${selectedDay?.date}-${slot.time}`}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => slot.available && setTimeSlot(slot.time)}
                      className={cn(
                        'py-3 text-sm font-medium border transition-all',
                        !slot.available
                          ? 'bg-cream-dark text-stone/30 border-cream-dark cursor-not-allowed line-through'
                          : timeSlot === slot.time
                            ? 'bg-gold text-white border-gold'
                            : 'bg-white text-stone border-stone/20 hover:border-gold hover:text-gold'
                      )}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </Field>
          )}

          <Field label="Additional notes or concerns">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="form-field resize-none"
              rows={3}
              placeholder="Any specific concerns, medical conditions, medications, or preferences we should know about..."
            />
          </Field>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
            <button onClick={() => setStep(1)} className="btn-outline flex-1 justify-center">
              Back
            </button>
            <button onClick={() => { if (validateStep2()) setStep(3) }} className="btn-gold flex-1 justify-center">
              Review Booking
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h2 className="font-serif text-2xl text-stone-dark mb-6">Review Your Booking</h2>

          <div className="bg-cream p-4 sm:p-6 space-y-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs tracking-widest uppercase text-gold">Personal Details</p>
              <button onClick={() => setStep(1)} className="text-xs text-stone hover:text-gold underline">Edit</button>
            </div>
            {[
              ['Name', `${title} ${firstName} ${lastName}`],
              ['Date of birth', dob],
              ['Gender', gender],
              ['Phone', phone],
              ['Email', email || '-'],
              ['NIC', nic],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-sm">
                <span className="text-stone/50 sm:w-32 flex-shrink-0">{label}</span>
                <span className="text-stone-dark font-medium break-words">{value}</span>
              </div>
            ))}
          </div>

          <div className="bg-cream p-4 sm:p-6 space-y-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs tracking-widest uppercase text-gold">Appointment</p>
              <button onClick={() => setStep(2)} className="text-xs text-stone hover:text-gold underline">Edit</button>
            </div>
            {[
              ['Reason', reason],
              ['Doctor', doctors.find(doctor => doctor.id === doctorId)?.name ?? doctorId],
              ['Date', date],
              ['Time', timeSlot],
              ['Notes', notes || '-'],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-sm">
                <span className="text-stone/50 sm:w-32 flex-shrink-0">{label}</span>
                <span className="text-stone-dark font-medium break-words">{value}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-stone/50 leading-relaxed">
            By submitting this form you confirm that the information provided is accurate.
            Your appointment is confirmed immediately and reserved with the selected doctor.
            If you need to change or cancel it, please call the clinic with your reference number.
          </p>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button onClick={() => setStep(2)} className="btn-outline flex-1 justify-center">
              Back
            </button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-gold flex-1 justify-center">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Confirm Appointment'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

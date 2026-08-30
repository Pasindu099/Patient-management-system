'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Phone, Mail, MapPin, AlertCircle, Check } from 'lucide-react'
import { cn, languageOptions, MEDICAL_CHECKS } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

// ─── VALIDATION SCHEMA ────────────────────────────────────────────────────────
const schema = z.object({
  firstName:         z.string().min(1, 'First name is required'),
  lastName:          z.string().min(1, 'Last name is required'),
  dateOfBirth:       z.string().min(1, 'Date of birth is required'),
  gender:            z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'], {
                       required_error: 'Please select a gender',
                     }),
  phone:             z.string().min(6, 'Phone number is required'),
  email:             z.string().email('Please enter a valid email').optional().or(z.literal('')),
  addressLine1:      z.string().optional(),
  city:              z.string().optional(),
  preferredLanguage: z.string().default('en'),
  communicationPref: z.string().default('email'),
  emergencyName:     z.string().optional(),
  emergencyPhone:    z.string().optional(),
  emergencyRelation: z.string().optional(),
  notes:             z.string().optional(),
  medicalFlags:      z.record(z.boolean()).default({}),
  allergyDetails:    z.string().optional(),
  currentMedications:z.string().optional(),
  drugHistory:       z.string().optional(),
  dietaryHistory:    z.string().optional(),
  brushingHistory:   z.string().optional(),
  medicalHistoryNote:z.string().optional(),
  oralHygieneHistory:z.string().optional(),
  habitHistory:      z.string().optional(),
  familyHistory:     z.string().optional(),
  socialHistory:     z.string().optional(),
  extraOralExamination: z.string().optional(),
  intraOralExamination: z.string().optional(),
})

export type EditPatientFormData = z.infer<typeof schema>

// ─── FORM STEPS ───────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Personal details', icon: User },
  { id: 2, label: 'Contact',          icon: Phone },
  { id: 3, label: 'Medical history',   icon: AlertCircle },
  { id: 4, label: 'Emergency & notes', icon: AlertCircle },
]


interface Props {
  patientId: string
  defaultValues: EditPatientFormData
}

export function EditPatientForm({ patientId, defaultValues }: Props) {
  const router = useRouter()
  const [step, setStep]       = useState(1)
  const [saving, setSaving]   = useState(false)

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditPatientFormData>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  // Validate current step fields before advancing
  async function nextStep() {
    const stepFields: Record<number, (keyof EditPatientFormData)[]> = {
      1: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
      2: ['phone', 'email'],
    }
    const valid = await trigger(stepFields[step])
    if (valid) setStep(s => s + 1)
  }

  async function onSubmit(data: EditPatientFormData) {
    setSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to save patient')
      }

      showToast('success', 'Patient updated', `${data.firstName} ${data.lastName} has been saved.`)
      router.push(`/patients/${patientId}`)
    } catch (e: any) {
      showToast('error', 'Could not save patient', e.message)
      setSaving(false)
    }
  }

  return (
    <div className="section-card">
      {/* Step indicator */}
      <div className="px-8 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full',
                  'text-sm font-bold border-2 transition-all flex-shrink-0 cursor-pointer',
                  step === s.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : step > s.id
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-400 border-gray-300'
                )}
                aria-label={`Step ${s.id}: ${s.label}`}
              >
                {step > s.id ? <Check className="w-4 h-4" /> : s.id}
              </button>

              {/* Label */}
              <span className={cn(
                'ml-2 text-sm font-semibold hidden sm:block',
                step === s.id ? 'text-blue-700' : step > s.id ? 'text-green-700' : 'text-gray-400'
              )}>
                {s.label}
              </span>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 mx-3',
                  step > s.id ? 'bg-green-400' : 'bg-gray-200'
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={e => e.preventDefault()}
        onKeyDown={e => {
          // Pressing Enter in a text field must never submit the form early —
          // only the "Save changes" button on the final step should.
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
            e.preventDefault()
          }
        }}
      >
        <div className="px-8 py-6 space-y-5 min-h-[360px]">

          {/* ── STEP 1: Personal details ───────────────────────── */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="First name *" error={errors.firstName?.message}>
                  <input
                    {...register('firstName')}
                    className="form-input"
                    placeholder="e.g. Sarah"
                    autoFocus
                  />
                </Field>
                <Field label="Last name *" error={errors.lastName?.message}>
                  <input
                    {...register('lastName')}
                    className="form-input"
                    placeholder="e.g. Müller"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Date of birth *" error={errors.dateOfBirth?.message}
                  hint="Day / Month / Year">
                  <input
                    {...register('dateOfBirth')}
                    type="date"
                    className="form-input"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </Field>
                <Field label="Gender *" error={errors.gender?.message}>
                  <select {...register('gender')} className="form-input">
                    <option value="">Select gender…</option>
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Preferred language">
                  <select {...register('preferredLanguage')} className="form-input">
                    {languageOptions(defaultValues.preferredLanguage).map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Preferred contact method">
                  <select {...register('communicationPref')} className="form-input">
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="phone">Phone call</option>
                  </select>
                </Field>
              </div>
            </>
          )}

          {/* ── STEP 2: Contact ────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Mobile phone *" error={errors.phone?.message}
                  hint="Used for appointment reminders">
                  <input
                    {...register('phone')}
                    type="tel"
                    className="form-input"
                    placeholder="+94 77 123 4567"
                    autoFocus
                  />
                </Field>
                <Field label="Email address" error={errors.email?.message}
                  hint="Optional — for digital forms and statements">
                  <input
                    {...register('email')}
                    type="email"
                    className="form-input"
                    placeholder="patient@example.com"
                  />
                </Field>
              </div>

              <Field label="Address line 1">
                <input
                  {...register('addressLine1')}
                  className="form-input"
                  placeholder="Street and house number"
                />
              </Field>

              <Field label="City">
                <input
                  {...register('city')}
                  className="form-input"
                  placeholder="e.g. Minuwangoda"
                />
              </Field>
            </>
          )}

          {/* ── STEP 3: Medical history ──────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4">
                <p className="text-base font-semibold text-red-900">Medical and allergy screening</p>
                <p className="text-sm text-red-700 mt-0.5">
                  Record conditions that may affect dental treatment, medication, anesthesia or bleeding risk.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                {MEDICAL_CHECKS.map(item => (
                  <YesNoField
                    key={item.id}
                    label={item.label}
                    value={!!watch(`medicalFlags.${item.id}` as any)}
                    onChange={value => setValue(`medicalFlags.${item.id}` as any, value)}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Field label="Allergy details" hint="Drug, food, latex or other allergy. Include reaction and severity.">
                  <textarea {...register('allergyDetails')} className="form-input !h-24 resize-none" placeholder="e.g. Penicillin - rash and swelling" />
                </Field>
                <Field label="Current medications / drug history">
                  <textarea {...register('currentMedications')} className="form-input !h-24 resize-none" placeholder="Regular medicines, anticoagulants, steroids..." />
                </Field>
                <Field label="Dietary history">
                  <textarea {...register('dietaryHistory')} className="form-input !h-20 resize-none" />
                </Field>
                <Field label="Brushing history">
                  <textarea {...register('brushingHistory')} className="form-input !h-20 resize-none" />
                </Field>
                <Field label="Medical history notes">
                  <textarea {...register('medicalHistoryNote')} className="form-input !h-20 resize-none" />
                </Field>
                <Field label="Oral hygiene history">
                  <textarea {...register('oralHygieneHistory')} className="form-input !h-20 resize-none" />
                </Field>
                <Field label="Habit history">
                  <textarea {...register('habitHistory')} className="form-input !h-20 resize-none" placeholder="Smoking, betel, alcohol, bruxism..." />
                </Field>
                <Field label="Family history">
                  <textarea {...register('familyHistory')} className="form-input !h-20 resize-none" />
                </Field>
                <Field label="Social history">
                  <textarea {...register('socialHistory')} className="form-input !h-20 resize-none" />
                </Field>
                <div className="grid grid-cols-1 gap-5">
                  <Field label="Extra oral examination">
                    <textarea {...register('extraOralExamination')} className="form-input !h-20 resize-none" />
                  </Field>
                  <Field label="Intra oral examination">
                    <textarea {...register('intraOralExamination')} className="form-input !h-20 resize-none" />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <>
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 mb-2">
                <p className="text-base font-semibold text-amber-900">Emergency contact</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Who should we call if the patient needs urgent attention?
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="sm:col-span-2">
                  <Field label="Contact name">
                    <input
                      {...register('emergencyName')}
                      className="form-input"
                      placeholder="Full name"
                      autoFocus
                    />
                  </Field>
                </div>
                <Field label="Relationship">
                  <select {...register('emergencyRelation')} className="form-input">
                    <option value="">Select…</option>
                    <option value="spouse">Spouse / Partner</option>
                    <option value="parent">Parent</option>
                    <option value="child">Child</option>
                    <option value="sibling">Sibling</option>
                    <option value="friend">Friend</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </div>

              <Field label="Emergency phone number">
                <input
                  {...register('emergencyPhone')}
                  type="tel"
                  className="form-input"
                  placeholder="+94 77 000 0000"
                />
              </Field>

              <Field
                label="Practice notes"
                hint="Internal notes visible to all staff — not shown to the patient"
              >
                <textarea
                  {...register('notes')}
                  className="form-input !h-28 resize-none"
                  placeholder="e.g. Prefers morning appointments. Very nervous patient — approach gently."
                />
              </Field>
            </>
          )}

        </div>

        {/* Navigation buttons */}
        <div className="px-8 py-5 border-t border-gray-100 flex justify-between">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(s => s - 1) : history.back()}
            className="btn-secondary"
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>

          {step < STEPS.length ? (
            <button
              type="button"
              onClick={nextStep}
              className="btn-primary"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={saving}
              className="btn-primary min-w-[160px]"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent
                                   rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save changes
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

// ─── FIELD WRAPPER ────────────────────────────────────────────────────────────
function YesNoField({
  label, value, onChange,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div>
      <p className="form-label">{label}</p>
      <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            'min-w-[48px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
            !value ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            'min-w-[48px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
            value ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Yes
        </button>
      </div>
    </div>
  )
}

function Field({
  label, error, hint, children,
}: {
  label: string
  error?: string
  hint?:  string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
      {hint  && !error && <p className="form-hint">{hint}</p>}
      {error && (
        <p className="form-error flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

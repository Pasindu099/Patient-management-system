'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Check, CreditCard, HeartPulse, Phone, User } from 'lucide-react'
import { cn, ACTIVE_PATIENT_LANGUAGES, MEDICAL_CHECKS, validateNIC, formatNIC } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

const schema = z.object({
  firstName:         z.string().min(1, 'First name is required'),
  lastName:          z.string().min(1, 'Last name is required'),
  dateOfBirth:       z.string().min(1, 'Date of birth is required'),
  gender:            z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'], {
                       required_error: 'Please select a gender',
                     }),
  nicNumber:         z.string().optional(),
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
}).superRefine((data, ctx) => {
  const nic = data.nicNumber?.trim()
  if (nic && !validateNIC(nic)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nicNumber'],
      message: 'Enter a valid Sri Lankan NIC',
    })
  }
})

type FormData = z.infer<typeof schema>

export function NewPatientForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      preferredLanguage: 'en',
      communicationPref: 'email',
      gender: undefined,
      medicalFlags: {},
    },
  })

  async function onSubmit(data: FormData) {
    setSaving(true)
    try {
      const payload = {
        ...data,
        nicNumber: data.nicNumber ? formatNIC(data.nicNumber.trim()) : '',
      }
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to save patient')
      }

      const patient = await res.json()
      showToast('success', 'Patient registered', `${data.firstName} ${data.lastName} has been added.`)
      router.push(`/patients/${patient.id}`)
    } catch (e: any) {
      showToast('error', 'Could not save patient', e.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="section-card">
      <div className="section-card-body space-y-8">
        <FormSection icon={User} title="Patient details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="First name *" error={errors.firstName?.message}>
              <input {...register('firstName')} className="form-input" placeholder="e.g. Sarah" autoFocus />
            </Field>
            <Field label="Last name *" error={errors.lastName?.message}>
              <input {...register('lastName')} className="form-input" placeholder="e.g. Perera" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field label="Date of birth *" error={errors.dateOfBirth?.message} hint="Day / Month / Year">
              <input
                {...register('dateOfBirth')}
                type="date"
                className="form-input"
                max={new Date().toISOString().split('T')[0]}
              />
            </Field>
            <Field label="Gender *" error={errors.gender?.message}>
              <select {...register('gender')} className="form-input">
                <option value="">Select gender...</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </Field>
            <Field label="NIC number" error={errors.nicNumber?.message} hint="Old or new Sri Lankan NIC">
              <input {...register('nicNumber')} className="form-input uppercase" placeholder="200012345678 or 875730485V" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Preferred language">
              <select {...register('preferredLanguage')} className="form-input">
                {ACTIVE_PATIENT_LANGUAGES.map(l => (
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
        </FormSection>

        <FormSection icon={Phone} title="Contact">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Mobile phone *" error={errors.phone?.message} hint="Used for appointment reminders">
              <input {...register('phone')} type="tel" className="form-input" placeholder="+94 77 123 4567" />
            </Field>
            <Field label="Email address" error={errors.email?.message} hint="Optional">
              <input {...register('email')} type="email" className="form-input" placeholder="patient@example.com" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Address line 1">
              <input {...register('addressLine1')} className="form-input" placeholder="Street and house number" />
            </Field>
            <Field label="City">
              <input {...register('city')} className="form-input" placeholder="e.g. Minuwangoda" />
            </Field>
          </div>
        </FormSection>

        <FormSection icon={HeartPulse} title="Medical and dental history">
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
        </FormSection>

        <FormSection icon={CreditCard} title="Emergency contact and notes">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="sm:col-span-2">
              <Field label="Contact name">
                <input {...register('emergencyName')} className="form-input" placeholder="Full name" />
              </Field>
            </div>
            <Field label="Relationship">
              <select {...register('emergencyRelation')} className="form-input">
                <option value="">Select...</option>
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
            <input {...register('emergencyPhone')} type="tel" className="form-input" placeholder="+94 77 000 0000" />
          </Field>

          <Field label="Practice notes" hint="Internal notes visible to staff">
            <textarea
              {...register('notes')}
              className="form-input !h-28 resize-none"
              placeholder="e.g. Prefers morning appointments. Very nervous patient - approach gently."
            />
          </Field>
        </FormSection>
      </div>

      <div className="px-8 py-5 border-t border-gray-100 flex justify-between">
        <button type="button" onClick={() => history.back()} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary min-w-[170px]">
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Register patient
            </>
          )}
        </button>
      </div>
    </form>
  )
}

function FormSection({
  icon: Icon, title, children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
        <Icon className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

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

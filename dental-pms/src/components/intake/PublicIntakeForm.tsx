'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

type Branch = { id: string; name: string; city?: string | null }
type PatientType = 'EXISTING' | 'NEW' | 'UNKNOWN'

const initialForm = {
  tokenNumber: '',
  patientType: 'EXISTING' as PatientType,
  firstName: '',
  lastName: '',
  phone: '',
  patientNumber: '',
  dateOfBirth: '',
  gender: '',
  reason: '',
  allergies: '',
  medicalWarnings: '',
  emergencyName: '',
  emergencyPhone: '',
}

export function PublicIntakeForm({ branches }: { branches: Branch[] }) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '')
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ matched: boolean; token: string } | null>(null)
  const [error, setError] = useState('')

  function setField(name: keyof typeof initialForm, value: string) {
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!branchId || !form.tokenNumber) {
      setError('Please enter your token number.')
      return
    }
    if (form.patientType === 'EXISTING' && !form.phone && !form.patientNumber) {
      setError('Existing patients should enter a phone number or patient number.')
      return
    }
    if (form.patientType === 'NEW' && (!form.firstName || !form.phone)) {
      setError('New patients should enter at least first name and phone number.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, branchId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not submit intake')
      setDone({ matched: json.matched, token: form.tokenNumber })
      setForm(initialForm)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-10">
        <div className="w-full rounded-2xl border border-green-200 bg-white p-6 text-center shadow-sm">
          <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">You are checked in</h1>
          <p className="mt-2 text-base text-gray-600">
            Token {done.token} is now visible to the clinic team.
          </p>
          <p className="mt-3 text-sm text-gray-500">
            Please keep your token and wait in the lobby until your number is called.
          </p>
          <button onClick={() => setDone(null)} className="btn-primary mt-6 w-full justify-center">
            Submit another token
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lobby intake</h1>
          <p className="text-sm text-gray-500">Enter your token number before you wait.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        {error && (
          <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">Branch</label>
            <select value={branchId} onChange={e => setBranchId(e.target.value)} className="form-input">
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}{branch.city ? ` - ${branch.city}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Token number *</label>
            <input
              value={form.tokenNumber}
              onChange={e => setField('tokenNumber', e.target.value)}
              className="form-input text-xl font-bold"
              inputMode="numeric"
              placeholder="e.g. 12"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="form-label">Have you visited this clinic before?</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['EXISTING', 'Yes'],
              ['NEW', 'No'],
              ['UNKNOWN', 'Not sure'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setField('patientType', value)}
                className={cn(
                  'rounded-xl border-2 px-3 py-3 text-sm font-bold transition-colors',
                  form.patientType === value
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {form.patientType === 'EXISTING' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone number">
              <input value={form.phone} onChange={e => setField('phone', e.target.value)} className="form-input" placeholder="077..." />
            </Field>
            <Field label="Patient number">
              <input value={form.patientNumber} onChange={e => setField('patientNumber', e.target.value)} className="form-input" placeholder="PT-..." />
            </Field>
          </div>
        )}

        {(form.patientType === 'NEW' || form.patientType === 'UNKNOWN') && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name *">
              <input value={form.firstName} onChange={e => setField('firstName', e.target.value)} className="form-input" />
            </Field>
            <Field label="Last name">
              <input value={form.lastName} onChange={e => setField('lastName', e.target.value)} className="form-input" />
            </Field>
            <Field label="Phone number *">
              <input value={form.phone} onChange={e => setField('phone', e.target.value)} className="form-input" />
            </Field>
            <Field label="Date of birth">
              <input value={form.dateOfBirth} onChange={e => setField('dateOfBirth', e.target.value)} type="date" className="form-input" />
            </Field>
            <Field label="Gender">
              <select value={form.gender} onChange={e => setField('gender', e.target.value)} className="form-input">
                <option value="">Select...</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </Field>
            <Field label="Emergency phone">
              <input value={form.emergencyPhone} onChange={e => setField('emergencyPhone', e.target.value)} className="form-input" />
            </Field>
          </div>
        )}

        <Field label="Reason for visit">
          <input value={form.reason} onChange={e => setField('reason', e.target.value)} className="form-input" placeholder="Tooth pain, follow-up, cleaning..." />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Allergies">
            <textarea value={form.allergies} onChange={e => setField('allergies', e.target.value)} className="form-input !h-24 resize-none" />
          </Field>
          <Field label="Medical warnings">
            <textarea value={form.medicalWarnings} onChange={e => setField('medicalWarnings', e.target.value)} className="form-input !h-24 resize-none" />
          </Field>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
          {saving ? 'Submitting...' : 'Submit intake'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

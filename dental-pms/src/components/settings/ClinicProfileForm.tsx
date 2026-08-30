'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { showToast } from '@/components/ui/Toast'

interface Props {
  initialData: any
}

export function ClinicProfileForm({ initialData }: Props) {
  const [name,    setName]    = useState(initialData?.name    ?? 'DentalCare')
  const [address, setAddress] = useState(initialData?.address ?? '')
  const [city,    setCity]    = useState(initialData?.city    ?? '')
  const [phone,   setPhone]   = useState(initialData?.phone   ?? '')
  const [email,   setEmail]   = useState(initialData?.email   ?? '')
  const [saving,  setSaving]  = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/settings/branches', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: initialData?.id, name, address, city, phone, email }),
      })
      if (!res.ok) throw new Error('Failed to save')
      showToast('success', 'Clinic profile saved')
    } catch {
      showToast('error', 'Could not save clinic profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="section-card">
      <div className="section-card-body space-y-5">
        <div>
          <label className="form-label">Clinic name *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="form-input" placeholder="e.g. DentalCare Pvt Ltd" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="form-label">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="form-input" placeholder="+94 11 234 5678" />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="form-input" placeholder="info@dentalcare.lk" />
          </div>
        </div>
        <div>
          <label className="form-label">Address</label>
          <input value={address} onChange={e => setAddress(e.target.value)}
            className="form-input" placeholder="Street address" />
        </div>
        <div>
          <label className="form-label">City</label>
          <input value={city} onChange={e => setCity(e.target.value)}
            className="form-input" placeholder="Colombo" />
        </div>
        <div className="pt-2 border-t border-gray-100">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
            ) : (
              <><Save className="w-4 h-4" />Save profile</>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}

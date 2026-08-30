'use client'

import { useState } from 'react'
import { Plus, Edit2, Save, X, Building2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Branch {
  id: string; name: string; address?: string; city?: string
  phone?: string; email?: string; isActive: boolean
  _count: { appointments: number }
  users: { user: { id: string; name: string; role: string }; isPrimary: boolean }[]
}

interface Props {
  initialBranches: Branch[]
  allStaff:        { id: string; name: string; role: string; email: string }[]
}

const ROLE_COLORS: Record<string, string> = {
  DOCTOR: 'bg-blue-100 text-blue-700', HEAD_NURSE: 'bg-indigo-100 text-indigo-700',
  RECEPTIONIST: 'bg-amber-100 text-amber-700', NURSE: 'bg-green-100 text-green-700',
  ADMIN: 'bg-purple-100 text-purple-700',
}

export function BranchManager({ initialBranches, allStaff }: Props) {
  const [branches, setBranches] = useState(initialBranches)
  const [editing,  setEditing]  = useState<string | null>(null)
  const [showNew,  setShowNew]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  // Form state
  const blank = { name: '', address: '', city: '', phone: '', email: '' }
  const [form, setForm] = useState(blank)

  async function saveBranch(isNew: boolean, id?: string) {
    if (!form.name.trim()) { showToast('error', 'Branch name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/branches', {
        method:  isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(isNew ? form : { id, ...form }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      if (isNew) {
        setBranches(prev => [...prev, { ...json, _count: { appointments: 0 }, users: [] }])
        setShowNew(false)
      } else {
        setBranches(prev => prev.map(b => b.id === id ? { ...b, ...json } : b))
        setEditing(null)
      }
      setForm(blank)
      showToast('success', isNew ? 'Branch created' : 'Branch updated')
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(branch: Branch) {
    setForm({ name: branch.name, address: branch.address ?? '', city: branch.city ?? '', phone: branch.phone ?? '', email: branch.email ?? '' })
    setEditing(branch.id)
    setShowNew(false)
  }

  return (
    <div className="space-y-4">
      {/* Branch cards */}
      {branches.map(branch => (
        <div key={branch.id} className="section-card">
          {editing === branch.id ? (
            <div className="section-card-body space-y-4">
              <BranchForm form={form} setForm={setForm} />
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
                <button onClick={() => saveBranch(false, branch.id)} disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : <><Save className="w-4 h-4" />Save changes</>}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="section-card-header">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{branch.name}</p>
                    <p className="text-sm text-gray-500">
                      {[branch.city, branch.phone].filter(Boolean).join(' · ')}
                      {' · '}{branch._count.appointments} appointments
                    </p>
                  </div>
                </div>
                <button onClick={() => startEdit(branch)} className="btn-secondary !text-sm !px-3 !py-2">
                  <Edit2 className="w-4 h-4" />Edit
                </button>
              </div>

              {/* Staff assigned */}
              <div className="px-6 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-semibold text-gray-600">Staff ({branch.users.length})</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {branch.users.length === 0
                    ? <span className="text-sm text-gray-400 italic">No staff assigned</span>
                    : branch.users.map(({ user, isPrimary }) => (
                      <span key={user.id} className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-full',
                        ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600'
                      )}>
                        {user.name}{isPrimary ? ' (primary)' : ''}
                      </span>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      ))}

      {/* Add new branch */}
      {showNew ? (
        <div className="section-card">
          <div className="section-card-header">
            <h3 className="text-lg font-semibold text-gray-900">New branch</h3>
            <button onClick={() => { setShowNew(false); setForm(blank) }} className="text-gray-400 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="section-card-body space-y-4">
            <BranchForm form={form} setForm={setForm} />
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => { setShowNew(false); setForm(blank) }} className="btn-secondary">Cancel</button>
              <button onClick={() => saveBranch(true)} disabled={saving} className="btn-primary">
                {saving ? 'Creating…' : <><Plus className="w-4 h-4" />Create branch</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowNew(true); setForm(blank); setEditing(null) }}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2
                     border-dashed border-gray-300 rounded-2xl text-base font-semibold
                     text-gray-500 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50
                     transition-all"
        >
          <Plus className="w-5 h-5" />
          Add new branch
        </button>
      )}
    </div>
  )
}

function BranchForm({ form, setForm }: { form: any; setForm: any }) {
  const f = (field: string) => ({
    value: form[field],
    onChange: (e: any) => setForm((p: any) => ({ ...p, [field]: e.target.value })),
  })
  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">Branch name *</label>
        <input {...f('name')} className="form-input" placeholder="e.g. Colombo 03" autoFocus />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Phone</label>
          <input {...f('phone')} className="form-input" placeholder="+94 11 234 5678" />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input {...f('email')} className="form-input" placeholder="branch@clinic.lk" />
        </div>
      </div>
      <div>
        <label className="form-label">Address</label>
        <input {...f('address')} className="form-input" placeholder="Street address" />
      </div>
      <div>
        <label className="form-label">City</label>
        <input {...f('city')} className="form-input" placeholder="Colombo" />
      </div>
    </div>
  )
}

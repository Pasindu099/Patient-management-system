'use client'

import { useMemo, useState } from 'react'
import {
  Plus, Edit2, X, Save, Trash2,
  User, CheckCircle, XCircle, Eye, EyeOff,
} from 'lucide-react'
import { cn, ROLE_LABELS, ROLE_COLORS } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { UserRole } from '@prisma/client'

interface StaffMember {
  id: string; name: string; email: string; role: UserRole
  phone?: string | null; isActive: boolean
  branches: { branch: { id: string; name: string }; isPrimary: boolean }[]
}

interface Props {
  initialStaff: StaffMember[]
  branches:     { id: string; name: string }[]
}

export function StaffManager({ initialStaff, branches }: Props) {
  const [staff,   setStaff]   = useState(initialStaff)
  const [editing, setEditing] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [saving,  setSaving]  = useState(false)

  const [showInactive,  setShowInactive]  = useState(false)
  const [pendingDelete, setPendingDelete] = useState<StaffMember | null>(null)
  const [deleting,      setDeleting]      = useState(false)

  const inactiveCount = useMemo(() => staff.filter(s => !s.isActive).length, [staff])
  const visibleStaff  = useMemo(
    () => (showInactive ? staff : staff.filter(s => s.isActive)),
    [staff, showInactive],
  )

  const blank = { name: '', email: '', password: '', role: 'RECEPTIONIST' as UserRole, phone: '', branchIds: [] as string[] }
  const [form, setForm] = useState(blank)

  function setField(field: string, value: any) {
    setForm(p => ({ ...p, [field]: value }))
  }

  function toggleBranch(id: string) {
    setForm(p => ({
      ...p,
      branchIds: p.branchIds.includes(id)
        ? p.branchIds.filter(b => b !== id)
        : [...p.branchIds, id],
    }))
  }

  async function saveStaff(isNew: boolean, id?: string) {
    if (!form.name.trim() || !form.email.trim()) {
      showToast('error', 'Name and email are required'); return
    }
    if (isNew && form.password.length < 8) {
      showToast('error', 'Password must be at least 8 characters'); return
    }
    setSaving(true)
    try {
      const body = isNew
        ? { ...form }
        : { id, name: form.name, phone: form.phone, role: form.role, branchIds: form.branchIds,
            ...(form.password ? { password: form.password } : {}) }

      const res  = await fetch('/api/settings/staff', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(isNew ? { ...form, _isNew: true } : body),
      })

      // Use POST for new staff
      const res2 = isNew
        ? await fetch('/api/settings/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        : res

      const json = await (isNew ? res2 : res).json()
      if (!(isNew ? res2 : res).ok) throw new Error(json.error?.formErrors?.[0] ?? JSON.stringify(json.error) ?? 'Failed')

      if (isNew) {
        setStaff(prev => [...prev, { ...json, branches: [] }])
        setShowNew(false)
      } else {
        setStaff(prev => prev.map(s => s.id === id ? { ...s, ...json } : s))
        setEditing(null)
      }
      setForm(blank)
      showToast('success', isNew ? 'Staff account created' : 'Staff updated')
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(member: StaffMember) {
    try {
      const res = await fetch('/api/settings/staff', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id, isActive: !member.isActive }),
      })
      if (!res.ok) throw new Error()
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, isActive: !s.isActive } : s))
      showToast('success', member.isActive ? 'Account deactivated' : 'Account activated')
    } catch {
      showToast('error', 'Could not update account')
    }
  }

  async function deleteStaff(member: StaffMember) {
    setDeleting(true)
    try {
      const res  = await fetch(`/api/settings/staff?id=${encodeURIComponent(member.id)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not delete account')

      setStaff(prev => prev.filter(s => s.id !== member.id))
      setPendingDelete(null)
      if (editing === member.id) setEditing(null)
      showToast('success', `${member.name} deleted`)
    } catch (e: any) {
      setPendingDelete(null)
      showToast('error', e.message)
    } finally {
      setDeleting(false)
    }
  }

  function startEdit(member: StaffMember) {
    setForm({
      name: member.name, email: member.email, password: '',
      role: member.role, phone: member.phone ?? '',
      branchIds: member.branches.map(b => b.branch.id),
    })
    setEditing(member.id)
    setShowNew(false)
  }

  return (
    <div className="space-y-4">
      {/* List controls */}
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm text-gray-500">
          {staff.length - inactiveCount} active
          {inactiveCount > 0 && ` · ${inactiveCount} deactivated`}
        </p>
        {inactiveCount > 0 && (
          <button
            onClick={() => setShowInactive(v => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
          >
            {showInactive
              ? <><EyeOff className="w-4 h-4" />Hide deactivated</>
              : <><Eye className="w-4 h-4" />Show deactivated ({inactiveCount})</>}
          </button>
        )}
      </div>

      {/* Staff list */}
      {visibleStaff.map(member => (
        <div key={member.id} className={cn('section-card', !member.isActive && 'opacity-60')}>
          {editing === member.id ? (
            <div className="section-card-body space-y-4">
              <StaffForm form={form} setField={setField} toggleBranch={toggleBranch} branches={branches} isNew={false} />
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
                <button onClick={() => saveStaff(false, member.id)} disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : <><Save className="w-4 h-4" />Save</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="section-card-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {member.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-gray-900">{member.name}</p>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', ROLE_COLORS[member.role])}>
                      {ROLE_LABELS[member.role]}
                    </span>
                    {!member.isActive && <span className="text-xs text-red-600 font-semibold">Inactive</span>}
                  </div>
                  <p className="text-sm text-gray-500">
                    {member.email}
                    {member.phone ? ` · ${member.phone}` : ''}
                    {member.branches.length > 0 ? ` · ${member.branches.map(b => b.branch.name).join(', ')}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(member)} className="btn-secondary !text-sm !px-3 !py-2">
                  <Edit2 className="w-3.5 h-3.5" />Edit
                </button>
                <button
                  onClick={() => toggleActive(member)}
                  className={cn('btn-secondary !text-sm !px-3 !py-2', member.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50')}
                >
                  {member.isActive
                    ? <><XCircle className="w-3.5 h-3.5" />Deactivate</>
                    : <><CheckCircle className="w-3.5 h-3.5" />Activate</>}
                </button>
                <button
                  onClick={() => setPendingDelete(member)}
                  title="Delete account permanently"
                  aria-label={`Delete ${member.name}`}
                  className="btn-secondary !text-sm !px-3 !py-2 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add new */}
      {showNew ? (
        <div className="section-card">
          <div className="section-card-header">
            <h3 className="text-lg font-semibold text-gray-900">Add staff member</h3>
            <button onClick={() => { setShowNew(false); setForm(blank) }}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="section-card-body space-y-4">
            <StaffForm form={form} setField={setField} toggleBranch={toggleBranch} branches={branches} isNew />
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => { setShowNew(false); setForm(blank) }} className="btn-secondary">Cancel</button>
              <button onClick={() => saveStaff(true)} disabled={saving} className="btn-primary">
                {saving ? 'Creating…' : <><Plus className="w-4 h-4" />Create account</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowNew(true); setForm(blank); setEditing(null) }}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2
                     border-dashed border-gray-300 rounded-2xl text-base font-semibold
                     text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
        >
          <Plus className="w-5 h-5" />Add staff member
        </button>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? ''}?`}
        description={
          'This permanently removes the account and its branch access. It only works for '
          + 'accounts with no clinical or financial history — otherwise deactivate instead.'
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete account'}
        variant="danger"
        onConfirm={() => { if (pendingDelete && !deleting) deleteStaff(pendingDelete) }}
        onCancel={() => { if (!deleting) setPendingDelete(null) }}
      />
    </div>
  )
}

function StaffForm({ form, setField, toggleBranch, branches, isNew }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Full name *</label>
          <input value={form.name} onChange={e => setField('name', e.target.value)} className="form-input" placeholder="Dr. Saman Perera" autoFocus />
        </div>
        <div>
          <label className="form-label">Role *</label>
          <select value={form.role} onChange={e => setField('role', e.target.value)} className="form-input">
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">{isNew ? 'Email *' : 'Email'}</label>
          <input type="email" value={form.email} onChange={e => setField('email', e.target.value)}
            className="form-input" placeholder="dr.perera@dentalcare.lk" disabled={!isNew} />
        </div>
        <div>
          <label className="form-label">Phone</label>
          <input value={form.phone} onChange={e => setField('phone', e.target.value)} className="form-input" placeholder="+94 77 200 0001" />
        </div>
      </div>
      <div>
        <label className="form-label">{isNew ? 'Password *' : 'New password (leave blank to keep current)'}</label>
        <input type="password" value={form.password} onChange={e => setField('password', e.target.value)}
          className="form-input" placeholder={isNew ? 'Min 8 characters' : 'Leave blank to keep current'} />
      </div>
      {branches.length > 0 && (
        <div>
          <label className="form-label">Branch access</label>
          <div className="flex flex-wrap gap-2">
            {branches.map((b: any) => (
              <button key={b.id} type="button" onClick={() => toggleBranch(b.id)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors min-h-[44px]',
                  form.branchIds.includes(b.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                )}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

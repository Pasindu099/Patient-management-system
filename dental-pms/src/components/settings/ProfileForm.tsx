'use client'

import { useState } from 'react'
import { Save, Eye, EyeOff } from 'lucide-react'
import { cn, ROLE_LABELS, formatDateTime } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import type { UserRole } from '@prisma/client'

interface Props {
  user: { id: string; name: string; email: string; phone?: string | null; role: UserRole; lastLoginAt?: Date | null }
}

export function ProfileForm({ user }: Props) {
  const [name,     setName]     = useState(user.name)
  const [phone,    setPhone]    = useState(user.phone ?? '')
  const [currPwd,  setCurrPwd]  = useState('')
  const [newPwd,   setNewPwd]   = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { showToast('error', 'Name is required'); return }
    if (newPwd && newPwd.length < 8) { showToast('error', 'New password must be at least 8 characters'); return }
    if (newPwd && !currPwd) { showToast('error', 'Enter your current password to change it'); return }

    setSaving(true)
    try {
      const body: any = { name, phone }
      if (newPwd) { body.currentPassword = currPwd; body.newPassword = newPwd }

      const res  = await fetch('/api/settings/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')

      showToast('success', 'Profile updated')
      setCurrPwd(''); setNewPwd('')
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Account info card */}
      <div className="section-card">
        <div className="section-card-header bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
              {user.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">{user.name}</p>
              <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {ROLE_LABELS[user.role]}
              </span>
            </div>
          </div>
          {user.lastLoginAt && (
            <p className="text-sm text-gray-400">
              Last login: {formatDateTime(user.lastLoginAt)}
            </p>
          )}
        </div>
      </div>

      {/* Edit form */}
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="text-lg font-semibold text-gray-900">Personal details</h2>
        </div>
        <div className="section-card-body space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="form-label">Full name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="form-input" required />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input value={user.email} disabled className="form-input opacity-50 cursor-not-allowed" />
              <p className="form-hint">Email cannot be changed. Contact admin if needed.</p>
            </div>
          </div>
          <div>
            <label className="form-label">Phone number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="form-input max-w-xs" placeholder="+94 77 123 4567" />
          </div>
        </div>
      </div>

      {/* Password change */}
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="text-lg font-semibold text-gray-900">Change password</h2>
          <p className="text-sm text-gray-400">Leave blank to keep current password</p>
        </div>
        <div className="section-card-body space-y-4">
          <div>
            <label className="form-label">Current password</label>
            <div className="relative max-w-sm">
              <input
                type={showPwd ? 'text' : 'password'}
                value={currPwd}
                onChange={e => setCurrPwd(e.target.value)}
                className="form-input pr-12"
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="form-label">New password</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              className="form-input max-w-sm"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
            : <><Save className="w-4 h-4" />Save changes</>}
        </button>
      </div>
    </form>
  )
}

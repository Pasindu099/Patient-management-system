'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save } from 'lucide-react'
import { showToast } from '@/components/ui/Toast'

export function StaffContractForm({
  userId,
  currentBaseSalaryCents,
  currentTitle,
}: {
  userId: string
  currentBaseSalaryCents?: number
  currentTitle?: string
}) {
  const router = useRouter()
  const now = new Date()
  const [title, setTitle] = useState(currentTitle || 'Fixed monthly salary')
  const [baseSalary, setBaseSalary] = useState(currentBaseSalaryCents ? String(currentBaseSalaryCents / 100) : '')
  const [startDate, setStartDate] = useState(now.toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [creatingRecord, setCreatingRecord] = useState(false)

  async function saveContract() {
    const base = Number(baseSalary)
    if (!base || base <= 0) {
      showToast('error', 'Enter a fixed monthly salary')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/staff/${userId}/contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, baseSalary: base, startDate, notes: notes || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save fixed salary')
      showToast('success', 'Fixed monthly salary saved')
      setNotes('')
      router.refresh()
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function createThisMonthRecord() {
    const base = Number(baseSalary)
    if (!base || base <= 0) {
      showToast('error', 'Enter a fixed monthly salary first')
      return
    }

    setCreatingRecord(true)
    try {
      const res = await fetch('/api/salaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          periodYear: now.getFullYear(),
          periodMonth: now.getMonth() + 1,
          base,
          allowances: 0,
          deductions: 0,
          notes: title || 'Fixed monthly salary',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not create salary record')
      showToast('success', 'This month salary record created')
      router.refresh()
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setCreatingRecord(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="form-label">Salary title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="form-input" placeholder="Fixed monthly salary" />
        </div>
        <div>
          <label className="form-label">Monthly salary (Rs)</label>
          <input value={baseSalary} onChange={e => setBaseSalary(e.target.value)} type="number" min="0" className="form-input" placeholder="75000" />
        </div>
        <div>
          <label className="form-label">Effective from</label>
          <input value={startDate} onChange={e => setStartDate(e.target.value)} type="date" className="form-input" />
        </div>
      </div>
      <div>
        <label className="form-label">Notes</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} className="form-input" placeholder="Allowance terms, working days, contract note..." />
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={saveContract} disabled={saving} className="btn-primary">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save fixed salary'}
        </button>
        <button onClick={createThisMonthRecord} disabled={creatingRecord} className="btn-secondary">
          <Plus className="h-4 w-4" />
          {creatingRecord ? 'Creating...' : 'Create this month salary record'}
        </button>
      </div>
    </div>
  )
}

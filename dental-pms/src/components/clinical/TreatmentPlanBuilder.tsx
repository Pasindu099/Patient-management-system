'use client'

import { useState } from 'react'
import { Plus, Trash2, CheckCircle, Clock, XCircle } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface PlanItem {
  id:           string
  procedureName: string
  toothNumbers: string
  fee:          number
  currency:     'LKR' | 'USD'
  status:       'PLANNED' | 'COMPLETED' | 'DECLINED'
  phase:        number
}

interface Props {
  patientId:   string
  currentUser: { id: string; name: string }
  onSaved:     () => void
}

const SL_PROCEDURES = [
  'Scaling and polishing',
  'Composite filling (anterior)',
  'Composite filling (posterior)',
  'Root canal treatment',
  'Crown (PFM)',
  'Crown (Zirconia)',
  'Extraction (simple)',
  'Extraction (surgical)',
  'Denture (full)',
  'Denture (partial)',
  'Implant placement',
  'Implant crown',
  'Teeth whitening',
  'Orthodontic consultation',
  'Veneer',
  'Inlay / Onlay',
  'Bridge',
  'Consultation',
]

function makeItem(phase = 1): PlanItem {
  return {
    id: Math.random().toString(36).slice(2),
    procedureName: '',
    toothNumbers: '',
    fee: 0,
    currency: 'LKR',
    status: 'PLANNED',
    phase,
  }
}

const STATUS_CONFIG = {
  PLANNED:   { label: 'Planned',   icon: Clock,        color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Completed', icon: CheckCircle,  color: 'bg-green-100 text-green-700' },
  DECLINED:  { label: 'Declined',  icon: XCircle,      color: 'bg-red-100 text-red-700' },
}

export function TreatmentPlanBuilder({ patientId, currentUser, onSaved }: Props) {
  const [title,    setTitle]    = useState('')
  const [items,    setItems]    = useState<PlanItem[]>([makeItem(1)])
  const [currency, setCurrency] = useState<'LKR' | 'USD'>('LKR')
  const [saving,   setSaving]   = useState(false)
  const [show,     setShow]     = useState(false)

  const totalFee = items.reduce((s, i) => s + i.fee, 0)

  function updateItem(id: string, field: keyof PlanItem, value: any) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  function removeItem(id: string) {
    if (items.length === 1) return
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleSave() {
    if (!title.trim()) { showToast('error', 'Please enter a plan title'); return }
    const valid = items.filter(i => i.procedureName.trim())
    if (valid.length === 0) { showToast('error', 'Please add at least one procedure'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/clinical/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, title, currency, items: valid }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast('success', 'Treatment plan saved')
      setTitle(''); setItems([makeItem(1)]); setShow(false)
      onSaved()
    } catch {
      showToast('error', 'Could not save treatment plan')
    } finally {
      setSaving(false)
    }
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-4
                   border-2 border-dashed border-gray-300 rounded-xl text-base
                   font-semibold text-gray-500 hover:border-blue-400 hover:text-blue-600
                   hover:bg-blue-50 transition-all"
      >
        <Plus className="w-5 h-5" />
        Create new treatment plan
      </button>
    )
  }

  return (
    <div className="section-card border-2 border-blue-200 animate-fade-in">
      <div className="section-card-header bg-blue-50">
        <h3 className="text-lg font-semibold text-blue-900">New treatment plan</h3>
        <div className="flex gap-2">
          {(['LKR','USD'] as const).map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-colors',
                currency === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'
              )}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="section-card-body space-y-4">
        <div>
          <label className="form-label">Plan title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="form-input"
            placeholder="e.g. Full mouth rehabilitation, Caries treatment phase 1…"
            autoFocus
          />
        </div>

        {/* Items */}
        <div>
          <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-2">
            <div className="col-span-5">Procedure</div>
            <div className="col-span-2">Teeth</div>
            <div className="col-span-1 text-center">Phase</div>
            <div className="col-span-2 text-right">Fee ({currency})</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl p-2">
                <div className="col-span-12 sm:col-span-5">
                  <input
                    type="text"
                    value={item.procedureName}
                    onChange={e => updateItem(item.id, 'procedureName', e.target.value)}
                    list="proc-list"
                    placeholder="Procedure…"
                    className="form-input !py-2 !text-sm"
                  />
                  <datalist id="proc-list">
                    {SL_PROCEDURES.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
                <div className="col-span-5 sm:col-span-2">
                  <input
                    type="text"
                    value={item.toothNumbers}
                    onChange={e => updateItem(item.id, 'toothNumbers', e.target.value)}
                    placeholder="e.g. 16"
                    className="form-input !py-2 !text-sm"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={item.phase}
                    onChange={e => updateItem(item.id, 'phase', parseInt(e.target.value) || 1)}
                    className="form-input !py-2 !text-sm text-center"
                  />
                </div>
                <div className="col-span-5 sm:col-span-2">
                  <input
                    type="number"
                    min="0"
                    step={currency === 'LKR' ? '500' : '10'}
                    value={item.fee || ''}
                    onChange={e => updateItem(item.id, 'fee', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="form-input !py-2 !text-sm text-right"
                  />
                </div>
                <div className="col-span-5 sm:col-span-1">
                  <select
                    value={item.status}
                    onChange={e => updateItem(item.id, 'status', e.target.value)}
                    className="form-input !py-2 !text-xs"
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-center">
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setItems(prev => [...prev, makeItem(items[items.length - 1]?.phase ?? 1)])}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-semibold py-2 mt-1 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add procedure
          </button>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-3 border-t-2 border-gray-200">
          <p className="text-base text-gray-600">
            {items.filter(i => i.procedureName).length} procedure{items.filter(i => i.procedureName).length !== 1 ? 's' : ''}
          </p>
          <p className="text-xl font-bold text-gray-900">
            Total: {formatCurrency(totalFee, currency)}
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setShow(false)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
            ) : 'Save treatment plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

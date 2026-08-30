'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Fee { id: string; name: string; category: string }
interface Item { id: string; name: string; unit: string }
interface Line { itemId: string; quantity: number }

export function BomManager({ fees, items }: { fees: Fee[]; items: Item[] }) {
  const [search, setSearch] = useState('')
  const [feeId, setFeeId] = useState('')
  const [patientType, setPatientType] = useState<'ADULT' | 'CHILD'>('ADULT')
  const [lines, setLines] = useState<Line[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!feeId) { setLines([]); return }
    setLoading(true)
    fetch(`/api/inventory/boms?feeId=${feeId}`)
      .then(r => r.json())
      .then(boms => {
        const bom = boms.find((b: any) => b.patientType === patientType)
        setLines(bom ? bom.lines.map((l: any) => ({ itemId: l.itemId, quantity: l.quantity })) : [])
      })
      .finally(() => setLoading(false))
  }, [feeId, patientType])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/inventory/boms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeId, patientType, lines: lines.filter(l => l.itemId && l.quantity > 0) }),
      })
      if (!res.ok) throw new Error()
      showToast('success', 'BOM saved')
    } catch {
      showToast('error', 'Could not save BOM')
    } finally {
      setSaving(false)
    }
  }

  const filteredFees = fees.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
  const selectedFee = fees.find(f => f.id === feeId)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Treatment material usage</h1>
        <p className="text-base text-gray-500 mt-1">
          Set average resource usage per treatment. Auto-deducted from inventory when a doctor marks it done.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Fee picker */}
        <div className="section-card lg:col-span-1">
          <div className="section-card-header">
            <h2 className="text-base font-semibold text-gray-900">Treatment</h2>
          </div>
          <div className="p-3">
            <input value={search} onChange={e => setSearch(e.target.value)} className="form-input !text-sm mb-2" placeholder="Search treatments…" />
            <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
              {filteredFees.map(f => (
                <button key={f.id} onClick={() => setFeeId(f.id)}
                  className={cn('w-full text-left px-3 py-2.5 text-sm', feeId === f.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50')}>
                  {f.name}
                  <span className="block text-xs text-gray-400">{f.category}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* BOM editor */}
        <div className="section-card lg:col-span-2">
          {!selectedFee ? (
            <div className="py-16 text-center text-gray-400">Select a treatment to configure its material usage</div>
          ) : (
            <>
              <div className="section-card-header">
                <h2 className="text-base font-semibold text-gray-900">{selectedFee.name}</h2>
                <div className="flex rounded-lg border-2 border-gray-200 overflow-hidden">
                  {(['ADULT', 'CHILD'] as const).map(t => (
                    <button key={t} onClick={() => setPatientType(t)}
                      className={cn('px-4 py-1.5 text-sm font-semibold', patientType === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600')}>
                      {t === 'ADULT' ? 'Adult' : 'Child'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="section-card-body space-y-3">
                {loading ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : (
                  <>
                    {lines.map((line, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select value={line.itemId}
                          onChange={e => setLines(p => p.map((l, j) => j === i ? { ...l, itemId: e.target.value } : l))}
                          className="form-input !py-2 text-sm flex-1">
                          <option value="">Select item…</option>
                          {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                        </select>
                        <input type="number" min="0" step="any" value={line.quantity || ''}
                          onChange={e => setLines(p => p.map((l, j) => j === i ? { ...l, quantity: parseFloat(e.target.value) || 0 } : l))}
                          className="form-input !py-2 text-sm w-24 text-right" placeholder="Qty" />
                        <span className="text-sm text-gray-400 w-14">{items.find(it => it.id === line.itemId)?.unit ?? ''}</span>
                        <button onClick={() => setLines(p => p.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setLines(p => [...p, { itemId: '', quantity: 0 }])}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-sm">
                      <Plus className="w-4 h-4" />Add item
                    </button>
                    <div className="flex justify-end pt-3 border-t border-gray-100">
                      <button onClick={save} disabled={saving} className="btn-primary">
                        <Save className="w-4 h-4" />Save
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

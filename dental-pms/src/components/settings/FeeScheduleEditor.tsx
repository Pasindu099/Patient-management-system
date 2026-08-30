'use client'

import { useState } from 'react'
import { Check, Edit2, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { cn, formatLKR } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Fee {
  id:          string
  category:    string
  subcategory: string | null
  name:        string
  price:       number
  isActive:    boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  'Restorative':       'bg-blue-600',
  'Prosthetic':        'bg-purple-600',
  'Periodontal':       'bg-teal-600',
  'Endodontic':        'bg-red-600',
  'Cosmetic':          'bg-pink-600',
  'Orthodontic':       'bg-amber-600',
  'Minor Oral Surgery':'bg-orange-600',
  'Implantology':      'bg-green-700',
}

interface Props {
  grouped: Record<string, Fee[]>
}

export function FeeScheduleEditor({ grouped }: Props) {
  const [fees,       setFees]       = useState(grouped)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editValue,  setEditValue]  = useState('')
  const [saving,     setSaving]     = useState<string | null>(null)
  const [collapsed,  setCollapsed]  = useState<Record<string, boolean>>({})

  function startEdit(fee: Fee) {
    setEditingId(fee.id)
    setEditValue(String(fee.price || ''))
  }

  async function savePrice(fee: Fee) {
    const newPrice = parseFloat(editValue) || 0
    if (newPrice === fee.price) { setEditingId(null); return }

    setSaving(fee.id)
    try {
      const res = await fetch(`/api/fees/${fee.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ price: newPrice }),
      })
      if (!res.ok) throw new Error('Failed to save')

      // Update local state
      setFees(prev => ({
        ...prev,
        [fee.category]: prev[fee.category].map(f =>
          f.id === fee.id ? { ...f, price: newPrice } : f
        ),
      }))
      showToast('success', `${fee.name} updated to ${formatLKR(newPrice)}`)
    } catch {
      showToast('error', 'Failed to save price')
    } finally {
      setSaving(null)
      setEditingId(null)
    }
  }

  function toggleCategory(cat: string) {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const categories = Object.keys(fees).sort()
  const totalPriced = categories.flatMap(c => fees[c]).filter(f => f.price > 0).length
  const total       = categories.flatMap(c => fees[c]).length

  return (
    <div className="space-y-4">

      {/* Summary */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-green-500 h-full rounded-full transition-all"
            style={{ width: `${(totalPriced / total) * 100}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-gray-600 flex-shrink-0">
          {totalPriced}/{total} priced
        </span>
      </div>

      {/* Category sections */}
      {categories.map(category => {
        const catFees     = fees[category]
        const isCollapsed = collapsed[category]
        const pricedInCat = catFees.filter(f => f.price > 0).length
        const color       = CATEGORY_COLORS[category] ?? 'bg-gray-600'

        return (
          <div key={category} className="section-card overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className={cn('w-3 h-3 rounded-full flex-shrink-0', color)} />
              <h2 className="text-base font-bold text-gray-900 flex-1">{category}</h2>
              <span className="text-xs text-gray-400 font-medium">
                {pricedInCat}/{catFees.length} priced
              </span>
              {isCollapsed
                ? <ChevronRight className="w-4 h-4 text-gray-400" />
                : <ChevronDown  className="w-4 h-4 text-gray-400" />
              }
            </button>

            {/* Fees table */}
            {!isCollapsed && (
              <table className="w-full text-sm border-t border-gray-100">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-5 py-2.5 text-left">Treatment</th>
                    <th className="px-4 py-2.5 text-left hidden sm:table-cell">Category</th>
                    <th className="px-4 py-2.5 text-right w-40">Price (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {catFees.map(fee => (
                    <tr key={fee.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{fee.name}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {fee.subcategory && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {fee.subcategory}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingId === fee.id ? (
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-xs text-gray-400">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              step="500"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  savePrice(fee)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              autoFocus
                              className="w-24 text-right border border-blue-300 rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <button
                              onClick={() => savePrice(fee)}
                              disabled={!!saving}
                              className="w-7 h-7 bg-green-600 text-white rounded-lg flex items-center justify-center hover:bg-green-700 disabled:opacity-50"
                            >
                              {saving === fee.id
                                ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <Check className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(fee)}
                            className={cn(
                              'flex items-center gap-2 ml-auto group rounded-lg px-3 py-1.5 transition-colors',
                              fee.price > 0
                                ? 'text-gray-900 hover:bg-gray-100'
                                : 'text-amber-600 hover:bg-amber-50'
                            )}
                          >
                            {fee.price === 0 && (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            )}
                            <span className="font-semibold text-sm">
                              {fee.price > 0 ? formatLKR(fee.price) : 'Set price'}
                            </span>
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}

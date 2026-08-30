'use client'

import { Plus, Trash2, ChevronDown } from 'lucide-react'
import { cn, formatLKR } from '@/lib/utils'

export interface Fee {
  id:          string
  category:    string
  subcategory: string | null
  name:        string
  priceCents:  number
}

const GENERAL = '__general__'

function groupFees(fees: Fee[]) {
  const byCategory = new Map<string, Map<string, Fee[]>>()
  for (const fee of fees) {
    const sub = fee.subcategory ?? GENERAL
    if (!byCategory.has(fee.category)) byCategory.set(fee.category, new Map())
    const bySub = byCategory.get(fee.category)!
    if (!bySub.has(sub)) bySub.set(sub, [])
    bySub.get(sub)!.push(fee)
  }
  return byCategory
}

// price in whole rupees (matches the rest of the visit wizard, which is
// rupee-based end to end and converts to cents only at the API boundary)
function feePrice(fee: Fee | undefined): number | null {
  if (!fee) return undefined as any
  return fee.priceCents > 0 ? fee.priceCents / 100 : null
}

// ─── SINGLE PROCEDURE ROW ─────────────────────────────────────────────────────
export interface Proc {
  id:          string
  category:    string
  subcategory: string
  feeId:       string
  tooth:       string
  note:        string
  diagnosisTooth?: number
  customPrice?: number
}

export interface PlanEntry {
  label: string   // human-readable combined label
  feeId: string | null
  tooth: string
  note:  string
  price: number | null
}

interface RowProps {
  proc:     Proc
  index:    number
  fees:     Fee[]
  byCategory: Map<string, Map<string, Fee[]>>
  onChange: (p: Proc) => void
  onRemove: () => void
}

function ProcRow({ proc, index, fees, byCategory, onChange, onRemove }: RowProps) {
  const p = proc
  const categoryOpts = Array.from(byCategory.keys())
  const subMap = p.category ? byCategory.get(p.category) : undefined
  const subOpts = subMap ? Array.from(subMap.keys()).filter(k => k !== GENERAL) : []
  const hasSub = subOpts.length > 0

  const procedureOpts: Fee[] = p.category
    ? (subMap?.get(hasSub ? p.subcategory : GENERAL) ?? [])
    : []

  const selectedFee = fees.find(f => f.id === p.feeId)
  const price = feePrice(selectedFee)

  function setCategory(val: string) { onChange({ ...p, category: val, subcategory: '', feeId: '', customPrice: undefined }) }
  function setSubcategory(val: string) { onChange({ ...p, subcategory: val, feeId: '', customPrice: undefined }) }
  function setFeeId(val: string) { onChange({ ...p, feeId: val, customPrice: undefined }) }

  const Sel = ({ label, value, opts, onSet }: { label: string; value: string; opts: { key: string; label: string }[]; onSet: (v: string) => void }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onSet(e.target.value)}
          className="form-input !py-2.5 appearance-none pr-8 text-base"
        >
          <option value="">Select…</option>
          {opts.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )

  return (
    <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 space-y-3">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-500">Procedure {index + 1}</span>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-500 transition-colors p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Dropdowns — cascade */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Sel label="Category" value={p.category} opts={categoryOpts.map(k => ({ key: k, label: k }))} onSet={setCategory} />
        {p.category && hasSub && (
          <Sel label="Type" value={p.subcategory} opts={subOpts.map(k => ({ key: k, label: k }))} onSet={setSubcategory} />
        )}
        {p.category && (!hasSub || p.subcategory) && (
          <Sel
            label="Procedure"
            value={p.feeId}
            opts={procedureOpts.map(f => ({ key: f.id, label: f.name }))}
            onSet={setFeeId}
          />
        )}
      </div>

      {/* Tooth + note row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Tooth no.</label>
          <input
            type="text"
            value={p.tooth}
            onChange={e => onChange({ ...p, tooth: e.target.value })}
            placeholder="e.g. 26"
            className="form-input !py-2.5 text-center font-mono text-base"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
          <input
            type="text"
            value={p.note}
            onChange={e => onChange({ ...p, note: e.target.value })}
            placeholder="Upper left, crown needed, etc."
            className="form-input !py-2.5"
          />
        </div>
      </div>

      {/* Price badge */}
      {p.feeId && (
        <div>
          {price === null ? (
            <div className="max-w-[220px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Quoted price (Rs.)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={p.customPrice || ''}
                onChange={e => onChange({ ...p, customPrice: parseFloat(e.target.value) || 0 })}
                placeholder="Enter amount"
                className="form-input !py-2.5 text-right font-bold"
              />
            </div>
          ) : (
            <span className="inline-flex items-center text-sm font-bold bg-green-100 text-green-700 px-3 py-1.5 rounded-xl">
              {formatLKR(price!)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
interface Props {
  entries:  Proc[]
  onChange: (entries: Proc[]) => void
  fees:     Fee[]
}

const uid = () => Math.random().toString(36).slice(2, 10)
export const emptyProc = (): Proc => ({ id: uid(), category: '', subcategory: '', feeId: '', tooth: '', note: '', customPrice: undefined })

export function TreatmentPlanStep({ entries, onChange, fees }: Props) {
  const byCategory = groupFees(fees)

  function update(id: string, updated: Proc) {
    onChange(entries.map(e => e.id === id ? updated : e))
  }
  function remove(id: string) {
    const next = entries.filter(e => e.id !== id)
    onChange(next.length > 0 ? next : [emptyProc()])
  }
  function add() {
    onChange([...entries, emptyProc()])
  }

  // Total
  let total = 0
  let hasTbd = false
  entries.forEach(p => {
    const fee = fees.find(f => f.id === p.feeId)
    const price = feePrice(fee)
    if (typeof price === 'number') total += price
    else if (p.feeId && price === null && p.customPrice && p.customPrice > 0) total += p.customPrice
    else if (p.feeId && price === null) hasTbd = true
  })

  return (
    <div className="space-y-3">
      {fees.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No fee schedule loaded — ask an Admin to set up procedure prices in Settings.
        </div>
      )}

      {entries.map((p, i) => (
        <ProcRow
          key={p.id}
          proc={p}
          index={i}
          fees={fees}
          byCategory={byCategory}
          onChange={updated => update(p.id, updated)}
          onRemove={() => remove(p.id)}
        />
      ))}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-base py-2"
      >
        <Plus className="w-5 h-5" />
        Add procedure
      </button>

      {/* Total bar */}
      {entries.some(p => p.feeId) && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4">
          <div>
            <p className="text-sm text-gray-500">Estimated total</p>
            <p className="text-2xl font-bold text-gray-900">{formatLKR(total)}</p>
            {hasTbd && (
              <p className="text-xs text-gray-400 mt-0.5">* Some procedures to be quoted separately</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Export helper to get entries as plan text for saving
export function getPlanEntries(entries: Proc[], fees: Fee[]): PlanEntry[] {
  return entries
    .filter(p => p.feeId)
    .map(p => {
      const fee = fees.find(f => f.id === p.feeId)
      const price = feePrice(fee)
      const parts = [fee?.category, fee?.subcategory, fee?.name].filter(Boolean)
      const finalPrice = p.customPrice && p.customPrice > 0 ? p.customPrice : (typeof price === 'number' ? price : null)

      return {
        label: parts.join(' › ') || fee?.name || '',
        feeId: p.feeId,
        tooth: p.tooth,
        note:  p.note,
        price: finalPrice,
      }
    })
}

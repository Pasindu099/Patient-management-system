'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Search, DollarSign, Rows3, History } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface LineItem {
  id:           string
  description:  string
  toothNumbers: string
  quantity:     number
  unitPrice:    number
}

interface Props {
  branches:        { id: string; name: string }[]
  prefilledPatient: { id: string; firstName: string; lastName: string; patientNumber: string; nicNumber: string | null } | null
}

const USD_RATE = 320 // approximate LKR per USD — in production fetch from API

const SL_PROCEDURES = [
  'Scaling and polishing',
  'Composite filling (anterior)',
  'Composite filling (posterior)',
  'Root canal treatment',
  'Crown (porcelain fused to metal)',
  'Crown (zirconia)',
  'Extraction (simple)',
  'Extraction (surgical)',
  'Denture (full)',
  'Denture (partial)',
  'Orthodontic consultation',
  'Implant placement',
  'Implant crown',
  'Teeth whitening',
  'X-ray (periapical)',
  'X-ray (OPG)',
  'Consultation',
  'Emergency consultation',
]

function makeItem(): LineItem {
  return { id: Math.random().toString(36).slice(2), description: '', toothNumbers: '', quantity: 1, unitPrice: 0 }
}

export function NewInvoiceForm({ branches, prefilledPatient }: Props) {
  const router = useRouter()
  const [patientSearch, setPatientSearch]     = useState('')
  const [patientResults, setPatientResults]   = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(prefilledPatient ?? null)
  const [branchId, setBranchId]               = useState(branches[0]?.id ?? '')
  const [currency, setCurrency]               = useState<'LKR' | 'USD'>('LKR')
  const [discount, setDiscount]               = useState(0)
  const [notes, setNotes]                     = useState('')
  const [dueDate, setDueDate]                 = useState('')
  const [items, setItems]                     = useState<LineItem[]>([makeItem()])
  const [orthoPlan, setOrthoPlan]             = useState(false)
  const [paidInstallments, setPaidInstallments] = useState(0)
  const [historicalPaidAt, setHistoricalPaidAt] = useState(new Date().toISOString().split('T')[0])
  const [historicalMethod, setHistoricalMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash')
  const [saving, setSaving]                   = useState(false)
  const searchRef = useRef<NodeJS.Timeout>()

  // Patient search
  useEffect(() => {
    if (!patientSearch.trim()) { setPatientResults([]); return }
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      const res  = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=6`)
      const data = await res.json()
      setPatientResults(data)
    }, 300)
  }, [patientSearch])

  // Calculations
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discountAmt = discount > 0 ? (subtotal * discount) / 100 : 0
  const total = subtotal - discountAmt
  const orthoInstallmentAmount = total > 0 ? total / 10 : 0
  const historicalPaidAmount = orthoInstallmentAmount * paidInstallments
  const orthoBalance = Math.max(0, total - historicalPaidAmount)

  function updateItem(id: string, field: keyof LineItem, value: any) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  function removeItem(id: string) {
    if (items.length === 1) return
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function toggleOrthoPlan(enabled: boolean) {
    setOrthoPlan(enabled)
    if (enabled && items.length === 1 && !items[0].description && items[0].unitPrice === 0) {
      setItems([{ ...items[0], description: 'Orthodontic treatment package' }])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPatient) { showToast('error', 'Please select a patient'); return }
    const validItems = items.filter(i => i.description.trim() && i.unitPrice > 0)
    if (validItems.length === 0) { showToast('error', 'Please add at least one item with a price'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          branchId,
          currency,
          exchangeRate: currency === 'USD' ? USD_RATE : null,
          discount: discountAmt,
          notes: notes || null,
          dueDate: dueDate || null,
          items: validItems.map(({ id: _id, ...rest }) => rest),
          installmentPlan: orthoPlan ? {
            enabled: true,
            numberOfInstallments: 10,
            paidInstallments,
            paidAt: historicalPaidAt || null,
            method: historicalMethod,
            notes: 'Orthodontic treatment package - 10 installment plan',
          } : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create invoice')
      showToast('success', 'Invoice created', json.invoiceNumber)
      router.push(`/billing/${json.id}`)
    } catch (e: any) {
      showToast('error', 'Could not create invoice', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Patient */}
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="text-lg font-semibold text-gray-900">Patient</h2>
        </div>
        <div className="section-card-body">
          {selectedPatient ? (
            <div className="flex items-center justify-between bg-blue-50 border-2 border-blue-200 rounded-xl px-5 py-4">
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedPatient.patientNumber}
                  {selectedPatient.nicNumber ? ` · NIC: ${selectedPatient.nicNumber}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedPatient(null); setPatientSearch('') }}
                className="text-sm text-blue-600 hover:text-blue-800 font-semibold min-h-[44px] px-3"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="Search patient by name, NIC or phone…"
                className="form-input pl-12"
                autoFocus
              />
              {patientResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl z-10 overflow-hidden">
                  {patientResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatientResults([]) }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="text-base font-semibold text-gray-900">{p.firstName} {p.lastName}</p>
                        <p className="text-sm text-gray-500">{p.patientNumber}{p.nicNumber ? ` · ${p.nicNumber}` : ''}</p>
                      </div>
                      <span className="text-sm text-gray-400">{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invoice settings */}
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="text-lg font-semibold text-gray-900">Invoice details</h2>
        </div>
        <div className="section-card-body grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="form-label">Branch</label>
            <select value={branchId} onChange={e => setBranchId(e.target.value)} className="form-input">
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">Currency</label>
            <div className="flex gap-2">
              {(['LKR', 'USD'] as const).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={cn(
                    'flex-1 py-3 rounded-xl text-base font-bold border-2 transition-colors min-h-[44px]',
                    currency === c
                      ? c === 'LKR' ? 'bg-blue-600 text-white border-blue-600' : 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            {currency === 'USD' && (
              <p className="form-hint flex items-center gap-1 mt-1">
                <DollarSign className="w-3.5 h-3.5" />
                Rate: 1 USD ≈ Rs. {USD_RATE.toLocaleString()}
              </p>
            )}
          </div>

          <div>
            <label className="form-label">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="form-input"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>

      {/* Orthodontic installment setup */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-3">
            <Rows3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Orthodontic payment plan</h2>
          </div>
          <button
            type="button"
            onClick={() => toggleOrthoPlan(!orthoPlan)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold border-2 min-h-[44px] transition-colors',
              orthoPlan
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            )}
          >
            {orthoPlan ? '10 installments enabled' : 'Use 10 installments'}
          </button>
        </div>
        {orthoPlan && (
          <div className="section-card-body space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="form-label">Already paid installments</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  value={paidInstallments}
                  onChange={e => setPaidInstallments(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="form-input text-center text-lg font-bold"
                />
              </div>
              <div>
                <label className="form-label">Historical payment date</label>
                <input
                  type="date"
                  value={historicalPaidAt}
                  onChange={e => setHistoricalPaidAt(e.target.value)}
                  className="form-input"
                  disabled={paidInstallments === 0}
                />
              </div>
              <div>
                <label className="form-label">Historical method</label>
                <select
                  value={historicalMethod}
                  onChange={e => setHistoricalMethod(e.target.value as typeof historicalMethod)}
                  className="form-input"
                  disabled={paidInstallments === 0}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-500">Each installment</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(orthoInstallmentAmount, currency)}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-sm text-green-700">Historical paid</p>
                <p className="text-lg font-bold text-green-800">{formatCurrency(historicalPaidAmount, currency)}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-sm text-amber-700">Opening balance</p>
                <p className="text-lg font-bold text-amber-800">{formatCurrency(orthoBalance, currency)}</p>
              </div>
            </div>
            {paidInstallments > 0 && (
              <p className="form-hint flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                The first {paidInstallments} installment{paidInstallments === 1 ? '' : 's'} will be marked paid on this date and included in financial history.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="text-lg font-semibold text-gray-900">Procedures / items</h2>
          <span className="text-sm text-gray-500">{currency === 'USD' ? 'Prices in USD' : 'Prices in LKR'}</span>
        </div>
        <div className="section-card-body space-y-3">

          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-12 gap-3 text-sm font-semibold text-gray-500 px-1">
            <div className="col-span-5">Description</div>
            <div className="col-span-2">Tooth</div>
            <div className="col-span-1 text-center">Qty</div>
            <div className="col-span-2 text-right">Unit price</div>
            <div className="col-span-2 text-right">Total</div>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className="grid grid-cols-12 gap-3 items-center">
              {/* Description with autocomplete */}
              <div className="col-span-12 sm:col-span-5 relative">
                <input
                  type="text"
                  value={item.description}
                  onChange={e => updateItem(item.id, 'description', e.target.value)}
                  list={`proc-list-${item.id}`}
                  placeholder="Procedure or item…"
                  className="form-input !py-2.5"
                />
                <datalist id={`proc-list-${item.id}`}>
                  {SL_PROCEDURES.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>

              {/* Tooth numbers */}
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="text"
                  value={item.toothNumbers}
                  onChange={e => updateItem(item.id, 'toothNumbers', e.target.value)}
                  placeholder="e.g. 16,26"
                  className="form-input !py-2.5"
                />
              </div>

              {/* Quantity */}
              <div className="col-span-2 sm:col-span-1">
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={e => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                  className="form-input !py-2.5 text-center"
                />
              </div>

              {/* Unit price */}
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={item.unitPrice || ''}
                  onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="form-input !py-2.5 text-right"
                />
              </div>

              {/* Line total */}
              <div className="col-span-1 sm:col-span-2 text-right">
                <p className="text-base font-semibold text-gray-900 py-2.5">
                  {formatCurrency(item.quantity * item.unitPrice, currency)}
                </p>
              </div>

              {/* Delete */}
              <div className="col-span-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length === 1}
                  className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors rounded-lg"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setItems(prev => [...prev, makeItem()])}
            className="flex items-center gap-2 text-base text-blue-600 hover:text-blue-800 font-semibold py-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add another item
          </button>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-200 px-6 py-4 space-y-2">
          <div className="flex justify-between text-base text-gray-600">
            <span>Subtotal</span>
            <span className="font-semibold">{formatCurrency(subtotal, currency)}</span>
          </div>

          {/* Discount row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-base text-gray-600">Discount</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={discount || ''}
                  onChange={e => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-20 form-input !py-1.5 !text-sm text-center"
                  placeholder="0"
                />
                <span className="text-base text-gray-500">%</span>
              </div>
            </div>
            {discount > 0 && (
              <span className="text-base font-semibold text-green-600">
                − {formatCurrency(discountAmt, currency)}
              </span>
            )}
          </div>

          <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total</span>
            <span className={currency === 'USD' ? 'text-green-700' : ''}>
              {formatCurrency(total, currency)}
            </span>
          </div>

          {currency === 'USD' && (
            <p className="text-sm text-gray-400 text-right">
              ≈ {formatCurrency(total * USD_RATE, 'LKR')} at today's rate
            </p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="section-card">
        <div className="section-card-body">
          <label className="form-label">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="form-input !h-24 resize-none"
            placeholder="Any notes for the patient or internal team…"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancel
        </button>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !selectedPatient}
            className="btn-primary min-w-[160px]"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating…
              </>
            ) : 'Create invoice'}
          </button>
        </div>
      </div>
    </form>
  )
}

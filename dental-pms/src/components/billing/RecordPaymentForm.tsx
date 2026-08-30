'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Banknote, Building2, CheckCircle } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Props {
  invoiceId: string
  balance:   number
  currency:  'LKR' | 'USD'
}

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash',          icon: Banknote,  color: 'border-green-400 bg-green-50 text-green-800' },
  { value: 'card',          label: 'Card',          icon: CreditCard, color: 'border-blue-400 bg-blue-50 text-blue-800' },
  { value: 'bank_transfer', label: 'Bank transfer', icon: Building2,  color: 'border-purple-400 bg-purple-50 text-purple-800' },
]

export function RecordPaymentForm({ invoiceId, balance, currency }: Props) {
  const router = useRouter()
  const [method, setMethod]       = useState('cash')
  const [amount, setAmount]       = useState(balance)
  const [reference, setReference] = useState('')
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (amount <= 0) { showToast('error', 'Amount must be greater than zero'); return }
    if (amount > balance) { showToast('error', `Amount cannot exceed balance of ${formatCurrency(balance, currency)}`); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, currency, reference: reference || null, notes: notes || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Payment failed')
      showToast('success', 'Payment recorded', `${formatCurrency(amount, currency)} via ${method.replace('_', ' ')}`)
      router.refresh()
    } catch (e: any) {
      showToast('error', 'Could not record payment', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="section-card border-2 border-blue-200">
      <div className="section-card-header bg-blue-50">
        <h2 className="text-lg font-semibold text-blue-900">Record payment</h2>
        <p className="text-base font-bold text-blue-700">
          Balance due: {formatCurrency(balance, currency)}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="section-card-body space-y-5">

        {/* Payment method selector */}
        <div>
          <label className="form-label">Payment method</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PAYMENT_METHODS.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 px-3 py-4 rounded-xl border-2',
                    'font-semibold text-sm transition-all min-h-[80px]',
                    method === m.value
                      ? m.color
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  )}
                >
                  <Icon className="w-6 h-6" />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Amount */}
          <div>
            <label className="form-label">
              Amount ({currency})
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-500">
                {currency === 'LKR' ? 'Rs.' : '$'}
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                className="form-input pl-14 text-right text-lg font-bold"
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setAmount(balance)}
                className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
              >
                Pay full balance
              </button>
              {balance > 1000 && (
                <button
                  type="button"
                  onClick={() => setAmount(Math.floor(balance / 2))}
                  className="text-sm text-gray-500 hover:text-gray-700 font-semibold"
                >
                  Pay half
                </button>
              )}
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="form-label">
              Reference {method === 'card' ? '(last 4 digits)' : method === 'bank_transfer' ? '(transaction ID)' : '(optional)'}
            </label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder={
                method === 'card'          ? 'e.g. 4242' :
                method === 'bank_transfer' ? 'e.g. TXN123456' :
                'Optional'
              }
              className="form-input"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="form-label">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional payment notes…"
            className="form-input"
          />
        </div>

        <div className="flex justify-between items-center pt-2">
          <p className="text-sm text-gray-500">
            {amount >= balance
              ? <span className="text-green-700 font-semibold">✓ This will fully settle the invoice</span>
              : <span>Remaining after payment: <strong>{formatCurrency(balance - amount, currency)}</strong></span>}
          </p>
          <button
            type="submit"
            disabled={saving || amount <= 0}
            className="btn-primary min-w-[180px]"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Recording…
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Record {formatCurrency(amount, currency)}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

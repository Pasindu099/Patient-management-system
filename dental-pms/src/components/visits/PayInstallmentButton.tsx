'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Receipt, CheckCircle } from 'lucide-react'
import { cn, formatLKR } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Props {
  installmentId: string
  invoiceId:     string
  visitId:       string
  amount:        number
}

const METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'card',          label: 'Card' },
  { value: 'bank_transfer', label: 'Transfer' },
]

export function PayInstallmentButton({ installmentId, invoiceId, visitId, amount }: Props) {
  const router  = useRouter()
  const [open,   setOpen]   = useState(false)
  const [method, setMethod] = useState('cash')
  const [saving, setSaving] = useState(false)

  async function record() {
    setSaving(true)
    try {
      const res = await fetch('/api/installments/pay', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ installmentId, invoiceId, method }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      showToast('success', `${formatLKR(amount)} recorded via ${method.replace('_', ' ')}`)
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-primary !bg-green-600 hover:!bg-green-700"
      >
        <Receipt className="w-4 h-4" />
        Pay {formatLKR(amount)} instalment
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3 bg-green-50 border-2 border-green-300 rounded-xl px-4 py-3 flex-wrap">
      <p className="text-base font-bold text-green-900">{formatLKR(amount)}</p>
      <div className="flex gap-2">
        {METHODS.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMethod(m.value)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-colors min-h-[44px]',
              method === m.value
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button onClick={record} disabled={saving} className="btn-primary !bg-green-600 hover:!bg-green-700">
        {saving ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <><CheckCircle className="w-4 h-4" />Confirm</>
        )}
      </button>
      <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-lg">×</button>
    </div>
  )
}

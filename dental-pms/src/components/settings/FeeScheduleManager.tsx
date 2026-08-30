'use client'

import { useState, useEffect } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { formatLKR } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface FeeItem {
  procedure: string
  lkr:       number
  usd:       number | null
}

const DEFAULT_FEES: FeeItem[] = [
  { procedure: 'Consultation',                   lkr: 1500,   usd: null },
  { procedure: 'Scaling and polishing',           lkr: 4500,   usd: null },
  { procedure: 'Composite filling (anterior)',    lkr: 6000,   usd: 20   },
  { procedure: 'Composite filling (posterior)',   lkr: 8000,   usd: 25   },
  { procedure: 'Root canal treatment',            lkr: 25000,  usd: 80   },
  { procedure: 'Crown (PFM)',                     lkr: 35000,  usd: 110  },
  { procedure: 'Crown (Zirconia)',                lkr: 55000,  usd: 170  },
  { procedure: 'Extraction (simple)',             lkr: 3500,   usd: null },
  { procedure: 'Extraction (surgical)',           lkr: 8000,   usd: null },
  { procedure: 'Denture (full)',                  lkr: 45000,  usd: null },
  { procedure: 'Denture (partial)',               lkr: 30000,  usd: null },
  { procedure: 'Implant placement',               lkr: 120000, usd: 380  },
  { procedure: 'Implant crown',                   lkr: 55000,  usd: 170  },
  { procedure: 'Teeth whitening',                 lkr: 22000,  usd: 70   },
  { procedure: 'Veneer',                          lkr: 28000,  usd: 88   },
  { procedure: 'X-ray (periapical)',              lkr: 800,    usd: null },
  { procedure: 'X-ray (OPG)',                     lkr: 2500,   usd: null },
  { procedure: 'Orthodontic consultation',        lkr: 2500,   usd: null },
]

const STORAGE_KEY = 'dentalcare_fee_schedule'

export function FeeScheduleManager() {
  const [fees,    setFees]    = useState<FeeItem[]>(DEFAULT_FEES)
  const [saving,  setSaving]  = useState(false)
  const [loaded,  setLoaded]  = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setFees(JSON.parse(stored))
    } catch {}
    setLoaded(true)
  }, [])

  function updateFee(idx: number, field: 'lkr' | 'usd', value: string) {
    const num = parseFloat(value) || 0
    setFees(prev => prev.map((f, i) => i === idx ? { ...f, [field]: num || null } : f))
  }

  async function save() {
    setSaving(true)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fees))
      // Also store as a clinic setting via API
      await fetch('/api/settings/fees', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fees }),
      })
      showToast('success', 'Fee schedule saved')
    } catch {
      // localStorage save succeeded even if API fails
      showToast('success', 'Fee schedule saved locally')
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setFees(DEFAULT_FEES)
    localStorage.removeItem(STORAGE_KEY)
    showToast('success', 'Fees reset to defaults')
  }

  if (!loaded) return null

  return (
    <div className="space-y-4">
      <div className="section-card">
        <div className="section-card-header">
          <p className="text-sm text-gray-500">
            Set your standard prices. These auto-fill when creating invoices — the doctor can still edit per invoice.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="text-left text-sm font-semibold text-gray-500 border-b-2 border-gray-200">
                <th className="px-5 py-3">Procedure</th>
                <th className="px-4 py-3 text-right w-36">LKR price</th>
                <th className="px-4 py-3 text-right w-32">USD price</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee, idx) => (
                <tr key={fee.procedure} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{fee.procedure}</td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={fee.lkr || ''}
                        onChange={e => updateFee(idx, 'lkr', e.target.value)}
                        className="form-input !py-2 pl-10 text-right"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">$</span>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={fee.usd ?? ''}
                        onChange={e => updateFee(idx, 'usd', e.target.value)}
                        placeholder="—"
                        className="form-input !py-2 pl-7 text-right"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-between">
          <button onClick={reset} className="btn-secondary !text-sm !px-4">
            <RotateCcw className="w-4 h-4" />Reset to defaults
          </button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : <><Save className="w-4 h-4" />Save fee schedule</>}
          </button>
        </div>
      </div>
    </div>
  )
}

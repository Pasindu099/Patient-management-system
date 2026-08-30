'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Package, ScanLine, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import { CodeScanner } from '@/components/inventory/CodeScanner'

interface Props {
  branches: { id: string; name: string }[]
}

interface ScannedItem {
  itemId: string
  name: string
  unit: string
  code: string
  quantity: number
}

interface SavedLine {
  name: string
  unit: string
  amount: number
  kind: AdjustKind
  newQuantity: number
}

type AdjustKind = 'RECEIVED' | 'STOCK_TAKE' | 'CORRECTION'

const KINDS: { id: AdjustKind; label: string; hint: string }[] = [
  { id: 'RECEIVED',   label: 'Received',   hint: 'Quantity received' },
  { id: 'STOCK_TAKE', label: 'Stock-take', hint: 'Counted total on the shelf' },
  { id: 'CORRECTION', label: 'Correction', hint: 'Change (+/-)' },
]

// Short confirmation tone so staff know a scan registered without looking up
// from the box. Built inline — no audio asset to ship or cache.
function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 880 : 220
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    osc.onended = () => ctx.close()
  } catch {
    // Audio is a nicety; never let it break the scan flow.
  }
}

export function ScanStockClient({ branches }: Props) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '')
  const [kind, setKind] = useState<AdjustKind>('RECEIVED')

  const [current, setCurrent] = useState<ScannedItem | null>(null)
  const [unknownCode, setUnknownCode] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [saved, setSaved] = useState<SavedLine[]>([])

  const amountRef = useRef<HTMLInputElement>(null)
  const manualRef = useRef<HTMLInputElement>(null)

  // Reads the branch/current state at call time rather than closing over them,
  // so CodeScanner can hold one stable callback for the camera's lifetime.
  const branchIdRef = useRef(branchId)
  const busyRef = useRef(false)
  useEffect(() => { branchIdRef.current = branchId }, [branchId])

  const handleCode = useCallback(async (raw: string) => {
    // One item at a time: ignore scans while a quantity is pending or a
    // lookup is already in flight.
    if (busyRef.current) return
    busyRef.current = true
    try {
      const res = await fetch(
        `/api/inventory/lookup?code=${encodeURIComponent(raw)}&branchId=${branchIdRef.current}`
      )
      if (res.status === 404) {
        beep(false)
        setUnknownCode(raw.trim().toUpperCase())
        setCurrent(null)
        return
      }
      if (!res.ok) {
        beep(false)
        showToast('error', 'Could not look up that code')
        busyRef.current = false
        return
      }
      const item: ScannedItem = await res.json()
      beep(true)
      setUnknownCode(null)
      setCurrent(item)
      setAmount('')
    } catch {
      beep(false)
      showToast('error', 'Network error during lookup')
      busyRef.current = false
    }
  }, [])

  // Focus the quantity box as soon as an item resolves — on a tablet this
  // brings the keypad straight up, so the only action left is typing a number.
  useEffect(() => {
    if (current) amountRef.current?.focus()
  }, [current])

  function dismiss() {
    setCurrent(null)
    setUnknownCode(null)
    setAmount('')
    busyRef.current = false
    manualRef.current?.focus()
  }

  async function save() {
    if (!current) return
    const value = parseFloat(amount)
    if (isNaN(value)) { showToast('error', 'Enter a quantity'); return }
    if (kind !== 'CORRECTION' && value < 0) { showToast('error', 'Quantity cannot be negative'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: current.itemId,
          branchId,
          kind,
          amount: value,
          reason: `Scanned ${current.code}`,
        }),
      })
      if (!res.ok) {
        showToast('error', (await res.json()).error ?? 'Could not save')
        return
      }
      const stock = await res.json()
      setSaved(prev => [
        { name: current.name, unit: current.unit, amount: value, kind, newQuantity: stock.quantity },
        ...prev,
      ].slice(0, 20))
      showToast('success', `${current.name} → ${stock.quantity} ${current.unit}`)
      dismiss()
    } finally {
      setSaving(false)
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault()
    const code = manualCode.trim()
    if (!code) return
    setManualCode('')
    handleCode(code)
  }

  const activeHint = KINDS.find(k => k.id === kind)!.hint

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Link href="/inventory" className="btn-secondary !px-3 !py-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Scan stock</h1>
          <p className="text-sm text-gray-500">Scan a label, type the quantity, save.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <select
          value={branchId}
          onChange={e => setBranchId(e.target.value)}
          className="form-input !w-auto flex-1"
          aria-label="Branch"
        >
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KINDS.map(k => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={cn(
              'p-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
              kind === k.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <CodeScanner onScan={handleCode} paused={!!current || !!unknownCode} />

      {/* Also the landing spot for a USB scanner, which types the code and
          presses Enter exactly as a keyboard would. */}
      <form onSubmit={submitManual} className="flex gap-2">
        <input
          ref={manualRef}
          value={manualCode}
          onChange={e => setManualCode(e.target.value)}
          className="form-input flex-1"
          placeholder="Or type / USB-scan a code (e.g. LDS-0001)"
          autoComplete="off"
        />
        <button type="submit" className="btn-secondary !px-4">
          <ScanLine className="w-4 h-4" />
        </button>
      </form>

      {unknownCode && (
        <div className="section-card border-2 border-amber-300">
          <div className="section-card-body flex items-start gap-3">
            <X className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900">Unrecognised code</p>
              <p className="text-sm text-amber-800 mt-0.5">
                <span className="font-mono">{unknownCode}</span> isn&apos;t linked to any item.
                Use the printed label for this item, or ask an admin to add it to the catalog.
              </p>
            </div>
            <button onClick={dismiss} className="btn-secondary !text-sm !px-3 !py-1.5">Dismiss</button>
          </div>
        </div>
      )}

      {current && (
        <div className="section-card border-2 border-blue-300">
          <div className="section-card-header bg-blue-50 flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-blue-900 truncate">{current.name}</h2>
              <p className="text-sm text-blue-700">
                <span className="font-mono">{current.code}</span> · in stock: {current.quantity} {current.unit}
              </p>
            </div>
            <button onClick={dismiss} className="btn-secondary !px-2 !py-2" aria-label="Cancel">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="section-card-body space-y-3">
            <div>
              <label className="form-label">{activeHint}</label>
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
                className="form-input !text-2xl !py-4 text-center font-bold"
                placeholder="0"
              />
            </div>
            <button onClick={save} disabled={saving} className="btn-primary w-full !py-4 !text-lg justify-center">
              <Check className="w-5 h-5" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="text-base font-semibold text-gray-900">Saved this session ({saved.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {saved.map((line, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <Package className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{line.name}</p>
                  <p className="text-xs text-gray-500">
                    {line.kind === 'STOCK_TAKE' ? 'counted' : line.kind === 'RECEIVED' ? 'received' : 'corrected'}
                    {' '}{line.amount} · now {line.newQuantity} {line.unit}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

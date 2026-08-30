'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package, Plus, AlertTriangle, RefreshCw, ScanLine, QrCode,
  Pencil, Trash2, Check, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Props {
  branches: { id: string; name: string }[]
  canAdjust: boolean
  canManageCatalog: boolean
}

export function InventoryClient({ branches, canAdjust, canManageCatalog }: Props) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('unit')
  const [newCode, setNewCode] = useState('')
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null)
  const [codeDraft, setCodeDraft] = useState('')

  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustKind, setAdjustKind] = useState<'RECEIVED' | 'CORRECTION' | 'STOCK_TAKE'>('RECEIVED')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/stock?branchId=${branchId}`)
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => { load() }, [load])

  async function addItem() {
    if (!newName.trim()) return
    const res = await fetch('/api/inventory/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        unit: newUnit,
        code: newCode.trim() || undefined,
      }),
    })
    if (!res.ok) { showToast('error', 'Could not add item'); return }
    setNewName('')
    setNewUnit('unit')
    setNewCode('')
    showToast('success', 'Item added and QR code created')
    load()
  }

  async function updateQrCode(itemId: string, code: string | null, generateCode = false) {
    const res = await fetch('/api/inventory/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, code, generateCode }),
    })
    if (!res.ok) {
      showToast('error', (await res.json()).error ?? 'Could not update QR code')
      return
    }
    setEditingCodeId(null)
    setCodeDraft('')
    showToast('success', generateCode ? 'QR code generated' : code ? 'QR code updated' : 'QR code removed')
    load()
  }

  function startEditCode(item: any) {
    setEditingCodeId(item.itemId)
    setCodeDraft(item.code ?? '')
  }

  async function submitAdjust(itemId: string) {
    const amount = parseFloat(adjustAmount)
    if (isNaN(amount)) { showToast('error', 'Enter a valid amount'); return }
    const res = await fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, branchId, kind: adjustKind, amount, reason: adjustReason || null }),
    })
    if (!res.ok) { showToast('error', (await res.json()).error ?? 'Could not save'); return }
    showToast('success', 'Stock updated')
    setAdjustingId(null)
    setAdjustAmount('')
    setAdjustReason('')
    load()
  }

  const lowStockCount = items.filter(i => i.lowStock).length

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-base text-gray-500 mt-1">Stock levels by branch. Auto-deducted when treatments are done.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
          {canManageCatalog && (
            <Link href="/inventory/labels" className="btn-secondary">
              <QrCode className="w-4 h-4" />Create QR labels
            </Link>
          )}
          {canAdjust && (
            <Link href="/inventory/scan" className="btn-primary">
              <ScanLine className="w-4 h-4" />Scan
            </Link>
          )}
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className="form-input !w-auto min-w-[180px]">
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border-2 border-red-300 rounded-xl px-5 py-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-base font-semibold text-red-900">
            {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} at or below reorder threshold
          </p>
        </div>
      )}

      {canManageCatalog && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="text-lg font-semibold text-gray-900">Add catalog item</h2>
          </div>
          <div className="section-card-body flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="form-label">Item name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} className="form-input" placeholder="e.g. Composite resin" />
            </div>
            <div className="w-28">
              <label className="form-label">Unit</label>
              <input value={newUnit} onChange={e => setNewUnit(e.target.value)} className="form-input" placeholder="unit" />
            </div>
            <div className="w-44">
              <label className="form-label">QR code</label>
              <input value={newCode} onChange={e => setNewCode(e.target.value)} className="form-input" placeholder="Auto" />
            </div>
            <button onClick={addItem} className="btn-primary"><Plus className="w-4 h-4" />Add</button>
          </div>
        </div>
      )}

      <div className="section-card">
        {items.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>No items in the catalog yet</p>
            {canManageCatalog && (
              <p className="mt-1 text-sm">Add a catalog item above to automatically create its QR label.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.itemId} className={cn('px-6 py-4 flex items-center gap-4', item.lowStock && 'bg-red-50')}>
                <Package className={cn('w-5 h-5 flex-shrink-0', item.lowStock ? 'text-red-500' : 'text-gray-300')} />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-gray-900">{item.name}</p>
                  {editingCodeId === item.itemId ? (
                    <div className="mt-2 flex max-w-md flex-wrap items-center gap-2">
                      <input
                        value={codeDraft}
                        onChange={e => setCodeDraft(e.target.value)}
                        className="form-input !py-2 !text-sm"
                        placeholder="e.g. LDS-0004"
                      />
                      <button
                        onClick={() => updateQrCode(item.itemId, codeDraft.trim() || null)}
                        className="btn-primary !text-sm !px-3 !py-2"
                      >
                        <Check className="w-4 h-4" />Save
                      </button>
                      <button
                        onClick={() => { setEditingCodeId(null); setCodeDraft('') }}
                        className="btn-secondary !text-sm !px-3 !py-2"
                      >
                        <X className="w-4 h-4" />Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {item.code
                        ? <span className="font-mono text-gray-400">{item.code} - </span>
                        : <span className="text-amber-600">No QR code - </span>}
                      {item.quantity} {item.unit} in stock
                      {item.reorderThreshold > 0 ? ` - reorder at ${item.reorderThreshold}` : ''}
                    </p>
                  )}
                </div>
                {item.lowStock && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">Low stock</span>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  {canManageCatalog && item.code && (
                    <Link
                      href={`/inventory/labels?itemId=${item.itemId}`}
                      className="btn-secondary !text-sm !px-3 !py-2 flex-shrink-0"
                    >
                      <QrCode className="w-4 h-4" />Create QR label
                    </Link>
                  )}
                  {canManageCatalog && !item.code && (
                    <button
                      onClick={() => updateQrCode(item.itemId, null, true)}
                      className="btn-secondary !text-sm !px-3 !py-2 flex-shrink-0"
                    >
                      <QrCode className="w-4 h-4" />Generate QR
                    </button>
                  )}
                  {canManageCatalog && (
                    <button
                      onClick={() => startEditCode(item)}
                      className="btn-secondary !text-sm !px-3 !py-2 flex-shrink-0"
                    >
                      <Pencil className="w-4 h-4" />Edit QR
                    </button>
                  )}
                  {canManageCatalog && item.code && (
                    <button
                      onClick={() => updateQrCode(item.itemId, null)}
                      className="btn-secondary !text-sm !px-3 !py-2 flex-shrink-0 text-red-600 hover:!bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />Remove QR
                    </button>
                  )}
                  {canAdjust && (
                    <button onClick={() => setAdjustingId(adjustingId === item.itemId ? null : item.itemId)}
                      className="btn-secondary !text-sm !px-3 !py-2 flex-shrink-0">
                      Update stock
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {adjustingId && (
        <div className="section-card border-2 border-blue-200">
          <div className="section-card-header bg-blue-50">
            <h2 className="text-lg font-semibold text-blue-900">
              Update stock - {items.find(i => i.itemId === adjustingId)?.name}
            </h2>
          </div>
          <div className="section-card-body space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'RECEIVED', label: 'Goods received' },
                { id: 'CORRECTION', label: 'Correction (+/-)' },
                { id: 'STOCK_TAKE', label: 'Stock-take (counted total)' },
              ].map(k => (
                <button key={k.id} type="button" onClick={() => setAdjustKind(k.id as any)}
                  className={cn('p-3 rounded-xl border-2 text-left text-sm font-semibold transition-all',
                    adjustKind === k.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600')}>
                  {k.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="form-label">
                  {adjustKind === 'STOCK_TAKE' ? 'Counted quantity' : adjustKind === 'RECEIVED' ? 'Quantity received' : 'Change (+/-)'}
                </label>
                <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                  className="form-input" placeholder="0" />
              </div>
              <div className="flex-1">
                <label className="form-label">Reason (optional)</label>
                <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="form-input" placeholder="e.g. Supplier delivery" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAdjustingId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => submitAdjust(adjustingId)} className="btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

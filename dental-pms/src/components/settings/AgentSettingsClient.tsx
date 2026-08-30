'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, Plus, Copy, Check, ShieldOff, Inbox } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

const SCOPES = ['finance:read', 'finance:propose', 'inventory:read', 'inventory:propose']

export function AgentSettingsClient() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [actions, setActions] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [newScopes, setNewScopes] = useState<string[]>(['finance:read'])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch('/api/service-accounts').then(r => r.json()),
      fetch('/api/agent-actions?status=PENDING').then(r => r.json()),
    ])
    setAccounts(a); setActions(b)
  }, [])

  useEffect(() => { load() }, [load])

  async function createAccount() {
    if (!newName.trim() || newScopes.length === 0) { showToast('error', 'Name and at least one scope required'); return }
    const res = await fetch('/api/service-accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), scopes: newScopes }),
    })
    if (!res.ok) { showToast('error', 'Could not create account'); return }
    const json = await res.json()
    setNewKey(json.apiKey)
    setNewName(''); setNewScopes(['finance:read'])
    load()
  }

  async function revoke(id: string) {
    await fetch(`/api/service-accounts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: false }),
    })
    showToast('success', 'Access revoked')
    load()
  }

  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    const res = await fetch(`/api/agent-actions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    if (!res.ok) { showToast('error', 'Could not update'); return }
    showToast('success', status === 'APPROVED' ? 'Approved' : 'Rejected')
    load()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI agent access</h1>
        <p className="text-base text-gray-500 mt-1">
          Grant a future bookkeeping agent scoped, read/propose-only access. It can never see clinical or patient records,
          and nothing it proposes executes until you approve it below.
        </p>
      </div>

      {newKey && (
        <div className="section-card border-2 border-amber-300 bg-amber-50">
          <div className="section-card-body space-y-2">
            <p className="text-sm font-bold text-amber-900">Copy this key now — it won't be shown again</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-white border border-amber-200 rounded-lg px-3 py-2 font-mono break-all">{newKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="btn-secondary !px-3">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={() => setNewKey(null)} className="text-sm text-amber-700 font-semibold">Done</button>
          </div>
        </div>
      )}

      <div className="section-card">
        <div className="section-card-header">
          <h2 className="text-lg font-semibold text-gray-900">Create service account</h2>
        </div>
        <div className="section-card-body space-y-3">
          <div>
            <label className="form-label">Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} className="form-input" placeholder="e.g. Bookkeeping agent" />
          </div>
          <div>
            <label className="form-label">Scopes</label>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map(s => (
                <button key={s} type="button"
                  onClick={() => setNewScopes(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold border-2',
                    newScopes.includes(s) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500')}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button onClick={createAccount} className="btn-primary"><Plus className="w-4 h-4" />Create</button>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Service accounts</h2>
          </div>
        </div>
        {accounts.length === 0 ? (
          <p className="py-8 text-center text-gray-400">No service accounts yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {accounts.map(a => (
              <div key={a.id} className="px-6 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-gray-900">{a.name}</p>
                  <p className="text-sm text-gray-500">
                    {a.scopes.join(', ')} · {a.lastUsedAt ? `last used ${formatDateTime(a.lastUsedAt)}` : 'never used'}
                  </p>
                </div>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0',
                  a.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                  {a.isActive ? 'Active' : 'Revoked'}
                </span>
                {a.isActive && (
                  <button onClick={() => revoke(a.id)} className="btn-secondary !text-sm !px-3 !py-2 flex-shrink-0">
                    <ShieldOff className="w-4 h-4" />Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Pending proposals ({actions.length})</h2>
          </div>
        </div>
        {actions.length === 0 ? (
          <p className="py-8 text-center text-gray-400">Nothing waiting for review</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {actions.map(a => (
              <div key={a.id} className="px-6 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-gray-900">{a.actionType}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {a.serviceAccount?.name} · {JSON.stringify(a.payload)}
                  </p>
                </div>
                <button onClick={() => review(a.id, 'REJECTED')} className="btn-secondary !text-sm !px-3 !py-2 flex-shrink-0">Reject</button>
                <button onClick={() => review(a.id, 'APPROVED')} className="btn-primary !text-sm !px-3 !py-2 flex-shrink-0">Approve</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

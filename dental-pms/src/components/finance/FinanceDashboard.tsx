'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, Plus,
  Users, SlidersHorizontal, RefreshCw,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { formatCents } from '@/lib/money'
import { showToast } from '@/components/ui/Toast'

interface Props {
  branches: { id: string; name: string }[]
}

const EXPENSE_CATEGORIES = [
  { code: 'RENT',          label: 'Rent' },
  { code: 'SALARY',        label: 'Salary' },
  { code: 'LAB_FEE',       label: 'Lab fee' },
  { code: 'SUPPLIES',      label: 'Supplies' },
  { code: 'OTHER_EXPENSE', label: 'Other' },
]

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export function FinanceDashboard({ branches }: Props) {
  const [branchId, setBranchId] = useState('')
  const [from, setFrom]         = useState(isoDaysAgo(30))
  const [to, setTo]             = useState(isoDaysAgo(0))
  const [summary, setSummary]   = useState<any>(null)
  const [debtors, setDebtors]   = useState<any[]>([])
  const [overrides, setOverrides] = useState<any>(null)
  const [loading, setLoading]   = useState(true)

  // Expense form
  const [expAmount, setExpAmount]     = useState('')
  const [expCategory, setExpCategory] = useState('RENT')
  const [expBranch, setExpBranch]     = useState(branches[0]?.id ?? '')
  const [expNotes, setExpNotes]       = useState('')
  const [saving, setSaving]           = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      if (branchId) params.set('branchId', branchId)
      const [s, d, o] = await Promise.all([
        fetch(`/api/finance/summary?${params}`).then(r => r.json()),
        fetch(`/api/finance/debtors?${branchId ? `branchId=${branchId}` : ''}`).then(r => r.json()),
        fetch(`/api/finance/overrides?${params}`).then(r => r.json()),
      ])
      setSummary(s); setDebtors(d); setOverrides(o)
    } catch {
      showToast('error', 'Could not load finance data')
    } finally {
      setLoading(false)
    }
  }, [from, to, branchId])

  useEffect(() => { load() }, [load])

  async function addExpense() {
    const amount = parseFloat(expAmount)
    if (!amount || amount <= 0) { showToast('error', 'Enter a valid amount'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, category: expCategory, branchId: expBranch, notes: expNotes || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      showToast('success', 'Expense recorded')
      setExpAmount(''); setExpNotes('')
      load()
    } catch (e: any) {
      showToast('error', 'Could not record expense', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Finance</h1>
          <p className="text-base text-gray-500 mt-1">Collections, expenses and profit across both branches.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input !w-auto !py-2 !text-sm" />
          <span className="text-gray-400">–</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="form-input !w-auto !py-2 !text-sm" />
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className="form-input !w-auto !py-2 !text-sm">
            <option value="">All branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
        </div>
      </div>

      {/* Totals */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={TrendingUp} color="text-green-600 bg-green-50" label="Collected"
            value={formatCents(summary.totals.inCents)} />
          <StatCard icon={TrendingDown} color="text-red-600 bg-red-50" label="Expenses"
            value={formatCents(summary.totals.outCents)} />
          <StatCard icon={Wallet} color="text-blue-600 bg-blue-50" label="Profit"
            value={formatCents(summary.totals.profitCents)} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Per branch */}
        <Section title="Per branch">
          <SimpleTable
            headers={['Branch', 'Collected', 'Expenses', 'Profit']}
            rows={(summary?.byBranch ?? []).map((b: any) => [
              b.name, formatCents(b.inCents), formatCents(b.outCents),
              <span key="p" className={b.profitCents >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                {formatCents(b.profitCents)}
              </span>,
            ])}
            empty="No transactions in this period"
          />
        </Section>

        {/* Per doctor */}
        <Section title="Collections per doctor">
          <SimpleTable
            headers={['Doctor', 'Collected']}
            rows={(summary?.byDoctor ?? []).map((d: any) => [d.name, formatCents(d.cents)])}
            empty="No payments in this period"
          />
        </Section>

        {/* Expense entry */}
        <Section title="Record an expense" icon={Plus}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Amount (Rs)</label>
              <input type="number" min="0" value={expAmount} onChange={e => setExpAmount(e.target.value)}
                className="form-input" placeholder="25000" />
            </div>
            <div>
              <label className="form-label">Category</label>
              <select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="form-input">
                {EXPENSE_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Branch</label>
              <select value={expBranch} onChange={e => setExpBranch(e.target.value)} className="form-input">
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Note (optional)</label>
              <input value={expNotes} onChange={e => setExpNotes(e.target.value)} className="form-input" placeholder="July rent" />
            </div>
          </div>
          <button onClick={addExpense} disabled={saving} className="btn-primary mt-4 w-full justify-center">
            <Plus className="w-4 h-4" />Record expense
          </button>
        </Section>

        {/* Categories */}
        <Section title="By category" icon={SlidersHorizontal}>
          <SimpleTable
            headers={['Category', 'Direction', 'Amount']}
            rows={(summary?.byCategory ?? []).map((c: any) => [
              c.name,
              <span key="d" className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                c.direction === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                {c.direction === 'IN' ? 'In' : 'Out'}
              </span>,
              formatCents(c.cents),
            ])}
            empty="No transactions in this period"
          />
        </Section>
      </div>

      {/* Debtors */}
      <Section title={`Outstanding balances (${debtors.length})`} icon={Users}>
        <SimpleTable
          headers={['Patient', 'Phone', 'Invoices', 'Outstanding']}
          rows={debtors.slice(0, 30).map((d: any) => [
            `${d.patient.firstName} ${d.patient.lastName} (${d.patient.patientNumber})`,
            d.patient.phone ?? '—',
            d.invoices.map((i: any) => i.invoiceNumber).join(', '),
            <span key="b" className="font-bold text-red-700">{formatCents(d.balanceCents)}</span>,
          ])}
          empty="No outstanding balances — everyone is paid up"
        />
      </Section>

      {/* Overrides */}
      <Section title="Price overrides (list vs charged)">
        {overrides?.byDoctor?.length > 0 && (
          <div className="mb-4 flex gap-3 flex-wrap">
            {overrides.byDoctor.map((d: any) => (
              <div key={d.doctorId} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
                <p className="text-sm font-semibold text-amber-900">{d.name}</p>
                <p className="text-xs text-amber-700">{d.count} override{d.count !== 1 ? 's' : ''} · {formatCents(d.differenceCents)} below list</p>
              </div>
            ))}
          </div>
        )}
        <SimpleTable
          headers={['Date', 'Doctor', 'Patient', 'Treatment', 'List', 'Charged']}
          rows={(overrides?.overrides ?? []).slice(0, 30).map((o: any) => [
            formatDate(o.createdAt),
            o.visit.doctor.name,
            `${o.visit.patient.firstName} ${o.visit.patient.lastName}`,
            o.description,
            formatCents(o.listPriceCents),
            <span key="c" className="font-semibold">{formatCents(o.chargedCents)}</span>,
          ])}
          empty="No price overrides in this period"
        />
      </Section>
    </div>
  )
}

function StatCard({ icon: Icon, color, label, value }: { icon: React.ElementType; color: string; label: string; value: string }) {
  return (
    <div className="section-card p-5 flex items-center gap-4">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-gray-400" />}
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
      </div>
      <div className="section-card-body">{children}</div>
    </div>
  )
}

function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-base text-gray-400 py-4 text-center">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
            {headers.map(h => <th key={h} className="pb-2 pr-4 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0">
              {cells.map((c, j) => <td key={j} className="py-2.5 pr-4">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

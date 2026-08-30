'use client'

import { useMemo, useState } from 'react'
import { Sun, Moon, Save, Armchair, UserCheck, CircleSlash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PERIODS = [
  { value: 'MORNING' as const, label: 'Morning', icon: Sun },
  { value: 'EVENING' as const, label: 'Evening', icon: Moon },
]

interface RosterCell { doctorId: string; branchId: string; weekday: number; period: 'MORNING' | 'EVENING' }
interface Props {
  doctors:  { id: string; name: string }[]
  branches: { id: string; name: string; chairCount: number; onlineSlotsDefault: number; appointmentSlotsDefault: number }[]
  initialRoster: RosterCell[]
}

const cellKey = (c: RosterCell) => `${c.doctorId}|${c.branchId}|${c.weekday}|${c.period}`

export function RosterManager({ doctors, branches, initialRoster }: Props) {
  const [active, setActive] = useState<Set<string>>(new Set(initialRoster.map(cellKey)))
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '')
  const [defaults, setDefaults] = useState(() =>
    Object.fromEntries(branches.map(b => [b.id, {
      chairCount: b.chairCount,
      onlineSlotsDefault: b.onlineSlotsDefault,
      appointmentSlotsDefault: b.appointmentSlotsDefault,
    }])))
  const [savingDefaults, setSavingDefaults] = useState(false)

  // Chair counts as persisted — capacity maths must not follow an unsaved input
  const [savedChairs, setSavedChairs] = useState<Record<string, number>>(() =>
    Object.fromEntries(branches.map(b => [b.id, b.chairCount])))

  const branch = branches.find(b => b.id === branchId)
  const chairs = savedChairs[branchId] ?? 0

  /** doctorIds rostered per `weekday|period` at the selected branch */
  const sessionDoctors = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const key of active) {
      const [doctorId, b, weekday, period] = key.split('|')
      if (b !== branchId) continue
      ;(map[`${weekday}|${period}`] ??= []).push(doctorId)
    }
    return map
  }, [active, branchId])

  const assignedIn = (weekday: number, period: string) =>
    sessionDoctors[`${weekday}|${period}`]?.length ?? 0

  /** Weekly totals for the selected branch: 7 days × 2 periods × chairs */
  const totals = useMemo(() => {
    const capacity = chairs * WEEKDAYS.length * PERIODS.length
    const filled   = Object.values(sessionDoctors).reduce((n, ids) => n + ids.length, 0)
    const fullSessions = WEEKDAYS.flatMap((_, d) => PERIODS.map(p => assignedIn(d, p.value)))
      .filter(n => chairs > 0 && n >= chairs).length
    return { capacity, filled, open: Math.max(capacity - filled, 0), fullSessions }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionDoctors, chairs])

  /** Sessions each doctor works at the selected branch */
  const doctorLoad = useMemo(() => {
    const load: Record<string, number> = {}
    for (const ids of Object.values(sessionDoctors)) {
      for (const id of ids) load[id] = (load[id] ?? 0) + 1
    }
    return load
  }, [sessionDoctors])

  async function toggle(doctorId: string, weekday: number, period: 'MORNING' | 'EVENING') {
    const cell = { doctorId, branchId, weekday, period }
    const key = cellKey(cell)
    const enabled = !active.has(key)

    if (enabled && chairs > 0 && assignedIn(weekday, period) >= chairs) {
      showToast('error', `That session is full — ${branch?.name} has ${chairs} chair${chairs === 1 ? '' : 's'}.`)
      return
    }

    // optimistic
    setActive(prev => {
      const next = new Set(prev)
      enabled ? next.add(key) : next.delete(key)
      return next
    })

    const res = await fetch('/api/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cell, enabled }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      showToast('error', json.error ?? 'Could not update roster')
      setActive(prev => {
        const next = new Set(prev)
        enabled ? next.delete(key) : next.add(key)
        return next
      })
    }
  }

  async function saveDefaults() {
    if (!branch) return
    setSavingDefaults(true)
    try {
      const d = defaults[branchId]
      const res = await fetch('/api/settings/branches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: branchId,
          chairCount: Number(d.chairCount) || 3,
          onlineSlotsDefault: Number(d.onlineSlotsDefault) || 0,
          appointmentSlotsDefault: Number(d.appointmentSlotsDefault) || 0,
        }),
      })
      if (!res.ok) throw new Error()
      setSavedChairs(prev => ({ ...prev, [branchId]: Number(d.chairCount) || 3 }))
      showToast('success', 'Branch session defaults saved')
    } catch {
      showToast('error', 'Could not save defaults')
    } finally {
      setSavingDefaults(false)
    }
  }

  function setDefault(field: string, value: string) {
    setDefaults(prev => ({ ...prev, [branchId]: { ...prev[branchId], [field]: value } }))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Doctor roster</h1>
          <p className="text-base text-gray-500 mt-1">
            Tap a session to schedule the doctor. Booking and check-in only allow doctors who are on the roster.
          </p>
        </div>
        <select value={branchId} onChange={e => setBranchId(e.target.value)} className="form-input !w-auto min-w-[220px]">
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Session defaults for this branch */}
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="text-lg font-semibold text-gray-900">Session capacity — {branch?.name}</h2>
        </div>
        <div className="section-card-body flex items-end gap-4 flex-wrap">
          <div>
            <label className="form-label">Chairs</label>
            <input type="number" min="1" max="10" value={defaults[branchId]?.chairCount ?? 3}
              onChange={e => setDefault('chairCount', e.target.value)} className="form-input !w-24" />
          </div>
          <div>
            <label className="form-label">Online slots / session</label>
            <input type="number" min="0" max="50" value={defaults[branchId]?.onlineSlotsDefault ?? 4}
              onChange={e => setDefault('onlineSlotsDefault', e.target.value)} className="form-input !w-32" />
          </div>
          <div>
            <label className="form-label">Appointment slots / session</label>
            <input type="number" min="0" max="100" value={defaults[branchId]?.appointmentSlotsDefault ?? 10}
              onChange={e => setDefault('appointmentSlotsDefault', e.target.value)} className="form-input !w-32" />
          </div>
          <p className="text-sm text-gray-400 pb-2.5">Remaining capacity is kept for walk-ins.</p>
          <button onClick={saveDefaults} disabled={savingDefaults} className="btn-primary ml-auto">
            <Save className="w-4 h-4" />Save defaults
          </button>
        </div>

        {/* Weekly staffing summary for this branch */}
        <div className="px-6 py-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat
            icon={Armchair}
            label="Chair positions / week"
            value={totals.capacity}
            hint={`${chairs} chair${chairs === 1 ? '' : 's'} × 14 sessions`}
          />
          <Stat
            icon={UserCheck}
            label="Assigned"
            value={totals.filled}
            hint={totals.capacity > 0 ? `${Math.round((totals.filled / totals.capacity) * 100)}% of capacity` : '—'}
            tone="blue"
          />
          <Stat
            icon={Armchair}
            label="Open positions"
            value={totals.open}
            hint="Chairs free for another doctor"
            tone={totals.open === 0 ? 'red' : 'green'}
          />
          <Stat
            icon={CircleSlash}
            label="Full sessions"
            value={`${totals.fullSessions} / 14`}
            hint="No chair left to assign"
            tone={totals.fullSessions > 0 ? 'amber' : 'gray'}
          />
        </div>
      </div>

      {/* Roster grid */}
      <div className="section-card overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left px-5 py-3 font-semibold text-gray-500 text-sm">Doctor</th>
              <th className="px-3 py-3 font-semibold text-gray-500 text-sm text-center whitespace-nowrap">Sessions</th>
              {WEEKDAYS.map(d => (
                <th key={d} className="px-2 py-3 font-semibold text-gray-500 text-sm text-center">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doctors.map(doc => (
              <tr key={doc.id} className="border-b border-gray-100 last:border-0">
                <td className="px-5 py-3 font-semibold text-gray-900 whitespace-nowrap">{doc.name}</td>
                <td className="px-3 py-3 text-center text-sm font-semibold text-gray-500">
                  {doctorLoad[doc.id] ?? 0}
                </td>
                {WEEKDAYS.map((_, weekday) => (
                  <td key={weekday} className="px-2 py-2">
                    <div className="flex flex-col gap-1 items-center">
                      {PERIODS.map(p => {
                        const on   = active.has(`${doc.id}|${branchId}|${weekday}|${p.value}`)
                        const full = !on && chairs > 0 && assignedIn(weekday, p.value) >= chairs
                        return (
                          <button
                            key={p.value}
                            onClick={() => toggle(doc.id, weekday, p.value)}
                            disabled={full}
                            title={
                              full
                                ? `${p.label} — session full (${assignedIn(weekday, p.value)}/${chairs} chairs)`
                                : `${p.label} — ${on ? 'scheduled' : 'not scheduled'}`
                            }
                            className={cn(
                              'w-16 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors',
                              on
                                ? p.value === 'MORNING'
                                  ? 'bg-amber-400 text-amber-950'
                                  : 'bg-indigo-500 text-white'
                                : full
                                  ? 'bg-gray-50 text-gray-300 border border-dashed border-gray-200 cursor-not-allowed'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            )}
                          >
                            <p.icon className="w-3.5 h-3.5" />
                            {p.value === 'MORNING' ? 'AM' : 'PM'}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

          {/* Per-session occupancy — how many chairs are taken and how many are free */}
          {doctors.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50/60">
                <td className="px-5 py-3 text-sm font-semibold text-gray-500 whitespace-nowrap">
                  Chairs used
                </td>
                <td />
                {WEEKDAYS.map((_, weekday) => (
                  <td key={weekday} className="px-2 py-2">
                    <div className="flex flex-col gap-1 items-center">
                      {PERIODS.map(p => {
                        const n = assignedIn(weekday, p.value)
                        return (
                          <span
                            key={p.value}
                            title={
                              chairs === 0
                                ? 'Set a chair count for this branch'
                                : `${p.label}: ${n} of ${chairs} chairs used · ${Math.max(chairs - n, 0)} open`
                            }
                            className={cn(
                              'w-16 h-7 rounded-lg text-xs font-bold flex items-center justify-center tabular-nums',
                              chairs > 0 && n > chairs  ? 'bg-red-100 text-red-700'
                              : chairs > 0 && n === chairs ? 'bg-amber-100 text-amber-800'
                              : n > 0                    ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-400'
                            )}
                          >
                            {n}/{chairs}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {doctors.length === 0 && (
          <p className="text-center text-gray-400 py-10">No active doctors. Add doctors under Staff management.</p>
        )}
      </div>

      <p className="text-sm text-gray-400 px-1">
        A session holds one doctor per chair. Sessions at capacity are locked — free a chair
        or raise the chair count above to assign another doctor.
      </p>
    </div>
  )
}

const TONES = {
  gray:  'bg-gray-100 text-gray-500',
  blue:  'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red:   'bg-red-100 text-red-700',
}

function Stat({ icon: Icon, label, value, hint, tone = 'gray' }: {
  icon:  React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  hint?: string
  tone?: keyof typeof TONES
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', TONES[tone])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight tabular-nums">{value}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
    </div>
  )
}

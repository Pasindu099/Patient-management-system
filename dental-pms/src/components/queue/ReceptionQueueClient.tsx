'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, Plus, UserPlus, Stethoscope, Clock, CheckCircle, XCircle, RefreshCw, ClipboardList, X } from 'lucide-react'
import { cn, formatTime, getAge, getPatientDisplayName, MEDICAL_CHECKS } from '@/lib/utils'
import { QUEUE_STATUS_LABELS, QUEUE_STATUS_COLORS } from '@/lib/queue'
import { showToast } from '@/components/ui/Toast'

interface Props {
  initialQueue: any[]
  branches: any[]
  providers: any[]
  currentUser: any
  defaultBranchId: string
}

export function ReceptionQueueClient({ initialQueue, branches, providers, currentUser, defaultBranchId }: Props) {
  const [queue, setQueue] = useState(initialQueue)
  const [doctorStatuses, setDoctorStatuses] = useState<any[]>([])
  const [branchId, setBranchId] = useState(defaultBranchId)
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [tokenNumber, setTokenNumber] = useState('')
  const [patientType, setPatientType] = useState('UNKNOWN')
  const [displayName, setDisplayName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [assignedDoctorId, setAssignedDoctorId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [sweeping, setSweeping] = useState(false)
  const [paperItem, setPaperItem] = useState<any>(null)
  const searchRef = useRef<NodeJS.Timeout>()

  async function runNoShowSweep() {
    setSweeping(true)
    try {
      const res = await fetch('/api/sessions/sweep', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Sweep failed')
      showToast('success', json.noShowCount > 0
        ? `${json.noShowCount} overdue appointment${json.noShowCount !== 1 ? 's' : ''} marked no-show`
        : 'No overdue appointments')
      loadQueue()
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSweeping(false)
    }
  }

  async function loadQueue(bId = branchId) {
    const params = new URLSearchParams({ branchId: bId })
    const res = await fetch(`/api/queue?${params}`)
    if (res.ok) setQueue(await res.json())
  }

  async function loadDoctorStatuses(bId = branchId) {
    const params = bId ? `?${new URLSearchParams({ branchId: bId })}` : ''
    const res = await fetch(`/api/doctor-status${params}`)
    if (res.ok) setDoctorStatuses(await res.json())
  }

  useEffect(() => {
    loadDoctorStatuses()
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadQueue()
      loadDoctorStatuses()
    }, 15000)
    return () => window.clearInterval(interval)
  }, [branchId])

  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatientResults([])
      return
    }
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=8`)
      if (res.ok) setPatientResults(await res.json())
    }, 250)
  }, [patientSearch])

  async function addToQueue() {
    if (!selectedPatient && !tokenNumber.trim()) {
      showToast('error', 'Enter a token number or select a patient')
      return
    }
    const parsedToken = tokenNumber.trim() ? parseQueueToken(tokenNumber) : null
    if (tokenNumber.trim() && !parsedToken) {
      showToast('error', 'Enter a valid token number', 'Use the number printed on the token, for example 14.')
      return
    }
    const walkInName = displayName.trim() || patientSearch.trim()
    setSaving(true)
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient?.id ?? null,
          queueNumber: parsedToken,
          branchId,
          assignedDoctorId: assignedDoctorId || null,
          source: 'WALK_IN',
          patientType: selectedPatient ? 'EXISTING' : patientType,
          intakeStatus: selectedPatient ? 'MATCHED' : 'PAPER_PENDING',
          displayName: selectedPatient ? null : walkInName || null,
          contactPhone: selectedPatient ? null : contactPhone.trim() || null,
          reason: reason || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not add patient to queue')
      showToast('success', selectedPatient ? `${getPatientDisplayName(selectedPatient)} added to queue` : `Token ${tokenNumber} added to queue`)
      setSelectedPatient(null)
      setPatientSearch('')
      setPatientResults([])
      setTokenNumber('')
      setPatientType('UNKNOWN')
      setDisplayName('')
      setContactPhone('')
      setAssignedDoctorId('')
      setReason('')
      loadQueue()
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateQueueItem(id: string, data: any) {
    const res = await fetch(`/api/queue/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) {
      showToast('error', json.error ?? 'Could not update queue')
      return
    }
    loadQueue()
  }

  const waiting = queue.filter(q => ['CHECKED_IN', 'ASSIGNED', 'IN_CHAIR'].includes(q.status))
  const inTreatment = queue.filter(q => q.status === 'IN_CHAIR')

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reception Queue</h1>
          <p className="text-base text-gray-500 mt-1">Add walk-ins, assign appointments, and manage the live lobby list.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runNoShowSweep} disabled={sweeping} className="btn-secondary !text-sm !px-3 !py-2">
            <RefreshCw className={cn('w-4 h-4', sweeping && 'animate-spin')} />
            Check no-shows
          </button>
          <select
            value={branchId}
            onChange={e => { setBranchId(e.target.value); loadQueue(e.target.value); loadDoctorStatuses(e.target.value) }}
            className="form-input !w-auto min-w-[180px]"
          >
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <DoctorStatusStrip statuses={doctorStatuses} onRefresh={() => loadDoctorStatuses()} />

      <TreatmentStatusPanel items={inTreatment} currentUser={currentUser} />

      <div className="section-card">
        <div className="section-card-header">
          <h2 className="text-lg font-semibold text-gray-900">Add token to lobby</h2>
        </div>
        <div className="section-card-body grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-2">
            <label className="form-label">Token</label>
            <input
              value={tokenNumber}
              onChange={e => setTokenNumber(e.target.value)}
              className="form-input text-lg font-bold"
              inputMode="numeric"
              placeholder="12"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="form-label">Patient search</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-900">{getPatientDisplayName(selectedPatient)}</p>
                  <p className="text-sm text-gray-500">{selectedPatient.patientNumber}</p>
                </div>
                <button type="button" className="text-sm font-semibold text-blue-700" onClick={() => setSelectedPatient(null)}>Change</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  className="form-input pl-11"
                  placeholder="Search name, phone, NIC..."
                />
                {patientResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border-2 border-gray-200 bg-white shadow-xl">
                    {patientResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedPatient(p); setPatientResults([]); setPatientSearch('') }}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="font-semibold text-gray-900">{getPatientDisplayName(p)}</p>
                        <p className="text-sm text-gray-500">{p.patientNumber} {p.phone ? `- ${p.phone}` : ''}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {!selectedPatient && (
            <div className="lg:col-span-2">
              <label className="form-label">Type</label>
              <select value={patientType} onChange={e => setPatientType(e.target.value)} className="form-input">
                <option value="UNKNOWN">Unknown</option>
                <option value="EXISTING">Existing</option>
                <option value="NEW">New</option>
              </select>
            </div>
          )}
          {!selectedPatient && (
            <div className="lg:col-span-2">
              <label className="form-label">Name / phone</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="form-input mb-2" placeholder="Optional name" />
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="form-input" placeholder="Optional phone" />
            </div>
          )}
          <div className={selectedPatient ? 'lg:col-span-3' : 'lg:col-span-2'}>
            <label className="form-label">Doctor assignment</label>
            <select value={assignedDoctorId} onChange={e => setAssignedDoctorId(e.target.value)} className="form-input">
              <option value="">Shared queue - any doctor</option>
              {providers.map(p => {
                const status = doctorStatuses.find(row => row.id === p.id)?.status ?? 'NOT_STARTED'
                return <option key={p.id} value={p.id}>{p.name} - {doctorStatusLabel(status)}</option>
              })}
            </select>
          </div>
          <div className={selectedPatient ? 'lg:col-span-2' : 'lg:col-span-2'}>
            <label className="form-label">Reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)} className="form-input" placeholder="Toothache, follow-up..." />
          </div>
          <div className="lg:col-span-1">
            <button onClick={addToQueue} disabled={saving} className="btn-primary w-full justify-center">
              <Plus className="w-4 h-4" />Add
            </button>
          </div>
        </div>
      </div>

      <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">Waiting lobby</h2>
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-sm font-bold text-orange-700">{waiting.length}</span>
            </div>
          </div>
          <QueueList items={waiting} providers={providers} doctorStatuses={doctorStatuses} onUpdate={updateQueueItem} onPaperEntry={setPaperItem} />
      </div>
      {paperItem && (
        <PaperFormModal
          item={paperItem}
          onClose={() => setPaperItem(null)}
          onSaved={() => {
            setPaperItem(null)
            loadQueue()
          }}
        />
      )}
    </div>
  )
}

function parseQueueToken(token: string) {
  const digits = token.match(/\d+/)?.[0]
  if (!digits) return null
  const value = Number(digits)
  return Number.isInteger(value) && value > 0 ? value : null
}

function queueDisplayName(item: any) {
  if (item.patient) return getPatientDisplayName(item.patient)
  if (item.displayName) return item.displayName
  if (item.intakeSubmission?.firstName || item.intakeSubmission?.lastName) {
    return [item.intakeSubmission.firstName, item.intakeSubmission.lastName].filter(Boolean).join(' ')
  }
  return `Token ${item.queueNumber}`
}

function doctorStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NOT_STARTED: 'not started',
    READY: 'ready',
    WITH_PATIENT: 'with patient',
    SHORT_BREAK: 'break',
    UNAVAILABLE: 'unavailable',
    SESSION_ENDED: 'ended',
  }
  return labels[status] ?? status.toLowerCase()
}

function doctorStatusColor(status: string) {
  const colors: Record<string, string> = {
    NOT_STARTED: 'bg-gray-100 text-gray-700',
    READY: 'bg-green-100 text-green-800',
    WITH_PATIENT: 'bg-blue-100 text-blue-800',
    SHORT_BREAK: 'bg-amber-100 text-amber-800',
    UNAVAILABLE: 'bg-red-100 text-red-800',
    SESSION_ENDED: 'bg-gray-100 text-gray-600',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-700'
}

function DoctorStatusStrip({ statuses, onRefresh }: { statuses: any[]; onRefresh: () => void }) {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Doctor availability</h2>
        </div>
        <button onClick={onRefresh} className="text-sm font-semibold text-blue-600 hover:text-blue-800">Refresh</button>
      </div>
      <div className="section-card-body">
        {statuses.length === 0 ? (
          <p className="py-3 text-center text-gray-400">No doctors found</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {statuses.map(row => (
              <div key={row.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-gray-900">{row.name}</p>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', doctorStatusColor(row.status))}>
                    {doctorStatusLabel(row.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  {row.statusChangedAt ? `Updated ${formatTime(row.statusChangedAt)}` : 'No session started'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TreatmentStatusPanel({ items, currentUser }: { items: any[]; currentUser: any }) {
  const canAssist = currentUser.role === 'NURSE' || currentUser.role === 'HEAD_NURSE'

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">In treatment</h2>
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-bold text-green-700">{items.length}</span>
        </div>
        <p className="text-xs font-semibold text-gray-400">Auto-refreshes</p>
      </div>
      <div className="section-card-body">
        {items.length === 0 ? (
          <p className="py-5 text-center text-gray-400">No patients are currently in chair</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {items.map(item => (
              <div key={item.id} className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-gray-900">{queueDisplayName(item)}</p>
                    <p className="mt-0.5 text-sm font-semibold text-green-800">
                      {item.assignedDoctor?.name ? `With ${item.assignedDoctor.name}` : 'With shared queue doctor'}
                    </p>
                  </div>
                  <span className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold text-white">
                    In treatment
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">Token {item.queueNumber}</span>
                  {item.startedAt && <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">Started {formatTime(item.startedAt)}</span>}
                  {!item.patient && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Details pending</span>}
                  {canAssist && (
                    <Link
                      href={`/diagnosis?queueId=${item.id}`}
                      className="rounded-full bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                    >
                      Assist
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function splitDisplayName(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

const emptyMedicalFlags = MEDICAL_CHECKS.reduce((acc, item) => {
  acc[item.id] = false
  return acc
}, {} as Record<string, boolean>)

function QueueList({
  items, providers, doctorStatuses, onUpdate, onPaperEntry,
}: {
  items: any[]
  providers: any[]
  doctorStatuses: any[]
  onUpdate: (id: string, data: any) => void
  onPaperEntry: (item: any) => void
}) {
  if (items.length === 0) {
    return <div className="py-12 text-center text-gray-400">No patients in the lobby</div>
  }

  function markDone(item: any) {
    if (!item.patient) {
      showToast('error', 'Add patient details first', 'Enter the paper form or link an existing patient before closing this queue item.')
      return
    }
    onUpdate(item.id, { status: 'PAID' })
  }

  function markLeft(item: any) {
    if (!item.patient) {
      const ok = window.confirm(
        `Token ${item.queueNumber} has no patient record yet. Mark this token as left without saving patient details?`
      )
      if (!ok) return
    }
    onUpdate(item.id, { status: 'LEFT' })
  }

  return (
    <div className="divide-y divide-gray-100">
      {items.map(item => {
        const profilePending = item.intakeStatus === 'PAPER_PENDING' || item.intakeStatus === 'NEEDS_REVIEW' || item.intakeStatus === 'QR_SUBMITTED'
        return (
        <div key={item.id} className="px-6 py-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold flex-shrink-0">
              {item.queueNumber}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-lg font-bold text-gray-900">{queueDisplayName(item)}</p>
                <span className={cn(
                  'text-xs font-semibold rounded-full px-2 py-0.5',
                  QUEUE_STATUS_COLORS[item.status as keyof typeof QUEUE_STATUS_COLORS] ?? 'bg-gray-100 text-gray-600'
                )}>
                  {QUEUE_STATUS_LABELS[item.status as keyof typeof QUEUE_STATUS_LABELS] ?? item.status}
                </span>
                {item.referralNote && (
                  <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-purple-100 text-purple-700">
                    Referred
                  </span>
                )}
                {profilePending && (
                  <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">
                    {item.intakeStatus === 'QR_SUBMITTED' ? 'QR submitted' : item.intakeStatus === 'PAPER_PENDING' ? 'Paper pending' : 'Needs review'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {item.patient && !profilePending
                  ? `${item.patient.patientNumber} - ${getAge(item.patient.dateOfBirth)} yrs`
                  : `${item.patientType || 'UNKNOWN'}${item.contactPhone ? ` - ${item.contactPhone}` : ''}`}
                {' '} - arrived {formatTime(item.arrivedAt)}
              </p>
              {item.intakeSubmission?.allergies && (
                <p className="text-sm font-semibold text-red-700 mt-1">Allergies: {item.intakeSubmission.allergies}</p>
              )}
              {item.intakeSubmission?.medicalWarnings && (
                <p className="text-sm font-semibold text-amber-700 mt-1">Medical: {item.intakeSubmission.medicalWarnings}</p>
              )}
              {item.reason && <p className="text-sm text-gray-600 mt-1">{item.reason}</p>}
              {item.referralNote && (
                <p className="text-sm text-purple-700 mt-1">Referral note: {item.referralNote}</p>
              )}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {profilePending && (
                  <button onClick={() => onPaperEntry(item)} className="btn-secondary !text-sm !px-3 !py-2">
                    <ClipboardList className="w-4 h-4" />Enter paper form
                  </button>
                )}
                {!item.patient && (
                  <>
                    <LinkPatientControl item={item} onUpdate={onUpdate} />
                  </>
                )}
                <select
                  value={item.assignedDoctorId ?? ''}
                  onChange={e => onUpdate(item.id, { assignedDoctorId: e.target.value || null })}
                  className="form-input !py-2 !text-sm !w-auto min-w-[180px]"
                >
                  <option value="">Shared queue</option>
                  {providers.map(p => {
                    const status = doctorStatuses.find(row => row.id === p.id)?.status ?? 'NOT_STARTED'
                    return <option key={p.id} value={p.id}>{p.name} - {doctorStatusLabel(status)}</option>
                  })}
                </select>
                <button onClick={() => onUpdate(item.id, { status: 'ASSIGNED' })} className="btn-secondary !text-sm !px-3 !py-2">
                  <Clock className="w-4 h-4" />Call
                </button>
                <button
                  onClick={() => markDone(item)}
                  disabled={!item.patient}
                  title={!item.patient ? 'Enter paper form or link patient first' : undefined}
                  className={cn(
                    'btn-secondary !text-sm !px-3 !py-2',
                    !item.patient && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <CheckCircle className="w-4 h-4" />Done
                </button>
                <button onClick={() => markLeft(item)} className="btn-secondary !text-sm !px-3 !py-2">
                  <XCircle className="w-4 h-4" />Left
                </button>
              </div>
            </div>
            <Stethoscope className="w-5 h-5 text-gray-300 flex-shrink-0" />
          </div>
        </div>
      )})}
    </div>
  )
}

function LinkPatientControl({ item, onUpdate }: { item: any; onUpdate: (id: string, data: any) => void }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function runSearch(value: string) {
    setSearch(value)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(value)}&limit=5`)
      if (res.ok) setResults(await res.json())
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary !text-sm !px-3 !py-2">
        Link patient
      </button>
    )
  }

  return (
    <div className="relative w-full max-w-sm">
      <input
        value={search}
        onChange={e => runSearch(e.target.value)}
        className="form-input !py-2 !text-sm"
        placeholder={item.contactPhone || item.displayName || 'Search existing patient'}
        autoFocus
      />
      <button
        type="button"
        onClick={() => { setOpen(false); setSearch(''); setResults([]) }}
        className="absolute right-2 top-2 text-xs font-semibold text-gray-400 hover:text-gray-700"
      >
        Close
      </button>
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border-2 border-gray-200 bg-white shadow-xl">
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onUpdate(item.id, { patientId: p.id })
                setOpen(false)
                setSearch('')
                setResults([])
              }}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-0"
            >
              <p className="font-semibold text-gray-900">{getPatientDisplayName(p)}</p>
              <p className="text-sm text-gray-500">{p.patientNumber} {p.phone ? `- ${p.phone}` : ''}</p>
            </button>
          ))}
        </div>
      )}
      {loading && <p className="mt-1 text-xs text-gray-400">Searching...</p>}
    </div>
  )
}

function PaperFormModal({ item, onClose, onSaved }: { item: any; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    firstName: item.intakeSubmission?.firstName ?? splitDisplayName(item.displayName).firstName,
    lastName: item.intakeSubmission?.lastName ?? splitDisplayName(item.displayName).lastName,
    dateOfBirth: item.intakeSubmission?.dateOfBirth ?? '',
    gender: item.intakeSubmission?.gender ?? '',
    phone: item.intakeSubmission?.phone ?? item.contactPhone ?? '',
    email: '',
    addressLine1: '',
    city: '',
    emergencyName: item.intakeSubmission?.emergencyName ?? '',
    emergencyPhone: item.intakeSubmission?.emergencyPhone ?? '',
    emergencyRelation: '',
    reason: item.reason ?? item.intakeSubmission?.reason ?? '',
    medicalFlags: { ...emptyMedicalFlags },
    allergyDetails: item.intakeSubmission?.allergies ?? '',
    currentMedications: '',
    drugHistory: '',
    dietaryHistory: '',
    brushingHistory: '',
    medicalHistoryNote: item.intakeSubmission?.medicalWarnings ?? '',
    oralHygieneHistory: '',
    habitHistory: '',
    familyHistory: '',
    socialHistory: '',
    extraOralExamination: '',
    intraOralExamination: '',
    notes: '',
  })

  function setField(name: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function setMedicalFlag(name: string, value: boolean) {
    setForm(prev => ({
      ...prev,
      medicalFlags: { ...prev.medicalFlags, [name]: value },
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/queue/${item.id}/patient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not create patient')
      showToast('success', 'Patient created and linked', `${form.firstName} ${form.lastName} is now attached to token ${item.queueNumber}.`)
      onSaved()
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Enter paper form</h2>
            <p className="text-sm text-gray-500">Token {item.queueNumber} - create and link a new patient record.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name *">
              <input value={form.firstName} onChange={e => setField('firstName', e.target.value)} className="form-input" autoFocus required />
            </Field>
            <Field label="Last name *">
              <input value={form.lastName} onChange={e => setField('lastName', e.target.value)} className="form-input" required />
            </Field>
            <Field label="Date of birth *">
              <input value={form.dateOfBirth} onChange={e => setField('dateOfBirth', e.target.value)} type="date" className="form-input" required />
            </Field>
            <Field label="Gender *">
              <select value={form.gender} onChange={e => setField('gender', e.target.value)} className="form-input" required>
                <option value="">Select...</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </Field>
            <Field label="Phone *">
              <input value={form.phone} onChange={e => setField('phone', e.target.value)} className="form-input" required />
            </Field>
            <Field label="Email">
              <input value={form.email} onChange={e => setField('email', e.target.value)} type="email" className="form-input" />
            </Field>
            <Field label="Address">
              <input value={form.addressLine1} onChange={e => setField('addressLine1', e.target.value)} className="form-input" />
            </Field>
            <Field label="City">
              <input value={form.city} onChange={e => setField('city', e.target.value)} className="form-input" />
            </Field>
            <Field label="Emergency contact">
              <input value={form.emergencyName} onChange={e => setField('emergencyName', e.target.value)} className="form-input" />
            </Field>
            <Field label="Emergency phone">
              <input value={form.emergencyPhone} onChange={e => setField('emergencyPhone', e.target.value)} className="form-input" />
            </Field>
          </div>

          <Field label="Reason for visit">
            <input value={form.reason} onChange={e => setField('reason', e.target.value)} className="form-input" placeholder="Toothache, follow-up..." />
          </Field>

          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-base font-semibold text-red-900">Medical and allergy screening</p>
            <p className="text-sm text-red-700">Tick exactly what the patient selected on the paper form.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {MEDICAL_CHECKS.map(check => (
              <PaperYesNo
                key={check.id}
                label={check.label}
                value={!!form.medicalFlags[check.id]}
                onChange={value => setMedicalFlag(check.id, value)}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Allergy details">
              <textarea value={form.allergyDetails} onChange={e => setField('allergyDetails', e.target.value)} className="form-input !h-24 resize-none" placeholder="Drug, food, latex, reaction and severity" />
            </Field>
            <Field label="Current medications">
              <textarea value={form.currentMedications} onChange={e => setField('currentMedications', e.target.value)} className="form-input !h-24 resize-none" placeholder="Regular medicines, anticoagulants, steroids..." />
            </Field>
            <Field label="Drug history">
              <textarea value={form.drugHistory} onChange={e => setField('drugHistory', e.target.value)} className="form-input !h-20 resize-none" />
            </Field>
            <Field label="Dietary history">
              <textarea value={form.dietaryHistory} onChange={e => setField('dietaryHistory', e.target.value)} className="form-input !h-20 resize-none" />
            </Field>
            <Field label="Brushing history">
              <textarea value={form.brushingHistory} onChange={e => setField('brushingHistory', e.target.value)} className="form-input !h-20 resize-none" />
            </Field>
            <Field label="Medical history notes">
              <textarea value={form.medicalHistoryNote} onChange={e => setField('medicalHistoryNote', e.target.value)} className="form-input !h-20 resize-none" />
            </Field>
            <Field label="Oral hygiene history">
              <textarea value={form.oralHygieneHistory} onChange={e => setField('oralHygieneHistory', e.target.value)} className="form-input !h-20 resize-none" />
            </Field>
            <Field label="Habit history">
              <textarea value={form.habitHistory} onChange={e => setField('habitHistory', e.target.value)} className="form-input !h-20 resize-none" placeholder="Smoking, betel, alcohol, bruxism..." />
            </Field>
            <Field label="Family history">
              <textarea value={form.familyHistory} onChange={e => setField('familyHistory', e.target.value)} className="form-input !h-20 resize-none" />
            </Field>
            <Field label="Social history">
              <textarea value={form.socialHistory} onChange={e => setField('socialHistory', e.target.value)} className="form-input !h-20 resize-none" />
            </Field>
            <Field label="Extra oral examination">
              <textarea value={form.extraOralExamination} onChange={e => setField('extraOralExamination', e.target.value)} className="form-input !h-20 resize-none" />
            </Field>
            <Field label="Intra oral examination">
              <textarea value={form.intraOralExamination} onChange={e => setField('intraOralExamination', e.target.value)} className="form-input !h-20 resize-none" />
            </Field>
          </div>

          <Field label="Reception notes">
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} className="form-input !h-20 resize-none" />
          </Field>

          <div className="flex justify-between border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary min-w-[180px] justify-center">
              {saving ? 'Creating...' : 'Create patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PaperYesNo({
  label, value, onChange,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div>
      <p className="form-label">{label}</p>
      <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            'min-w-[48px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
            !value ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            'min-w-[48px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
            value ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Yes
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

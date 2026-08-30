'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlayCircle, UserCheck, Share2, X, Stethoscope } from 'lucide-react'
import { cn, formatTime, getPatientDisplayName } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Doctor { id: string; name: string }

function queueDisplayName(item: any) {
  if (item.patient) return getPatientDisplayName(item.patient)
  if (item.displayName) return item.displayName
  if (item.intakeSubmission?.firstName || item.intakeSubmission?.lastName) {
    return [item.intakeSubmission.firstName, item.intakeSubmission.lastName].filter(Boolean).join(' ')
  }
  return `Token ${item.queueNumber}`
}

export function DoctorQueuePanel({
  initialQueue, currentUser, doctors = [],
}: { initialQueue: any[]; currentUser: any; doctors?: Doctor[] }) {
  const router = useRouter()
  const [queue, setQueue] = useState(initialQueue)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [referringId, setReferringId] = useState<string | null>(null)
  const [referDoctorId, setReferDoctorId] = useState('')
  const [referNote, setReferNote] = useState('')
  const [doctorStatus, setDoctorStatus] = useState('NOT_STARTED')

  async function loadDoctorStatus() {
    const res = await fetch('/api/doctor-status')
    if (!res.ok) return
    const rows = await res.json()
    setDoctorStatus(rows.find((row: any) => row.id === currentUser.id)?.status ?? 'NOT_STARTED')
  }

  useEffect(() => {
    loadDoctorStatus()
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.status) setDoctorStatus(detail.status)
    }
    window.addEventListener('doctor-status-changed', onChanged)
    return () => window.removeEventListener('doctor-status-changed', onChanged)
  }, [])

  async function refresh() {
    const res = await fetch('/api/queue?mine=true')
    if (res.ok) setQueue(await res.json())
  }

  async function receiveToChair(item: any) {
    if (item.status === 'IN_CHAIR') {
      const patientParam = item.patient ? `patientId=${item.patient.id}&` : ''
      router.push(`/visits/new?${patientParam}queueId=${item.id}`)
      return
    }
    if (doctorStatus !== 'READY') {
      showToast('error', 'Start your session first before receiving a patient.')
      return
    }

    setBusyId(item.id)
    try {
      const res = await fetch(`/api/queue/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_CHAIR' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not receive patient')
      if (item.patient) {
        router.push(`/visits/new?patientId=${item.patient.id}&queueId=${item.id}`)
      } else {
        showToast('success', `Token ${item.queueNumber} received to chair`)
        router.push(`/visits/new?queueId=${item.id}`)
      }
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setBusyId(null)
    }
  }

  function openRefer(item: any) {
    setReferringId(item.id)
    setReferDoctorId('')
    setReferNote('')
  }

  async function submitRefer(itemId: string) {
    if (!referDoctorId) {
      showToast('error', 'Choose a doctor to refer to')
      return
    }

    setBusyId(itemId)
    try {
      const res = await fetch(`/api/queue/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedDoctorId: referDoctorId, referralNote: referNote || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not refer patient')
      showToast('success', 'Patient referred')
      setReferringId(null)
      refresh()
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setBusyId(null)
    }
  }

  const currentTreatment = queue.find(q => q.status === 'IN_CHAIR' && q.assignedDoctorId === currentUser.id)
  const waiting = queue.filter(q => ['CHECKED_IN', 'ASSIGNED'].includes(q.status))
  const otherDoctors = doctors.filter(d => d.id !== currentUser.id)

  return (
    <div className="space-y-4">
      {currentTreatment && (
        <div className="section-card border-2 border-green-200 bg-green-50">
          <div className="section-card-body">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-600 font-bold text-white">
                  {currentTreatment.queueNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Stethoscope className="h-5 w-5 text-green-700" />
                    <h2 className="text-xl font-bold text-gray-900">Current treatment</h2>
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">In chair</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-gray-900">{queueDisplayName(currentTreatment)}</p>
                  <p className="text-sm font-medium text-gray-600">
                    Token {currentTreatment.queueNumber}
                    {currentTreatment.startedAt ? ` - started ${formatTime(currentTreatment.startedAt)}` : ''}
                    {currentTreatment.reason ? ` - ${currentTreatment.reason}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => receiveToChair(currentTreatment)}
                className="btn-primary justify-center !px-5 !py-3"
              >
                <PlayCircle className="h-4 w-4" />
                Resume treatment
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="section-card">
      <div className="section-card-header">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Patients waiting</h2>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-bold text-blue-700">{waiting.length}</span>
        </div>
        <button onClick={refresh} className="text-sm font-semibold text-blue-600 hover:text-blue-800">Refresh</button>
      </div>

      {waiting.length === 0 ? (
        <div className="py-14 text-center text-gray-400">
          <UserCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          No patients waiting for you right now
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {waiting.map(item => {
            const assignedToMe = item.assignedDoctorId === currentUser.id
            const isReferring = referringId === item.id
            const inChair = item.status === 'IN_CHAIR'
            const canReceive = inChair || doctorStatus === 'READY'

            return (
              <div key={item.id} className={cn('px-6 py-4', assignedToMe ? 'bg-blue-50/50' : 'bg-white')}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-lg',
                    assignedToMe ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'
                  )}>
                    {item.queueNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-lg font-bold text-gray-900">{queueDisplayName(item)}</p>
                      <span className={cn(
                        'text-xs font-semibold rounded-full px-2 py-0.5',
                        item.referralNote ? 'bg-purple-100 text-purple-700' : assignedToMe ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      )}>
                        {item.referralNote ? 'Referred to you' : assignedToMe ? 'Assigned to you' : 'Shared'}
                      </span>
                      {inChair && (
                        <span className="text-xs font-semibold rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                          In chair
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {item.patient ? item.patient.patientNumber : item.patientType || 'UNKNOWN'} - arrived {formatTime(item.arrivedAt)}
                      {item.reason ? ` - ${item.reason}` : ''}
                    </p>
                    {item.referralNote && (
                      <p className="text-sm font-semibold text-purple-700 mt-1">Referral note: {item.referralNote}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {otherDoctors.length > 0 && (
                      <button
                        onClick={() => (isReferring ? setReferringId(null) : openRefer(item))}
                        disabled={busyId === item.id}
                        className="btn-secondary !text-sm !px-3 !py-2.5"
                        title="Refer to another doctor"
                      >
                        {isReferring ? <X className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => receiveToChair(item)}
                      disabled={busyId === item.id || !canReceive}
                      title={!canReceive ? 'Start your session first' : undefined}
                      className="btn-primary !text-base !px-5 !py-2.5 min-h-[44px]"
                    >
                      {busyId === item.id && !isReferring ? (
                        <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Receiving</>
                      ) : inChair ? (
                        <><PlayCircle className="w-4 h-4" />Start visit</>
                      ) : (
                        <><PlayCircle className="w-4 h-4" />Receive to chair</>
                      )}
                    </button>
                  </div>
                </div>

                {isReferring && (
                  <div className="mt-3 flex items-end gap-2 flex-wrap rounded-xl border-2 border-purple-200 bg-purple-50 p-3">
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-xs font-semibold text-purple-800 mb-1">Refer to</label>
                      <select value={referDoctorId} onChange={e => setReferDoctorId(e.target.value)} className="form-input !py-2 !text-sm">
                        <option value="">Choose a doctor...</option>
                        {otherDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="flex-[2] min-w-[220px]">
                      <label className="block text-xs font-semibold text-purple-800 mb-1">Note</label>
                      <input value={referNote} onChange={e => setReferNote(e.target.value)}
                        className="form-input !py-2 !text-sm" placeholder="e.g. Needs root canal specialist" />
                    </div>
                    <button
                      onClick={() => submitRefer(item.id)}
                      disabled={busyId === item.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold min-h-[42px]
                                 bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      <Share2 className="w-4 h-4" />Refer
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}

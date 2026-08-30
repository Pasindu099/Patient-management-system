'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Smile, ChevronLeft, Stethoscope, Clock } from 'lucide-react'
import { cn, getPatientDisplayName, getAge } from '@/lib/utils'
import { ToothChart, ToothState } from '@/components/visits/ToothChart'
import { showToast } from '@/components/ui/Toast'

interface QueueItem {
  id: string
  queueNumber: number
  status: string
  displayName?: string | null
  patientType?: string | null
  patient: { id: string; firstName: string; lastName: string; preferredName?: string | null; patientNumber: string; dateOfBirth: string } | null
  intakeSubmission?: { firstName?: string | null; lastName?: string | null; patientNumber?: string | null; dateOfBirth?: string | null } | null
  assignedDoctor: { id: string; name: string } | null
}

function queuePatientName(item: QueueItem) {
  if (item.patient) return getPatientDisplayName(item.patient)
  if (item.displayName) return item.displayName
  const intakeName = [item.intakeSubmission?.firstName, item.intakeSubmission?.lastName].filter(Boolean).join(' ')
  return intakeName || `Token ${item.queueNumber}`
}

function queuePatientMeta(item: QueueItem) {
  if (item.patient) return `${item.patient.patientNumber} - ${getAge(item.patient.dateOfBirth)} yrs`
  const parts = [
    item.intakeSubmission?.patientNumber,
    item.intakeSubmission?.dateOfBirth ? `${getAge(item.intakeSubmission.dateOfBirth)} yrs` : null,
    item.patientType && item.patientType !== 'UNKNOWN' ? item.patientType.replace('_', ' ').toLowerCase() : null,
  ].filter(Boolean)
  return parts.join(' - ') || 'Patient details pending'
}

export function DiagnosisAssistClient({
  initialQueue, currentUser,
}: { initialQueue: QueueItem[]; currentUser: any }) {
  const searchParams = useSearchParams()
  const [queue, setQueue] = useState(initialQueue)
  const [selected, setSelected] = useState<QueueItem | null>(null)
  const selectedQueueId = searchParams.get('queueId')

  async function refresh() {
    const res = await fetch('/api/queue')
    if (res.ok) {
      const all: QueueItem[] = await res.json()
      setQueue(all.filter(q => q.status !== 'COMPLETED'))
    }
  }

  useEffect(() => {
    const interval = setInterval(refresh, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!selectedQueueId || selected?.id === selectedQueueId) return
    const item = queue.find(q => q.id === selectedQueueId)
    if (item) setSelected(item)
  }, [queue, selectedQueueId, selected?.id])

  if (selected) {
    return <PatientDiagnosisPanel item={selected} onBack={() => { setSelected(null); refresh() }} />
  }

  const inChair = queue.filter(q => q.status === 'IN_CHAIR')
  const waiting = queue.filter(q => q.status !== 'IN_CHAIR')

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Diagnosis assist</h1>
        <p className="text-base text-gray-500 mt-1">
          Pick a patient the doctor is examining and record tooth chart findings for them.
        </p>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">With the doctor now</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-700">{inChair.length}</span>
          </div>
        </div>
        {inChair.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            <Smile className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No patient is currently in a chair
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {inChair.map(item => <QueueRow key={item.id} item={item} onClick={() => setSelected(item)} />)}
          </div>
        )}
      </div>

      {waiting.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">Waiting / called</h2>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-bold text-gray-600">{waiting.length}</span>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {waiting.map(item => <QueueRow key={item.id} item={item} onClick={() => setSelected(item)} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function QueueRow({ item, onClick }: { item: QueueItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
    >
      <div className={cn(
        'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold text-white',
        item.status === 'IN_CHAIR' ? 'bg-amber-500' : 'bg-blue-500'
      )}>
        {item.queueNumber}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-gray-900">{queuePatientName(item)}</p>
        <p className="text-sm text-gray-500">
          {queuePatientMeta(item)}
          {item.assignedDoctor ? ` - Dr. ${item.assignedDoctor.name}` : ''}
        </p>
      </div>
      <ChevronLeft className="w-4 h-4 flex-shrink-0 rotate-180 text-gray-300" />
    </button>
  )
}

function PatientDiagnosisPanel({ item, onBack }: { item: QueueItem; onBack: () => void }) {
  const [teeth, setTeeth] = useState<Record<number, ToothState>>({})
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/queue/${item.id}/diagnosis-draft`)
      .then(res => res.json())
      .then(data => { if (!cancelled) setTeeth(data.toothFindings ?? {}) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [item.id])

  function handleChange(next: Record<number, ToothState>) {
    setTeeth(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/queue/${item.id}/diagnosis-draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toothFindings: next }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save')
        setSavedAt(new Date())
      } catch (e: any) {
        showToast('error', 'Could not save findings', e.message)
      }
    }, 600)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to list
      </button>

      <div className="section-card">
        <div className="section-card-header">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{queuePatientName(item)}</h1>
            <p className="text-base text-gray-500">
              {queuePatientMeta(item)}
              {item.assignedDoctor ? ` - Dr. ${item.assignedDoctor.name}` : ''}
            </p>
          </div>
          <div className="text-sm text-gray-400">
            {loading ? 'Loading…' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : 'Not saved yet'}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-3 text-sm text-blue-800">
        Tap teeth to record what the doctor calls out. The doctor sees these findings live in their Diagnosis step and can adjust them before finishing the visit.
      </div>

      {!loading && (
        <ToothChart teeth={teeth} onChange={handleChange} />
      )}
    </div>
  )
}

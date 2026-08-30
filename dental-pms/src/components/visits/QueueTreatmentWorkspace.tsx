'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, RefreshCw, Stethoscope } from 'lucide-react'
import { formatTime } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

function displayName(item: any) {
  if (item.displayName) return item.displayName
  if (item.intakeSubmission?.firstName || item.intakeSubmission?.lastName) {
    return [item.intakeSubmission.firstName, item.intakeSubmission.lastName].filter(Boolean).join(' ')
  }
  return `Token ${item.queueNumber}`
}

export function QueueTreatmentWorkspace({ queueItem }: { queueItem: any }) {
  const router = useRouter()
  const [checking, setChecking] = useState(false)

  async function checkPatientLinked() {
    setChecking(true)
    try {
      const res = await fetch(`/api/queue?includeClosed=true&branchId=${queueItem.branchId}`)
      const rows = await res.json()
      if (!res.ok) throw new Error(rows.error ?? 'Could not check queue')
      const fresh = rows.find((row: any) => row.id === queueItem.id)
      if (fresh?.patient?.id) {
        router.push(`/visits/new?patientId=${fresh.patient.id}&queueId=${queueItem.id}`)
        return
      }
      showToast('info', 'Patient details not linked yet', 'You can continue the examination; refresh again after reception enters the paper form.')
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="section-card border-blue-200">
        <div className="section-card-body">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Treatment workspace</p>
              <h1 className="mt-1 text-3xl font-bold text-gray-900">{displayName(queueItem)}</h1>
              <p className="mt-1 text-base text-gray-500">
                Token {queueItem.queueNumber} - arrived {formatTime(queueItem.arrivedAt)}
                {queueItem.assignedDoctor ? ` - ${queueItem.assignedDoctor.name}` : ''}
              </p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">
              In chair
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <div className="flex gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
          <div>
            <p className="font-bold text-amber-900">Patient profile is still pending</p>
            <p className="mt-1 text-sm font-semibold text-amber-800">
              Reception can enter the paper form later. Once linked, refresh here to open the full diagnosis, treatment, prescription, and billing workflow.
            </p>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Clinical treatment</h2>
          </div>
        </div>
        <div className="section-card-body space-y-4">
          <div>
            <label className="form-label">Reason / complaint</label>
            <textarea
              readOnly
              value={queueItem.reason ?? ''}
              className="form-input !h-24 resize-none bg-gray-50"
              placeholder="No reason recorded yet"
            />
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-600">
            The full treatment form unlocks when this token is linked to a patient record.
          </div>
          <button onClick={checkPatientLinked} disabled={checking} className="btn-primary">
            <RefreshCw className={checking ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {checking ? 'Checking...' : 'Refresh patient link'}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Props {
  visitId: string
  doctorId: string
  doctorName: string
  currentUser: { id: string; role: string }
  locked: boolean
}

// Append-only observation stream. A nurse and the doctor can both write to
// the same active visit from different devices — polling avoids the need
// for a websocket and there's never a conflict because nothing is edited,
// only appended.
export function ObservationFeed({ visitId, doctorId, doctorName, currentUser, locked }: Props) {
  const [items, setItems] = useState<any[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const isNurse = currentUser.role === 'NURSE' || currentUser.role === 'HEAD_NURSE'
  const isOwnDoctor = currentUser.id === doctorId

  const load = useCallback(async () => {
    const res = await fetch(`/api/visits/${visitId}/observations`)
    if (res.ok) setItems(await res.json())
  }, [visitId])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  async function send() {
    if (!text.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/visits/${visitId}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          onBehalfOfDoctorId: isNurse ? doctorId : null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save')
      setText('')
      load()
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSending(false)
    }
  }

  const canWrite = !locked && (isNurse || isOwnDoctor)

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-900">Observations</h2>
          {items.length > 0 && (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-sm font-bold text-teal-700">{items.length}</span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-base">No observations recorded yet</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map(obs => (
            <div key={obs.id} className="px-6 py-3">
              <p className="text-base text-gray-900">{obs.text}</p>
              <p className="text-sm text-gray-400 mt-1">
                {obs.onBehalfOfDoctor
                  ? `Entered by ${obs.author.name} on behalf of Dr. ${obs.onBehalfOfDoctor.name}`
                  : `Dr. ${obs.author.name}`}
                {' · '}{formatDateTime(obs.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {canWrite ? (
        <div className="section-card-body flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
            className="form-input flex-1"
            placeholder={isNurse ? `Note for Dr. ${doctorName}...` : 'Add an observation...'}
          />
          <button onClick={send} disabled={sending || !text.trim()} className="btn-primary !px-4">
            <Send className="w-4 h-4" />
          </button>
        </div>
      ) : locked ? (
        <p className="section-card-body text-sm text-gray-400">This visit has ended — no further observations can be added.</p>
      ) : null}
    </div>
  )
}

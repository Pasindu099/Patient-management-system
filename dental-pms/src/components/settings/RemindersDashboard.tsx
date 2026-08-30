'use client'

import { useState } from 'react'
import {
  MessageCircle, Phone, Send, CheckCircle,
  AlertTriangle, Clock, Globe, RefreshCw,
} from 'lucide-react'
import { cn, formatTime, formatDate, timeAgo } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Appointment {
  id: string
  startTime: string
  patient: { firstName: string; lastName: string; phone: string; preferredLanguage: string; communicationPref: string }
  branch?: { name: string }
}

interface Props {
  pendingAppointments: Appointment[]
  recentLogs:          any[]
}

export function RemindersDashboard({ pendingAppointments, recentLogs }: Props) {
  const [appts,    setAppts]    = useState(pendingAppointments)
  const [sentIds,  setSentIds]  = useState<Set<string>>(new Set())
  const [sending,  setSending]  = useState<string | null>(null)  // 'bulk' | apptId
  const [bulkDone, setBulkDone] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number } | null>(null)

  // Templates preview
  const PREVIEW_EN = (name: string, date: string, time: string) =>
    `Dear ${name}, reminder: your dental appointment is tomorrow (${date}) at ${time}. See you then!`
  const PREVIEW_SI = (name: string, date: string, time: string) =>
    `ආයුබෝවන් ${name}, ඔබගේ දන්ත චිකිත්සා හමුව හෙට (${date}) ${time} ට ඇත. ස්තූතියි.`

  async function sendOne(appt: Appointment, channel: 'sms' | 'whatsapp') {
    setSending(appt.id)
    try {
      const res  = await fetch('/api/reminders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ appointmentId: appt.id, type: 'appointment_24h', channel }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed')
      setSentIds(prev => new Set([...prev, appt.id]))
      showToast('success', `Reminder sent to ${appt.patient.firstName} via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`)
    } catch (e: any) {
      showToast('error', 'Could not send reminder', e.message)
    } finally {
      setSending(null)
    }
  }

  async function sendBulk() {
    setSending('bulk')
    setBulkResult(null)
    try {
      const res  = await fetch('/api/reminders', { method: 'GET' })
      const json = await res.json()
      setBulkResult({ sent: json.sent, failed: json.failed })
      setBulkDone(true)
      if (json.sent > 0) {
        showToast('success', `${json.sent} reminder${json.sent !== 1 ? 's' : ''} sent successfully`)
        setAppts([])
      }
    } catch {
      showToast('error', 'Bulk send failed')
    } finally {
      setSending(null)
    }
  }

  const configuredChannels = {
    sms:       typeof process !== 'undefined', // always show — will warn if not configured
    whatsapp:  typeof process !== 'undefined',
  }

  return (
    <div className="space-y-6">

      {/* Config status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            label:   'Mobitel SMS',
            channel: 'sms',
            icon:    Phone,
            desc:    'Via Notify.lk API',
            envKey:  'NOTIFY_LK_API_KEY',
            color:   'text-blue-600',
            bg:      'bg-blue-50 border-blue-200',
          },
          {
            label:   'WhatsApp Business',
            channel: 'whatsapp',
            icon:    MessageCircle,
            desc:    'Via Facebook Graph API',
            envKey:  'WHATSAPP_TOKEN',
            color:   'text-green-600',
            bg:      'bg-green-50 border-green-200',
          },
        ].map(ch => (
          <div key={ch.channel} className={`border-2 rounded-2xl p-4 ${ch.bg}`}>
            <div className="flex items-center gap-3 mb-2">
              <ch.icon className={`w-5 h-5 ${ch.color}`} />
              <p className="text-base font-semibold text-gray-900">{ch.label}</p>
            </div>
            <p className="text-sm text-gray-500">{ch.desc}</p>
            <p className="text-xs text-gray-400 mt-2">
              Add <code className="bg-white px-1 rounded border border-gray-200">{ch.envKey}</code> to{' '}
              <code className="bg-white px-1 rounded border border-gray-200">.env.local</code> to enable
            </p>
          </div>
        ))}
      </div>

      {/* Message templates preview */}
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="text-lg font-semibold text-gray-900">Message templates</h2>
          <span className="text-sm text-gray-400">Patient's preferred language is used automatically</span>
        </div>
        <div className="section-card-body space-y-3">
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-bold text-blue-700 uppercase tracking-wide">English</p>
            </div>
            <p className="text-base text-gray-800 leading-relaxed">
              {PREVIEW_EN('Dilini Wickramasinghe', 'Friday 18 April', '9:00 AM')}
            </p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-bold text-amber-700 uppercase tracking-wide">සිංහල (Sinhala)</p>
            </div>
            <p className="text-base text-gray-800 leading-relaxed">
              {PREVIEW_SI('රුවන් ජයසූරිය', 'සිකුරාදා 18 අප්‍රේල්', 'ප.ව. 2:00')}
            </p>
          </div>
        </div>
      </div>

      {/* Tomorrow's pending reminders */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Tomorrow's appointments</h2>
            <span className="bg-blue-100 text-blue-700 text-sm font-bold px-2.5 py-0.5 rounded-full">
              {appts.filter(a => !sentIds.has(a.id)).length} pending
            </span>
          </div>

          {appts.filter(a => !sentIds.has(a.id)).length > 0 && (
            <button
              onClick={sendBulk}
              disabled={sending === 'bulk'}
              className="btn-primary !text-sm !px-4 !py-2"
            >
              {sending === 'bulk' ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Sending…</>
              ) : (
                <><Send className="w-4 h-4" />Send all reminders</>
              )}
            </button>
          )}
        </div>

        {/* Bulk result */}
        {bulkResult && (
          <div className={cn(
            'mx-6 mb-4 flex items-center gap-3 rounded-xl px-5 py-3 border-2',
            bulkResult.failed === 0
              ? 'bg-green-50 border-green-300'
              : 'bg-amber-50 border-amber-300'
          )}>
            <CheckCircle className={cn('w-5 h-5 flex-shrink-0', bulkResult.failed === 0 ? 'text-green-600' : 'text-amber-600')} />
            <p className="text-base font-semibold text-gray-900">
              {bulkResult.sent} sent · {bulkResult.failed} failed
            </p>
          </div>
        )}

        {appts.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
            <p className="text-base font-semibold text-green-700">All done — no pending reminders for tomorrow</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {appts.map(appt => {
              const isSent = sentIds.has(appt.id)
              const isSending = sending === appt.id
              const lang = appt.patient.preferredLanguage === 'si' ? 'si' : 'en'
              const prefChannel = appt.patient.communicationPref ?? 'whatsapp'

              return (
                <div key={appt.id} className={cn(
                  'flex items-center gap-4 px-6 py-4',
                  isSent && 'bg-green-50 opacity-70'
                )}>
                  {/* Time */}
                  <div className="w-14 text-center flex-shrink-0">
                    <p className="text-base font-bold text-gray-900">{formatTime(appt.startTime)}</p>
                    <p className="text-xs text-gray-400">{appt.branch?.name ?? ''}</p>
                  </div>

                  {/* Patient */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-semibold text-gray-900">
                        {appt.patient.firstName} {appt.patient.lastName}
                      </p>
                      <span className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        lang === 'si' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {lang === 'si' ? 'Sinhala' : 'English'}
                      </span>
                      <span className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        prefChannel === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      )}>
                        {prefChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{appt.patient.phone}</p>
                  </div>

                  {/* Actions */}
                  {isSent ? (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                      <CheckCircle className="w-4 h-4" />Sent
                    </span>
                  ) : (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => sendOne(appt, 'whatsapp')}
                        disabled={!!sending}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                                   bg-green-100 text-green-700 hover:bg-green-200 transition-colors min-h-[44px]"
                      >
                        {isSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                        WA
                      </button>
                      <button
                        onClick={() => sendOne(appt, 'sms')}
                        disabled={!!sending}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                                   bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors min-h-[44px]"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        SMS
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent reminder log */}
      {recentLogs.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="text-lg font-semibold text-gray-900">Recent reminder log</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Channel</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map(log => {
                  const details = (log.details as any) ?? {}
                  return (
                    <tr key={log.id}>
                      <td className="font-medium">
                        {log.patient
                          ? `${log.patient.firstName} ${log.patient.lastName}`
                          : '—'}
                      </td>
                      <td>
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          details.channel === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        )}>
                          {details.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                        </span>
                      </td>
                      <td className="text-sm text-gray-600">
                        {details.type?.replace('_', ' ') ?? 'reminder'}
                      </td>
                      <td>
                        {details.success ? (
                          <span className="flex items-center gap-1 text-sm font-semibold text-green-700">
                            <CheckCircle className="w-3.5 h-3.5" />Sent
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm font-semibold text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" />{details.error ?? 'Failed'}
                          </span>
                        )}
                      </td>
                      <td className="text-sm text-gray-400">{timeAgo(log.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

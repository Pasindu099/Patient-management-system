'use client'

import { useState } from 'react'
import { cn, formatDate, formatDateTime, formatCurrency, APPOINTMENT_TYPE_LABELS } from '@/lib/utils'
import {
  Activity, ClipboardList, Receipt,
  Heart, FileText, Pill, AlertTriangle,
  TrendingUp, Syringe, CheckCircle,
  XCircle, Clock, Calendar,
} from 'lucide-react'

const TABS = [
  { id: 'overview',  label: 'Overview',        icon: Activity },
  { id: 'medical',   label: 'Medical history', icon: Heart },
  { id: 'dental',    label: 'Dental history',  icon: ClipboardList },
  { id: 'billing',   label: 'Billing',         icon: Receipt },
  { id: 'ai',        label: 'AI insights',     icon: TrendingUp },
]

const APPT_STATUS_ICON: Record<string, React.ElementType> = {
  COMPLETED:   CheckCircle,
  CONFIRMED:   CheckCircle,
  SCHEDULED:   Clock,
  CANCELLED:   XCircle,
  NO_SHOW:     XCircle,
  IN_PROGRESS: Clock,
}

const APPT_STATUS_COLOR: Record<string, string> = {
  COMPLETED:   'text-green-600',
  CONFIRMED:   'text-green-600',
  SCHEDULED:   'text-blue-600',
  CANCELLED:   'text-red-500',
  NO_SHOW:     'text-red-500',
  IN_PROGRESS: 'text-amber-600',
}

export function PatientTabs({ patient, canSeeBilling = true }: { patient: any; canSeeBilling?: boolean }) {
  const [activeTab, setActiveTab] = useState('overview')
  // The billing tab is a ledger of every bill this patient has ever had —
  // an aggregate, so it is hidden from doctors along with the rest.
  const tabs = canSeeBilling ? TABS : TABS.filter(t => t.id !== 'billing')

  const medHx      = patient.medicalHistory
  const allergies  = (medHx?.allergies  as any[]) ?? []
  const medications = (medHx?.medications as any[]) ?? []
  const conditions  = (medHx?.conditions  as any[]) ?? []
  const appointments = patient.appointments ?? []
  const treatmentPlans = patient.treatmentPlans ?? []
  const recalls = patient.recalls ?? []
  const vitalSigns = patient.vitalSigns ?? []
  const clinicalNotes = patient.clinicalNotes ?? []
  const invoices = patient.invoices ?? []
  const latestRisk  = patient.riskAssessments?.[0]

  return (
    <div className="section-card">
      {/* Tab bar */}
      <div className="px-2 pt-2 border-b border-gray-200 flex gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-t-lg text-base font-semibold',
              'whitespace-nowrap transition-colors min-h-[44px] border-b-2',
              activeTab === tab.id
                ? 'text-blue-700 border-blue-600 bg-blue-50'
                : 'text-gray-500 border-transparent hover:text-gray-800 hover:bg-gray-50'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">

        {/* ── OVERVIEW ─────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Appointment history */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Recent appointments
              </h3>
              {appointments.length === 0 ? (
                <p className="text-base text-gray-400 italic">No appointments on record</p>
              ) : (
                <div className="space-y-2">
                  {appointments.slice(0, 6).map((appt: any) => {
                    const Icon  = APPT_STATUS_ICON[appt.status]  ?? Clock
                    const color = APPT_STATUS_COLOR[appt.status] ?? 'text-gray-400'
                    return (
                      <div key={appt.id}
                           className="flex items-center gap-3 py-2 border-b
                                      border-gray-100 last:border-0">
                        <Icon className={cn('w-4 h-4 flex-shrink-0', color)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium text-gray-900 truncate">
                            {APPOINTMENT_TYPE_LABELS[appt.type] ?? appt.type}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDate(appt.startTime)} · {appt.provider.name}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Active treatment plans */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Treatment plans
              </h3>
              {treatmentPlans.length === 0 ? (
                <p className="text-base text-gray-400 italic">No treatment plans</p>
              ) : (
                <div className="space-y-3">
                  {treatmentPlans.map((plan: any) => (
                    <div key={plan.id}
                         className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-base font-semibold text-gray-900">{plan.title}</p>
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0',
                          plan.status === 'PLANNED'     ? 'bg-blue-100 text-blue-700'
                          : plan.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700'
                          : plan.status === 'COMPLETED'   ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                        )}>
                          {plan.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{plan.items.length} procedure{plan.items.length !== 1 ? 's' : ''}</span>
                        <span className="font-semibold text-gray-700">
                          {formatCurrency(plan.totalFee)} total
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recalls */}
            {recalls.length > 0 && (
              <div className="lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Upcoming recalls</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {recalls.map((recall: any) => {
                    const isOverdue = new Date(recall.dueDate) < new Date()
                    return (
                      <div key={recall.id}
                           className={cn(
                             'border-2 rounded-xl p-4',
                             isOverdue ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-gray-50'
                           )}>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className={cn('w-4 h-4', isOverdue ? 'text-orange-600' : 'text-gray-500')} />
                          <span className={cn(
                            'text-sm font-semibold',
                            isOverdue ? 'text-orange-800' : 'text-gray-700'
                          )}>
                            {recall.recallType}
                          </span>
                        </div>
                        <p className={cn('text-base font-bold', isOverdue ? 'text-orange-900' : 'text-gray-900')}>
                          {isOverdue ? 'Overdue — ' : ''}{formatDate(recall.dueDate)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MEDICAL HISTORY ──────────────────────────────────── */}
        {activeTab === 'medical' && (
          <div className="space-y-6">
            {/* Allergies */}
            <Section title="Allergies" icon={AlertTriangle} iconColor="text-red-600">
              {allergies.length === 0 ? (
                <p className="text-base text-gray-500 italic">No known allergies recorded</p>
              ) : (
                <div className="space-y-2">
                  {allergies.map((a: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 bg-red-50 border
                                            border-red-200 rounded-xl px-4 py-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-base font-bold text-red-900">{a.substance}</p>
                        <p className="text-sm text-red-700">
                          {a.severity} reaction · {a.reaction}
                          {a.confirmed ? ' · Confirmed' : ' · Reported'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Medications */}
            <Section title="Current medications" icon={Pill} iconColor="text-purple-600">
              {medications.length === 0 ? (
                <p className="text-base text-gray-500 italic">No medications recorded</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {medications.map((m: any, i: number) => (
                    <div key={i} className="border border-gray-200 rounded-xl px-4 py-3">
                      <p className="text-base font-semibold text-gray-900">{m.name}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {m.dose} · {m.frequency}
                        {m.prescriber ? ` · Dr. ${m.prescriber}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Conditions */}
            <Section title="Medical conditions" icon={Heart} iconColor="text-rose-600">
              {conditions.length === 0 ? (
                <p className="text-base text-gray-500 italic">No conditions recorded</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {conditions.map((c: any, i: number) => (
                    <div key={i} className="border border-gray-200 rounded-xl px-4 py-3">
                      <p className="text-base font-semibold text-gray-900">{c.condition}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Status: {c.status}
                        {c.diagnosedDate ? ` · Diagnosed: ${formatDate(c.diagnosedDate)}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Vitals */}
            {vitalSigns.length > 0 && (
              <Section title="Vital signs log" icon={Activity} iconColor="text-blue-600">
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                        <th className="pb-2 font-semibold">Date</th>
                        <th className="pb-2 font-semibold">Blood pressure</th>
                        <th className="pb-2 font-semibold">Pulse</th>
                        <th className="pb-2 font-semibold">O₂ sat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vitalSigns.map((v: any) => (
                        <tr key={v.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-2.5 text-gray-600">{formatDate(v.recordedAt)}</td>
                          <td className="py-2.5">
                            {v.systolic && v.diastolic ? (
                              <span className={cn(
                                'font-semibold',
                                (v.systolic > 140 || v.diastolic > 90)
                                  ? 'text-red-600' : 'text-gray-900'
                              )}>
                                {v.systolic}/{v.diastolic} mmHg
                                {(v.systolic > 140 || v.diastolic > 90) && (
                                  <span className="ml-2 text-xs bg-red-100 text-red-700
                                                   px-1.5 py-0.5 rounded-full">High</span>
                                )}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-2.5 text-gray-700">
                            {v.pulse ? `${v.pulse} bpm` : '—'}
                          </td>
                          <td className="py-2.5 text-gray-700">
                            {v.oxygenSat ? `${v.oxygenSat}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ── DENTAL HISTORY ───────────────────────────────────── */}
        {activeTab === 'dental' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Visit history</h3>
            {appointments.length === 0 ? (
              <p className="text-base text-gray-400 italic">No visits recorded</p>
            ) : (
              <div className="space-y-1">
                {appointments.map((appt: any) => {
                  const Icon  = APPT_STATUS_ICON[appt.status]  ?? Clock
                  const color = APPT_STATUS_COLOR[appt.status] ?? 'text-gray-400'
                  return (
                    <div key={appt.id}
                         className="flex items-center gap-4 px-4 py-3 rounded-xl
                                    hover:bg-gray-50 border border-transparent
                                    hover:border-gray-200 transition-colors">
                      <Icon className={cn('w-5 h-5 flex-shrink-0', color)} />
                      <div className="flex-1">
                        <p className="text-base font-semibold text-gray-900">
                          {APPOINTMENT_TYPE_LABELS[appt.type] ?? appt.type}
                        </p>
                        <p className="text-sm text-gray-500">
                          {appt.provider.name}
                          {appt.notes ? ` · ${appt.notes}` : ''}
                        </p>
                      </div>
                      <p className="text-base text-gray-500 flex-shrink-0">
                        {formatDate(appt.startTime)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Clinical notes */}
            {clinicalNotes.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mt-6">Clinical notes</h3>
                <div className="space-y-3">
                  {clinicalNotes.map((note: any) => (
                    <div key={note.id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-600 uppercase">
                            {note.noteType}
                          </span>
                          {note.isLocked && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2
                                             py-0.5 rounded-full">Locked</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          {note.author.name} · {formatDateTime(note.createdAt)}
                        </p>
                      </div>
                      {note.subjective && (
                        <div className="text-sm text-gray-700 space-y-1">
                          {note.subjective && <p><strong>S:</strong> {note.subjective}</p>}
                          {note.objective  && <p><strong>O:</strong> {note.objective}</p>}
                          {note.assessment && <p><strong>A:</strong> {note.assessment}</p>}
                          {note.plan       && <p><strong>P:</strong> {note.plan}</p>}
                        </div>
                      )}
                      {note.content && (
                        <p className="text-sm text-gray-700">{note.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── BILLING ──────────────────────────────────────────── */}
        {activeTab === 'billing' && canSeeBilling && (
          <div className="space-y-4">
            {invoices.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-base text-gray-400">No invoices on record</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900">Recent invoices</h3>
                <div className="space-y-2">
                  {invoices.map((inv: any) => (
                    <div key={inv.id}
                         className="flex items-center justify-between px-4 py-3
                                    border border-gray-200 rounded-xl">
                      <div>
                        <p className="text-base font-semibold text-gray-900 font-mono">
                          {inv.invoiceNumber}
                        </p>
                        <p className="text-sm text-gray-500">{formatDate(inv.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-gray-900">
                          {formatCurrency(inv.total)}
                        </p>
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          inv.status === 'PAID'    ? 'bg-green-100 text-green-700'
                          : inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700'
                          : inv.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                        )}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── AI INSIGHTS ──────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <div className="space-y-5">
            {!latestRisk ? (
              <div className="text-center py-8">
                <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-base text-gray-400">No risk assessment yet</p>
              </div>
            ) : (
              <>
                {/* Risk score */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={cn(
                    'border-2 rounded-xl p-5 text-center',
                    latestRisk.riskLevel === 'HIGH' || latestRisk.riskLevel === 'VERY_HIGH'
                      ? 'border-red-300 bg-red-50'
                      : latestRisk.riskLevel === 'MODERATE'
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-green-300 bg-green-50'
                  )}>
                    <p className="text-sm text-gray-500 font-medium mb-1">Overall risk score</p>
                    <p className={cn(
                      'text-5xl font-bold',
                      latestRisk.riskLevel === 'HIGH' || latestRisk.riskLevel === 'VERY_HIGH'
                        ? 'text-red-700' : latestRisk.riskLevel === 'MODERATE'
                          ? 'text-amber-700' : 'text-green-700'
                    )}>
                      {latestRisk.overallScore}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">out of 100</p>
                  </div>
                  {latestRisk.cariesScore != null && (
                    <div className="border border-gray-200 rounded-xl p-5 text-center bg-gray-50">
                      <p className="text-sm text-gray-500 font-medium mb-1">Caries risk</p>
                      <p className="text-4xl font-bold text-gray-800">{latestRisk.cariesScore}</p>
                    </div>
                  )}
                  {latestRisk.perioScore != null && (
                    <div className="border border-gray-200 rounded-xl p-5 text-center bg-gray-50">
                      <p className="text-sm text-gray-500 font-medium mb-1">Perio risk</p>
                      <p className="text-4xl font-bold text-gray-800">{latestRisk.perioScore}</p>
                    </div>
                  )}
                </div>

                {/* Risk factors */}
                {(latestRisk.riskFactors as any[])?.length > 0 && (
                  <Section title="Risk factors" icon={TrendingUp} iconColor="text-purple-600">
                    <div className="space-y-2">
                      {(latestRisk.riskFactors as any[]).map((f: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 py-2 border-b
                                                border-gray-100 last:border-0">
                          <span className={cn(
                            'text-lg flex-shrink-0 mt-0.5',
                            f.impact === 'negative' ? 'text-red-500' : 'text-green-500'
                          )}>
                            {f.impact === 'negative' ? '↑' : '↓'}
                          </span>
                          <div>
                            <p className="text-base font-semibold text-gray-900">{f.factor}</p>
                            <p className="text-sm text-gray-500">{f.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Recommendations */}
                {(latestRisk.recommendations as any[])?.length > 0 && (
                  <Section title="AI recommendations" icon={Syringe} iconColor="text-blue-600">
                    <div className="space-y-2">
                      {(latestRisk.recommendations as any[]).map((r: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 bg-blue-50
                                                border border-blue-200 rounded-xl px-4 py-3">
                          <span className="text-xs font-bold bg-blue-600 text-white
                                           px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 uppercase">
                            {r.type}
                          </span>
                          <p className="text-base text-blue-900">{r.text}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                <p className="text-sm text-gray-400 text-right">
                  Last assessed: {formatDate(latestRisk.assessedAt)}
                </p>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function Section({
  title, icon: Icon, iconColor, children,
}: {
  title: string; icon: React.ElementType; iconColor: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('w-5 h-5', iconColor)} />
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle, ClipboardList, FileText } from 'lucide-react'
import { cn, formatDate, formatDateTime, formatCurrency, getPatientDisplayName, getAge, getInitials } from '@/lib/utils'
import { SOAPNoteForm }  from './SOAPNoteForm'
import { TreatmentPlanBuilder } from './TreatmentPlanBuilder'

const AVATAR_COLORS = ['bg-blue-500','bg-teal-500','bg-purple-500','bg-amber-500','bg-rose-500']

const TABS = [
  { id: 'notes',     label: 'Clinical notes',  icon: FileText },
  { id: 'plans',     label: 'Treatment plans', icon: ClipboardList },
]

export function ClinicalWorkspace({
  patient, currentUser,
}: {
  patient:      any
  currentUser:  any
}) {
  const [activeTab, setActiveTab] = useState<'notes' | 'plans'>('notes')
  const [refresh, setRefresh]     = useState(0)

  const fullName   = getPatientDisplayName(patient)
  const initials   = getInitials(fullName)
  const avatarBg   = AVATAR_COLORS[fullName.charCodeAt(0) % AVATAR_COLORS.length]
  const allergies  = (patient.medicalHistory?.allergies as any[]) ?? []
  const latestRisk = patient.riskAssessments?.[0]

  function onNoteOrPlanSaved() {
    setRefresh(r => r + 1)
  }

  return (
    <div className="flex flex-col h-full">

      {/* Patient header strip */}
      <div className="bg-white border-b-2 border-gray-200 px-6 py-3">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <Link href="/clinical" className="text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>

          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0', avatarBg)}>
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <Link href={`/patients/${patient.id}`} className="text-lg font-bold text-gray-900 hover:text-blue-600">
                {fullName}
              </Link>
              <span className="text-sm text-gray-400 font-mono">{patient.patientNumber}</span>
              <span className="text-sm text-gray-400">Â·</span>
              <span className="text-sm text-gray-500">{getAge(patient.dateOfBirth)} yrs Â· {patient.gender}</span>
              {patient.nicNumber && (
                <span className="text-sm text-gray-400">Â· NIC: {patient.nicNumber}</span>
              )}
              {allergies.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  {allergies.map((a: any) => a.substance).join(', ')}
                </span>
              )}
              {latestRisk && (
                <span className={cn(
                  'text-xs font-bold px-2.5 py-1 rounded-full',
                  latestRisk.riskLevel === 'HIGH' || latestRisk.riskLevel === 'VERY_HIGH'
                    ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                )}>
                  {latestRisk.riskLevel === 'VERY_HIGH' ? 'Very high risk' : latestRisk.riskLevel + ' risk'}
                </span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0 max-w-7xl mx-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-base font-semibold',
                'border-b-2 transition-colors min-h-[48px]',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">

          {/* â”€â”€ CLINICAL NOTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'notes' && (
            <div className="space-y-5">
              <SOAPNoteForm
                patientId={patient.id}
                currentUser={currentUser}
                onSaved={onNoteOrPlanSaved}
              />

              {/* Existing notes */}
              <div className="section-card">
                <div className="section-card-header">
                  <h2 className="text-lg font-semibold text-gray-900">Note history</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {patient.clinicalNotes
                    .filter((n: any) => n.noteType !== 'tooth_record')
                    .length === 0 ? (
                    <div className="py-10 text-center text-gray-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p>No clinical notes yet</p>
                    </div>
                  ) : (
                    patient.clinicalNotes
                      .filter((n: any) => n.noteType !== 'tooth_record')
                      .map((note: any) => (
                        <div key={note.id} className="px-6 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
                                note.noteType === 'soap' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                              )}>
                                {note.noteType}
                              </span>
                              {note.isLocked && (
                                <span className="text-xs text-gray-400">ðŸ”’ Locked</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400">
                              {note.author.name} Â· {formatDateTime(note.createdAt)}
                            </p>
                          </div>
                          {note.noteType === 'soap' ? (
                            <div className="space-y-1.5 text-sm">
                              {note.subjective && <p><span className="font-bold text-blue-700 mr-1">S</span>{note.subjective}</p>}
                              {note.objective  && <p><span className="font-bold text-blue-700 mr-1">O</span>{note.objective}</p>}
                              {note.assessment && <p><span className="font-bold text-blue-700 mr-1">A</span>{note.assessment}</p>}
                              {note.plan       && <p><span className="font-bold text-blue-700 mr-1">P</span>{note.plan}</p>}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700">{note.content}</p>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* â”€â”€ TREATMENT PLANS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'plans' && (
            <div className="space-y-5">
              <TreatmentPlanBuilder
                patientId={patient.id}
                currentUser={currentUser}
                onSaved={onNoteOrPlanSaved}
              />

              {/* Existing plans */}
              {patient.treatmentPlans.map((plan: any) => (
                <div key={plan.id} className="section-card">
                  <div className="section-card-header">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{plan.title}</h3>
                      <p className="text-sm text-gray-400">
                        Created by {plan.createdBy.name} Â· {formatDate(plan.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'text-sm font-semibold px-3 py-1 rounded-full',
                        plan.status === 'PLANNED'     ? 'bg-blue-100 text-blue-700' :
                        plan.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                        plan.status === 'COMPLETED'   ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {plan.status}
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        {formatCurrency(plan.totalFee, plan.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Phase</th>
                          <th>Procedure</th>
                          <th>Teeth</th>
                          <th className="text-right">Fee</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.items.map((item: any) => (
                          <tr key={item.id}>
                            <td className="text-center font-mono text-sm">{item.phase}</td>
                            <td className="font-medium">{item.procedureName}</td>
                            <td className="text-sm text-gray-500 font-mono">{item.toothNumbers || 'â€”'}</td>
                            <td className="text-right font-semibold">{formatCurrency(item.fee, item.currency)}</td>
                            <td>
                              <span className={cn(
                                'text-xs font-semibold px-2 py-0.5 rounded-full',
                                item.status === 'PLANNED'   ? 'bg-blue-100 text-blue-700' :
                                item.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                              )}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {patient.treatmentPlans.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No treatment plans yet</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

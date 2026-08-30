import { AlertTriangle, ClipboardList, HeartPulse, Pill } from 'lucide-react'
import type React from 'react'
import { cn, formatDate } from '@/lib/utils'

function asArray(value: any): any[] {
  return Array.isArray(value) ? value : []
}

function valueText(value: any) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function labelFromKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
}

export function DoctorMedicalHistoryPanel({ patient }: { patient: any }) {
  const medicalHistory = patient.medicalHistory
  const allergies = asArray(medicalHistory?.allergies)
  const medications = asArray(medicalHistory?.medications)
  const allConditions = asArray(medicalHistory?.conditions)
  const notesCondition = allConditions.find((item: any) => item.condition === 'Detailed history notes')
  const conditions = allConditions.filter((item: any) => item.condition !== 'Detailed history notes')
  const historyNotes = notesCondition?.notes && typeof notesCondition.notes === 'object' ? notesCondition.notes : {}
  const noteEntries = Object.entries(historyNotes)
    .map(([key, value]) => ({ key, label: labelFromKey(key), value: valueText(value) }))
    .filter(item => item.value)

  const flags = [
    medicalHistory?.isPregnant ? 'Pregnant / breast feeding' : null,
    medicalHistory?.isSmoker ? 'Smoker' : null,
    medicalHistory?.requiresAntibiotic ? 'Requires antibiotic cover' : null,
    medicalHistory?.gagReflex ? 'Gag reflex' : null,
    medicalHistory?.anxietyLevel ? `Anxiety level ${medicalHistory.anxietyLevel}/5` : null,
  ].filter(Boolean)

  return (
    <div className="section-card border-2 border-red-100">
      <div className="section-card-header bg-red-50">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-bold text-red-900">Medical history</h2>
        </div>
        {medicalHistory?.lastUpdated && (
          <span className="text-sm font-semibold text-red-700">
            Updated {formatDate(medicalHistory.lastUpdated)}
          </span>
        )}
      </div>

      <div className="section-card-body space-y-5">
        {allergies.length > 0 && (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="text-base font-bold text-red-900">Allergies</h3>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {allergies.map((allergy: any, index: number) => (
                <div key={index} className="rounded-lg bg-white px-3 py-2">
                  <p className="font-bold text-red-900">{allergy.substance || 'Allergy reported'}</p>
                  <p className="text-sm text-red-700">
                    {[allergy.severity, allergy.reaction].filter(Boolean).join(' - ') || 'No reaction details recorded'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {flags.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Clinical cautions</h3>
            <div className="flex flex-wrap gap-2">
              {flags.map((flag: any) => (
                <span key={flag} className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800">
                  {flag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HistoryBlock title="Conditions" icon={ClipboardList} empty="No conditions recorded">
            {conditions.map((condition: any, index: number) => (
              <HistoryRow
                key={index}
                title={condition.condition}
                meta={[
                  condition.status ? `Status: ${condition.status}` : null,
                  condition.diagnosedDate ? `Diagnosed: ${formatDate(condition.diagnosedDate)}` : null,
                ]}
              />
            ))}
          </HistoryBlock>

          <HistoryBlock title="Medications" icon={Pill} empty="No medications recorded">
            {medications.map((medication: any, index: number) => (
              <HistoryRow
                key={index}
                title={medication.name}
                meta={[medication.dose, medication.frequency, medication.prescriber ? `By ${medication.prescriber}` : null]}
              />
            ))}
          </HistoryBlock>
        </div>

        {noteEntries.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Form history notes</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {noteEntries.map(item => (
                <div key={item.key} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{item.label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!medicalHistory && (
          <p className="text-base font-medium text-gray-500">No medical history record is attached to this patient yet.</p>
        )}
      </div>
    </div>
  )
}

function HistoryBlock({
  title, icon: Icon, empty, children,
}: {
  title: string
  icon: any
  empty: string
  children: React.ReactNode
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  const hasItems = Array.isArray(items) ? items.length > 0 : !!items

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-500" />
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
      </div>
      {hasItems ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500">{empty}</p>
      )}
    </div>
  )
}

function HistoryRow({ title, meta }: { title: string; meta: Array<string | null | undefined> }) {
  return (
    <div className="rounded-xl border border-gray-200 px-4 py-3">
      <p className="font-semibold text-gray-900">{title || 'Recorded item'}</p>
      <p className={cn('mt-0.5 text-sm text-gray-500', !meta.filter(Boolean).length && 'hidden')}>
        {meta.filter(Boolean).join(' - ')}
      </p>
    </div>
  )
}

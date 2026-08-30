import Link from 'next/link'
import { AlertTriangle, ShieldCheck, FileQuestion, Pill } from 'lucide-react'
import { cn, formatDate, MEDICAL_CHECK_BY_ID, type MedicalSeverity } from '@/lib/utils'

interface Allergy    { substance?: string; severity?: string; reaction?: string; confirmed?: boolean }
interface Medication { name?: string; dose?: string; frequency?: string; prescriber?: string }
interface Condition  { condition?: string; status?: string }

export interface MedicalHistoryLike {
  allergies:          unknown
  medications:        unknown
  conditions:         unknown
  isPregnant:         boolean
  isSmoker:           boolean
  requiresAntibiotic: boolean
  lastUpdated:        Date | string
}

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

/**
 * Chips shown on the patient profile. Only surfaces things that change how the
 * patient is treated today — background history (previous extractions, COVID
 * vaccination, dyslipidemia) is marked `info` in MEDICAL_CHECKS and stays out.
 */
export function MedicalAlertsBanner({
  medicalHistory, patientId,
}: {
  medicalHistory: MedicalHistoryLike | null
  patientId:      string
}) {
  // Nothing recorded at all — a prompt, not an alarm
  if (!medicalHistory) {
    return (
      <Banner
        tone="amber"
        icon={FileQuestion}
        title="Medical history not recorded"
        action={
          <Link href={`/patients/${patientId}/edit`} className="text-sm font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900">
            Record it now
          </Link>
        }
      >
        <p className="text-sm text-amber-800">
          Confirm allergies and medical conditions with the patient before any treatment.
        </p>
      </Banner>
    )
  }

  const allergies   = asArray<Allergy>(medicalHistory.allergies).filter(a => a?.substance)
  const medications = asArray<Medication>(medicalHistory.medications).filter(m => m?.name)

  // Stored conditions are the checklist ids; the registration form also stashes a
  // "Detailed history notes" entry in here, which lookup naturally discards.
  const flagged = asArray<Condition>(medicalHistory.conditions)
    .map(c => MEDICAL_CHECK_BY_ID[c?.condition ?? ''])
    .filter(Boolean)
    .filter(c => c.severity !== 'info')

  const chips: { label: string; severity: MedicalSeverity }[] = [
    ...flagged
      // Allergies get their own detailed section below
      .filter(c => c.id !== 'allergies')
      .map(c => ({ label: c.alert ?? c.label, severity: c.severity })),
  ]
  if (medicalHistory.requiresAntibiotic && !flagged.some(c => c.id === 'rheumaticFeverInjection')) {
    chips.push({ label: 'Antibiotic prophylaxis required', severity: 'critical' })
  }
  if (medicalHistory.isPregnant && !flagged.some(c => c.id === 'pregnancyBreastFeeding')) {
    chips.push({ label: 'Pregnant / breastfeeding', severity: 'critical' })
  }
  if (medicalHistory.isSmoker) chips.push({ label: 'Smoker', severity: 'caution' })

  const deduped = chips.filter((c, i) => chips.findIndex(x => x.label === c.label) === i)
  const recorded = `Recorded ${formatDate(medicalHistory.lastUpdated)}`

  // History taken and clear — say so plainly, quietly
  if (allergies.length === 0 && deduped.length === 0 && medications.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3">
        <ShieldCheck className="h-5 w-5 flex-shrink-0 text-green-600" />
        <p className="text-sm font-semibold text-green-800">No known allergies or medical alerts</p>
        <p className="ml-auto text-xs text-green-700">{recorded}</p>
      </div>
    )
  }

  const critical = allergies.length > 0 || deduped.some(c => c.severity === 'critical')

  return (
    <Banner
      tone={critical ? 'red' : 'amber'}
      icon={AlertTriangle}
      title={critical ? 'Medical alerts — check before treating' : 'Medical notes'}
      action={<span className={cn('text-xs', critical ? 'text-red-700' : 'text-amber-700')}>{recorded}</span>}
    >
      {allergies.length > 0 && (
        <div className="space-y-1">
          {allergies.map((a, i) => (
            <p key={i} className="text-base font-bold text-red-900">
              <span className="mr-2 rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                Allergy
              </span>
              {a.substance}
              {(a.severity && a.severity !== 'UNKNOWN') || a.reaction ? (
                <span className="ml-2 text-sm font-normal text-red-800">
                  {a.severity && a.severity !== 'UNKNOWN' ? `${a.severity.toLowerCase()} reaction` : 'reaction'}
                  {a.reaction ? `: ${a.reaction}` : ''}
                </span>
              ) : null}
              <span className="ml-2 text-xs font-semibold uppercase text-red-600">
                {a.confirmed ? 'confirmed' : 'patient reported'}
              </span>
            </p>
          ))}
        </div>
      )}

      {deduped.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {deduped.map(c => (
            <span
              key={c.label}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-semibold',
                c.severity === 'critical'
                  ? 'bg-red-600 text-white'
                  : 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
              )}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}

      {medications.length > 0 && (
        <div className={cn('flex items-start gap-2 text-sm', critical ? 'text-red-900' : 'text-amber-900')}>
          <Pill className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            <span className="font-semibold">Medications: </span>
            {medications.map(m => m.name).join(' · ')}
          </p>
        </div>
      )}
    </Banner>
  )
}

const TONES = {
  red:   { box: 'bg-red-50 border-red-500',      icon: 'bg-red-100 text-red-600',       title: 'text-red-900' },
  amber: { box: 'bg-amber-50 border-amber-400',  icon: 'bg-amber-100 text-amber-700',   title: 'text-amber-900' },
}

function Banner({ tone, icon: Icon, title, action, children }: {
  tone:     keyof typeof TONES
  icon:     React.ComponentType<{ className?: string }>
  title:    string
  action?:  React.ReactNode
  children: React.ReactNode
}) {
  const t = TONES[tone]
  return (
    <div
      className={cn('flex items-start gap-4 rounded-xl border-2 px-5 py-4', t.box)}
      role="alert"
      aria-live={tone === 'red' ? 'assertive' : 'polite'}
    >
      <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full', t.icon)}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-baseline gap-3">
          <p className={cn('text-base font-bold uppercase tracking-wide', t.title)}>{title}</p>
          {action && <span className="ml-auto">{action}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}

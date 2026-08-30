'use client'

import { useState } from 'react'
import { ChevronDown, Stethoscope } from 'lucide-react'
import { cn, formatLKR } from '@/lib/utils'
import { fromCents } from '@/lib/money'
import type { GroupId } from './KpiDashboard'

interface Metric {
  label: string
  value: string
  sub?: string
  // 'good' | 'watch' only where a direction is genuinely unambiguous. Metrics
  // like re-treatment rate and discounting are left neutral on purpose.
  tone?: 'good' | 'watch'
}

export function KpiDoctorCard({ doctor: d, group }: { doctor: any; group: GroupId }) {
  const [open, setOpen] = useState(false)

  const pct = (v: number | null) => v === null ? '—' : `${v}%`
  const num = (v: number | null) => v === null ? '—' : String(v)
  const lkr = (c: number) => formatLKR(fromCents(c))

  const metrics: Record<GroupId, Metric[]> = {
    financial: [
      { label: 'Collected', value: lkr(d.collectedCents), sub: `${lkr(d.billedCents)} billed` },
      { label: 'Collection rate', value: pct(d.collectionRate),
        tone: d.collectionRate === null ? undefined : d.collectionRate >= 90 ? 'good' : 'watch' },
      { label: 'Outstanding', value: lkr(d.outstandingCents) },
      { label: 'Revenue per visit', value: lkr(d.revenuePerVisitCents) },
      { label: 'Revenue per patient', value: lkr(d.revenuePerPatientCents) },
      { label: 'Discount given', value: lkr(d.discountCents),
        sub: d.discountRate === null ? 'no list prices logged' : `${d.discountRate}% off list` },
      { label: 'Quote conversion', value: pct(d.quoteConversionRate),
        sub: `${d.convertedItems} of ${d.quotedItems} quoted items` },
      { label: 'Quote value converted', value: pct(d.quoteValueConversionRate),
        sub: `${lkr(d.convertedCents)} of ${lkr(d.quotedCents)}` },
    ],
    productivity: [
      { label: 'Visits', value: String(d.visits) },
      { label: 'Unique patients', value: String(d.uniquePatients) },
      { label: 'New patients', value: String(d.newPatients), tone: 'good' },
      { label: 'Chair time', value: `${Math.round(d.chairMinutes / 60)}h`,
        sub: `${num(d.avgChairMinutes)} min average` },
      { label: 'Chair utilisation', value: pct(d.chairUtilisation),
        sub: d.scheduledMinutes ? `vs ${Math.round(d.scheduledMinutes / 60)}h booked` : 'no booked slots' },
      { label: 'Plan completion', value: pct(d.planCompletionRate),
        sub: `${d.planItemsCompleted} of ${d.planItemsPlanned} planned` },
    ],
    retention: [
      { label: 'Follow-up adherence', value: pct(d.followUpAdherence),
        sub: `${d.followUpsKept} kept of ${d.followUpsDue} due`,
        tone: d.followUpAdherence === null ? undefined : d.followUpAdherence >= 70 ? 'good' : 'watch' },
      { label: 'Patient return rate', value: pct(d.patientReturnRate),
        sub: `${d.returningPatients} seen before by this doctor` },
      { label: 'No-show + cancellation', value: pct(d.noShowRate),
        sub: `${d.noShows} no-show, ${d.cancellations} cancelled`,
        tone: d.noShowRate === null ? undefined : d.noShowRate <= 15 ? 'good' : 'watch' },
      { label: 'Booked appointments', value: String(d.scheduledAppointments),
        sub: 'walk-ins excluded' },
    ],
    quality: [
      { label: 'Repeat work on same tooth', value: String(d.retreatments),
        sub: `${pct(d.retreatmentRate)} of visits, 6-month window` },
      { label: 'Prescriptions', value: String(d.prescriptions),
        sub: `${d.prescriptionItems} items` },
      { label: 'Prescriptions per visit', value: num(d.prescriptionsPerVisit) },
    ],
    efficiency: [
      { label: 'Plan to completion', value: d.avgDaysPlanToCompletion === null ? '—' : `${d.avgDaysPlanToCompletion} days` },
      { label: 'Visits per plan', value: num(d.avgVisitsPerCompletedPlan) },
      { label: 'Average chair time', value: d.avgChairMinutes === null ? '—' : `${d.avgChairMinutes} min` },
    ],
  }

  const showCaveat = group === 'quality'
  const breakdown = group === 'financial' ? d.revenueByCategory
                  : group === 'productivity' ? d.proceduresByCategory
                  : null

  return (
    <div className="section-card overflow-hidden">
      <div className="section-card-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{d.doctorName}</h2>
            <p className="text-sm text-gray-500">
              {d.visits} visit{d.visits === 1 ? '' : 's'} · {d.uniquePatients} patient{d.uniquePatients === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        {breakdown?.length ? (
          <button onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
            By category
            <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100">
        {metrics[group].map(m => (
          <div key={m.label} className="bg-white px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{m.label}</p>
            <p className={cn(
              'text-xl font-bold mt-1',
              m.tone === 'good' ? 'text-green-700' : m.tone === 'watch' ? 'text-amber-600' : 'text-gray-900'
            )}>
              {m.value}
            </p>
            {m.sub && <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>}
          </div>
        ))}
      </div>

      {showCaveat && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Repeat work is matched on patient and tooth number alone. A second visit to the same
            tooth is often planned staged treatment, not rework — treat this as a list to look
            through, never as an error rate.
          </p>
        </div>
      )}

      {open && breakdown?.length ? (
        <div className="border-t border-gray-100 px-5 py-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">{group === 'financial' ? 'Revenue' : 'Procedures'}</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row: any) => (
                <tr key={row.label}>
                  <td className="text-sm text-gray-700">
                    {row.label}
                    {!row.coded && (
                      <span className="ml-2 text-xs text-gray-400" title="Grouped by description text, not fee-catalog category">
                        uncoded
                      </span>
                    )}
                  </td>
                  <td className="text-right font-semibold text-gray-900">
                    {group === 'financial' ? formatLKR(fromCents(row.cents)) : row.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

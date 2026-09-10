import { CLINIC_TIME_ZONE } from '@/lib/utils'

export function salaryPayDate(periodYear: number, periodMonth: number) {
  return new Date(Date.UTC(periodYear, periodMonth, 0, 12, 0, 0, 0))
}

export function salaryPayDateIso(periodYear: number, periodMonth: number) {
  return salaryPayDate(periodYear, periodMonth).toISOString().slice(0, 10)
}

export function salaryPeriodLabel(periodYear: number, periodMonth: number) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: CLINIC_TIME_ZONE,
  }).format(new Date(Date.UTC(periodYear, periodMonth - 1, 1, 12, 0, 0, 0)))
}

export function clinicDateIso(date: Date | string = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(date))
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

export function isSalaryPayable(periodYear: number, periodMonth: number, at: Date | string = new Date()) {
  return clinicDateIso(at) >= salaryPayDateIso(periodYear, periodMonth)
}

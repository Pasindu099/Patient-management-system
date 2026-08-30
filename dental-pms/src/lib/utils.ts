import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, differenceInYears } from 'date-fns'
import type { UserRole } from '@prisma/client'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── DATE ─────────────────────────────────────────────────────────────────────
export const CLINIC_TIME_ZONE = 'Asia/Colombo'

function clinicParts(date: Date | string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(date))

  return Object.fromEntries(parts.map(part => [part.type, part.value]))
}

function shortMonth(date: Date | string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: CLINIC_TIME_ZONE, month: 'short' }).format(new Date(date))
}

export function formatDate(date: Date | string, pattern = 'dd MMM yyyy') {
  const parts = clinicParts(date)
  const day = String(Number(parts.day))
  const map: Record<string, string> = {
    'dd MMM yyyy': `${parts.day} ${shortMonth(date)} ${parts.year}`,
    'd MMMM yyyy': `${day} ${parts.month} ${parts.year}`,
    'EEEE': parts.weekday,
    'EEEE, d MMMM yyyy': `${parts.weekday}, ${day} ${parts.month} ${parts.year}`,
  }
  return map[pattern] ?? `${parts.day} ${shortMonth(date)} ${parts.year}`
}
export function formatDateTime(date: Date | string) {
  const parts = clinicParts(date)
  return `${parts.day} ${shortMonth(date)} ${parts.year}, ${parts.hour}:${parts.minute}`
}
export function formatTime(date: Date | string) {
  const parts = clinicParts(date)
  return `${parts.hour}:${parts.minute}`
}
export function getClinicHour(date: Date | string = new Date()) {
  return Number(clinicParts(date).hour)
}
export function formatClinicClock(date: Date | string = new Date()) {
  const parts = clinicParts(date)
  return {
    time: `${parts.hour}:${parts.minute}`,
    date: new Intl.DateTimeFormat('en-GB', {
      timeZone: CLINIC_TIME_ZONE,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(new Date(date)),
  }
}
export function getAge(dob: Date | string) {
  return differenceInYears(new Date(), new Date(dob))
}
export function timeAgo(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

// ─── CURRENCY — LKR + USD ─────────────────────────────────────────────────────
export function formatLKR(amount: number) {
  return `Rs. ${new Intl.NumberFormat('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`
}
export function formatUSD(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
export function formatCurrency(amount: number, currency: 'LKR' | 'USD' = 'LKR') {
  return currency === 'USD' ? formatUSD(amount) : formatLKR(amount)
}

// ─── NIC — Sri Lanka ──────────────────────────────────────────────────────────
export function validateNIC(nic: string): boolean {
  return /^[0-9]{12}$/.test(nic) || /^[0-9]{9}[VvXx]$/.test(nic)
}
export function formatNIC(nic: string) {
  return nic.toUpperCase()
}
export function nicInfo(nic: string): { year?: number; gender?: 'MALE' | 'FEMALE' } {
  try {
    if (/^[0-9]{9}[VvXx]$/.test(nic)) {
      const year = 1900 + parseInt(nic.slice(0, 2))
      const days = parseInt(nic.slice(2, 5))
      return { year, gender: days > 500 ? 'FEMALE' : 'MALE' }
    }
    if (/^[0-9]{12}$/.test(nic)) {
      const year = parseInt(nic.slice(0, 4))
      const days = parseInt(nic.slice(4, 7))
      return { year, gender: days > 500 ? 'FEMALE' : 'MALE' }
    }
  } catch {}
  return {}
}

// ─── SRI LANKA GEOGRAPHY ──────────────────────────────────────────────────────
export const SL_PROVINCES = [
  'Western', 'Central', 'Southern', 'Northern', 'Eastern',
  'North Western', 'North Central', 'Uva', 'Sabaragamuwa',
]
export const SL_DISTRICTS: Record<string, string[]> = {
  'Western':       ['Colombo', 'Gampaha', 'Kalutara'],
  'Central':       ['Kandy', 'Matale', 'Nuwara Eliya'],
  'Southern':      ['Galle', 'Matara', 'Hambantota'],
  'Northern':      ['Jaffna', 'Kilinochchi', 'Mannar', 'Mullaitivu', 'Vavuniya'],
  'Eastern':       ['Ampara', 'Batticaloa', 'Trincomalee'],
  'North Western': ['Kurunegala', 'Puttalam'],
  'North Central': ['Anuradhapura', 'Polonnaruwa'],
  'Uva':           ['Badulla', 'Monaragala'],
  'Sabaragamuwa':  ['Kegalle', 'Ratnapura'],
}

// ─── PATIENT ──────────────────────────────────────────────────────────────────
export function getPatientDisplayName(p: { firstName: string; lastName: string; preferredName?: string | null }) {
  return `${p.preferredName || p.firstName} ${p.lastName}`
}
export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ─── ROLES ────────────────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator', DOCTOR: 'Doctor', HEAD_NURSE: 'Head Nurse',
  NURSE: 'Dental Nurse', RECEPTIONIST: 'Receptionist',
}
export const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-800', DOCTOR: 'bg-blue-100 text-blue-800',
  HEAD_NURSE: 'bg-indigo-100 text-indigo-800', NURSE: 'bg-green-100 text-green-800',
  RECEPTIONIST: 'bg-amber-100 text-amber-800',
}

// ─── MEDICAL HISTORY ──────────────────────────────────────────────────────────
// One source of truth for the paper-form checklist. Registration, patient edit,
// the reception paper-entry form and the medical alerts banner all read it, so
// adding a question here adds it everywhere.
//
// `severity` drives the alerts banner on the patient profile:
//   critical — changes how treatment is delivered today (red)
//   caution  — worth knowing before treating (amber)
//   info     — background history, not alert-worthy (hidden from the banner)
// `alert` is the short form used on the banner; `label` is the full question.
export type MedicalSeverity = 'critical' | 'caution' | 'info'

export const MEDICAL_CHECKS: {
  id: string; label: string; severity: MedicalSeverity; alert?: string
}[] = [
  { id: 'allergies',               label: 'Allergies',                                                    severity: 'critical' },
  { id: 'diabetesDrugs',           label: 'Diabetes Mellitus - Drugs',                                    severity: 'caution',  alert: 'Diabetes — on medication' },
  { id: 'hypertensionDrugs',       label: 'Hypertension - Drugs',                                         severity: 'caution',  alert: 'Hypertension — on medication' },
  { id: 'dyslipidemia',            label: 'Dyslipidemia',                                                 severity: 'info' },
  { id: 'gastricProblem',          label: 'Gastric Problem',                                              severity: 'caution',  alert: 'Gastric problem' },
  { id: 'highBloodPressure',       label: 'High Blood Pressure',                                          severity: 'caution',  alert: 'High blood pressure' },
  { id: 'diabetes',                label: 'Diabetes',                                                     severity: 'caution' },
  { id: 'rheumaticFeverInjection', label: 'Monthly Injection / Rheumatic Fever History',                  severity: 'critical', alert: 'Rheumatic fever — antibiotic prophylaxis' },
  { id: 'pregnancyBreastFeeding',  label: 'Pregnancy / Breast Feeding',                                   severity: 'critical', alert: 'Pregnant / breastfeeding' },
  { id: 'coughColdFever',          label: 'Cough / Cold / Fever',                                         severity: 'caution',  alert: 'Cough / cold / fever' },
  { id: 'heartProblem',            label: 'History of MI, chest pain, high pressure or heart problem',    severity: 'critical', alert: 'Cardiac history (MI / chest pain)' },
  { id: 'epilepsy',                label: 'Epilepsy',                                                     severity: 'critical' },
  { id: 'previousExtraction',      label: 'Previous Extraction',                                          severity: 'info' },
  { id: 'previousSurgeries',       label: 'Previous Surgeries',                                           severity: 'info' },
  { id: 'covidVaccinated',         label: 'COVID-19 vaccination',                                         severity: 'info' },
]

export const MEDICAL_CHECK_BY_ID = Object.fromEntries(MEDICAL_CHECKS.map(c => [c.id, c]))

// ─── PATIENT LANGUAGES ────────────────────────────────────────────────────────
// Sri Lanka's official languages. Tamil is defined but switched off until the
// chain has Tamil-speaking doctors — flip `enabled` to true and it appears in
// every patient form at once. Add the matching `ta` strings to TEMPLATES in
// lib/sms.ts first, otherwise Tamil patients fall back to English reminders.
export const PATIENT_LANGUAGES: { value: string; label: string; enabled: boolean }[] = [
  { value: 'en', label: 'English',           enabled: true  },
  { value: 'si', label: 'Sinhala (සිංහල)',  enabled: true  },
  { value: 'ta', label: 'Tamil (தமிழ்)',     enabled: false },
]

export const ACTIVE_PATIENT_LANGUAGES = PATIENT_LANGUAGES.filter(l => l.enabled)

export const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  PATIENT_LANGUAGES.map(l => [l.value, l.label]),
)

/**
 * Options for a preferred-language <select>. Keeps `current` in the list even if
 * it is disabled or unrecognised, so editing a patient never silently rewrites
 * their stored language.
 */
export function languageOptions(current?: string) {
  const opts = [...ACTIVE_PATIENT_LANGUAGES]
  if (current && !opts.some(o => o.value === current)) {
    opts.push({
      value:   current,
      label:   LANGUAGE_LABELS[current] ?? current.toUpperCase(),
      enabled: false,
    })
  }
  return opts
}

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────
export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  CHECKUP: 'Checkup', CLEANING: 'Scaling & Cleaning', FILLING: 'Filling',
  CROWN: 'Crown', ROOT_CANAL: 'Root Canal', EXTRACTION: 'Extraction',
  ORTHODONTICS: 'Orthodontics', WHITENING: 'Whitening', IMPLANT: 'Implant',
  CONSULTATION: 'Consultation', EMERGENCY: 'Emergency', FOLLOW_UP: 'Follow-up',
  WALKIN: 'Walk-in',
}
export const APPOINTMENT_TYPE_DURATIONS: Record<string, number> = {
  CHECKUP: 30, CLEANING: 60, FILLING: 45, CROWN: 90, ROOT_CANAL: 90,
  EXTRACTION: 45, ORTHODONTICS: 60, WHITENING: 90, IMPLANT: 120,
  CONSULTATION: 30, EMERGENCY: 45, FOLLOW_UP: 20, WALKIN: 30,
}
export const BOOKING_SOURCE_LABELS: Record<string, string> = {
  WALKIN: 'Walk-in', PHONE: 'Phone', WHATSAPP: 'WhatsApp',
  ONLINE: 'Online', RECEPTIONIST: 'Receptionist',
}
export const BOOKING_SOURCE_COLORS: Record<string, string> = {
  WALKIN: 'bg-orange-100 text-orange-700', PHONE: 'bg-blue-100 text-blue-700',
  WHATSAPP: 'bg-green-100 text-green-700', ONLINE: 'bg-purple-100 text-purple-700',
  RECEPTIONIST: 'bg-gray-100 text-gray-600',
}
export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800', CONFIRMED: 'bg-green-100 text-green-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700', NO_SHOW: 'bg-red-100 text-red-700',
  RESCHEDULED: 'bg-purple-100 text-purple-700',
}

// ─── MISC ─────────────────────────────────────────────────────────────────────
export function truncate(str: string, length: number) {
  return str.length <= length ? str : str.slice(0, length) + '…'
}
export function generatePatientNumber() {
  return `PT-${String(Math.floor(Math.random() * 900000) + 100000)}`
}
export function formatRiskScore(score: number) {
  if (score >= 75) return { label: 'Very High Risk', color: 'text-red-700 bg-red-50 border-red-200' }
  if (score >= 50) return { label: 'High Risk', color: 'text-orange-700 bg-orange-50 border-orange-200' }
  if (score >= 25) return { label: 'Moderate Risk', color: 'text-amber-700 bg-amber-50 border-amber-200' }
  return { label: 'Low Risk', color: 'text-green-700 bg-green-50 border-green-200' }
}

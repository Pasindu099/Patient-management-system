// Central permission map. Every role-based access decision in the app goes
// through can()/helpers here, so a role change is a one-file edit.
// v2 roles: ADMIN | DOCTOR | HEAD_NURSE | NURSE | RECEPTIONIST

export type Permission =
  | 'clinical.visit'        // start/run visits, clinical workspace
  | 'clinical.diagnosis'    // nurse-assist: edit the tooth chart draft for a patient in chair
  | 'clinical.scribe'       // nurse scribe: active visits list, record visit observations
  | 'patients.manage'       // add/edit patient records (never ADMIN)
  | 'queue.reception'       // reception queue page, add-to-queue, today board
  | 'queue.doctor'          // personal doctor queue ("my patients")
  | 'billing.collect'       // billing pages, payment queue, record payments
  | 'billing.visit'         // price the bill for the patient in the chair, at the chair
  | 'money.aggregate'       // any earnings/revenue total spanning more than one bill
  | 'reminders.send'        // SMS/WhatsApp reminder dashboard + send API
  | 'settings.admin'        // clinic profile, branches, staff, fee schedule
  | 'finance.admin'         // clinic-wide finance: ledger, expenses, debtors, overrides, profit
  | 'kpi.admin'             // practice KPI dashboard (per-doctor performance)
  | 'audit.view'            // audit log viewer
  | 'slots.manage'          // online booking slot settings
  | 'inventory.adjust'      // stock updates, stock-take (never doctors)

const PERMISSIONS: Record<Permission, string[]> = {
  // v2 rules: ADMIN has NO clinical functions; HEAD_NURSE = nurse + receptionist
  'clinical.visit':      ['DOCTOR'],
  'clinical.diagnosis':  ['NURSE', 'HEAD_NURSE'],
  'clinical.scribe':     ['DOCTOR', 'NURSE', 'HEAD_NURSE'],
  'patients.manage':     ['DOCTOR', 'NURSE', 'HEAD_NURSE', 'RECEPTIONIST'],
  'queue.reception':     ['RECEPTIONIST', 'HEAD_NURSE'],
  'queue.doctor':        ['DOCTOR'],
  // Doctors price the bill for the patient in front of them (billing.visit) but
  // never see a total spanning more than that one bill (money.aggregate).
  'billing.collect':     ['HEAD_NURSE'],
  'billing.visit':       ['DOCTOR', 'HEAD_NURSE'],
  'money.aggregate':     ['ADMIN'],
  'reminders.send':      ['ADMIN', 'HEAD_NURSE'],
  'settings.admin':      ['ADMIN'],
  'finance.admin':       ['ADMIN'],
  'kpi.admin':           ['ADMIN'],
  'audit.view':          ['ADMIN'],
  'slots.manage':        ['ADMIN', 'DOCTOR'],
  'inventory.adjust':    ['ADMIN', 'NURSE', 'HEAD_NURSE', 'RECEPTIONIST'],
}

export function can(role: string, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role)
}

// Roles that personally treat patients (own a doctor queue / provider filter).
// Use DOCTOR_ROLES in Prisma `role: { in: ... }` queries.
export const DOCTOR_ROLES = ['DOCTOR'] as const

export function isDoctorRole(role: string): boolean {
  return (DOCTOR_ROLES as readonly string[]).includes(role)
}

// Front-desk roles (reception dashboard view)
export function isReceptionRole(role: string): boolean {
  return ['RECEPTIONIST', 'HEAD_NURSE'].includes(role)
}

// SMTP sender + email templates. Mirrors the shape of lib/sms.ts: never
// throws, returns a result object, and degrades to a warning when the
// mailbox isn't configured so a missing password can't block a booking.
//
// NOTE: an identical copy lives in the website project (lumora-website/
// src/lib/email.ts). The two apps are separate Next installs that share only
// the database, so the template is duplicated rather than imported. Change
// both together.
import nodemailer, { type Transporter } from 'nodemailer'

interface SendResult { success: boolean; error?: string; skipped?: boolean }

// Reused across requests — creating a transporter per email would open a new
// SMTP connection every time and quickly hit Gmail's rate limits.
let cachedTransporter: Transporter | null = null

// Patient-facing email is OFF unless explicitly switched on, independently of
// whether credentials happen to be present. Configuring SMTP must not, on its
// own, start sending mail to patients — enabling that is a deliberate decision
// by the clinic owner, not a side effect of filling in a .env file.
// Kept identical to dental-pms/src/lib/email.ts — change both together.
function patientEmailEnabled(): boolean {
  return process.env.PATIENT_EMAIL_ENABLED === 'true'
}

function getTransporter(): Transporter | null {
  if (!patientEmailEnabled()) return null

  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) return null

  if (!cachedTransporter) {
    const port = Number(process.env.SMTP_PORT ?? 465)
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port,
      secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
      auth: { user, pass },
    })
  }
  return cachedTransporter
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendResult> {
  const transporter = getTransporter()
  if (!transporter) {
    // Distinguish the two reasons so the logs say which lock is holding.
    const reason = !patientEmailEnabled()
      ? 'PATIENT_EMAIL_ENABLED is not "true" — patient email is switched off'
      : 'SMTP credentials not configured'
    console.warn(`[EMAIL] ${reason} — email skipped`)
    return { success: false, skipped: true, error: reason }
  }

  const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME ?? 'Lumora Dental Studio'
  const from = process.env.SMTP_FROM ?? `"${clinicName}" <${process.env.SMTP_USER}>`

  try {
    await transporter.sendMail({ from, ...params })
    return { success: true }
  } catch (e: any) {
    console.error('[EMAIL] send failed:', e?.message ?? e)
    return { success: false, error: e?.message ?? 'Email send failed' }
  }
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

export interface AppointmentEmailData {
  patientName: string
  appointmentNumber: string
  doctorName: string
  branchName: string
  branchAddress?: string | null
  branchPhone?: string | null
  startTime: Date
  reason?: string | null
}

// Appointment times are built with setHours() in the SERVER's local timezone
// (see the booking routes), so the stored instant only means "4:30 pm" when
// read back in that same zone. Formatting here defaults to server-local for
// exactly that reason — it guarantees the email shows the slot the patient
// picked. Deployments should also run with TZ=Asia/Colombo so server-local
// *is* clinic time; CLINIC_TIMEZONE can pin the display zone independently.
const TIME_ZONE = process.env.CLINIC_TIMEZONE || undefined

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE,
  }).format(date)
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TIME_ZONE,
  }).format(date)
}

// Escaped because patient-supplied names and reasons land in the HTML body.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function appointmentConfirmationEmail(data: AppointmentEmailData) {
  const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME ?? 'Lumora Dental Studio'
  const date = formatDate(data.startTime)
  const time = formatTime(data.startTime)
  const contactPhone = data.branchPhone ?? process.env.NEXT_PUBLIC_CLINIC_PHONE ?? ''

  const subject = `Appointment confirmed — ${date} at ${time}`

  const rows: [string, string][] = [
    ['Reference', data.appointmentNumber],
    ['Date', date],
    ['Time', time],
    ['Dentist', data.doctorName],
    ['Branch', data.branchName],
  ]
  if (data.branchAddress) rows.push(['Address', data.branchAddress])
  if (data.reason) rows.push(['Reason', data.reason])

  const text = [
    `Dear ${data.patientName},`,
    ``,
    `Your appointment at ${clinicName} is confirmed.`,
    ``,
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ``,
    `Please arrive 10 minutes early. If you need to reschedule or cancel,`,
    contactPhone ? `call us on ${contactPhone}.` : `please contact the clinic.`,
    ``,
    `We look forward to seeing you.`,
    `${clinicName}`,
  ].join('\n')

  // Table-based layout with inline styles: the lowest common denominator that
  // survives Gmail, Outlook and Apple Mail without a stylesheet.
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f3f8ff;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1d3557;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr><td style="background:#2f6fee;padding:20px 28px;">
      <h1 style="margin:0;font-size:19px;color:#ffffff;font-weight:600;">${escapeHtml(clinicName)}</h1>
    </td></tr>
    <tr><td style="padding:28px;">
      <p style="margin:0 0 6px;font-size:16px;">Dear ${escapeHtml(data.patientName)},</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#5c6f8e;">
        Your appointment is <strong style="color:#1d3557;">confirmed</strong>. Here are the details:
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:15px;">
        ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:7px 0;color:#98a7c0;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:7px 0;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`).join('')}
      </table>
      <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#5c6f8e;">
        Please arrive 10 minutes early. To reschedule or cancel${contactPhone ? `, call us on <strong style="color:#1d3557;">${escapeHtml(contactPhone)}</strong>` : ', please contact the clinic'}.
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f3f8ff;font-size:12px;color:#98a7c0;">
      This is an automated confirmation from ${escapeHtml(clinicName)}.
    </td></tr>
  </table>
</body></html>`

  return { subject, html, text }
}

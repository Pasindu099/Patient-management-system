// Notify.lk SMS + WhatsApp senders and bilingual message templates.
// Extracted from api/reminders so other features (low-stock alerts,
// scheduled day-before reminders) can reuse the same senders.

// ─── MESSAGE TEMPLATES ────────────────────────────────────────────────────────
export const TEMPLATES = {
  appointment_24h: {
    en: (name: string, date: string, time: string, clinic: string) =>
      `Dear ${name}, reminder: your dental appointment is tomorrow (${date}) at ${time} at ${clinic}. Reply STOP to opt out.`,
    si: (name: string, date: string, time: string, clinic: string) =>
      `ආයුබෝවන් ${name}, ඔබගේ දන්ත චිකිත්සා හමුව හෙට (${date}) ${time} ට ${clinic} හි ඇත. ස්තූතියි.`,
  },
  appointment_2h: {
    en: (name: string, time: string, clinic: string) =>
      `Reminder: Your dental appointment is in 2 hours at ${time} at ${clinic}. See you soon!`,
    si: (name: string, time: string, clinic: string) =>
      `ඔබගේ දන්ත හමුව පැය 2කින් ${time} ට ${clinic} හි ඇත. ස්තූතියි!`,
  },
  recall_due: {
    en: (name: string, clinic: string) =>
      `Dear ${name}, it's time for your routine dental check-up at ${clinic}. Please call us to book your appointment.`,
    si: (name: string, clinic: string) =>
      `ආයුබෝවන් ${name}, ඔබගේ නිතිපතා දන්ත පරීක්ෂාවට කාලය පැමිණ ඇත. ${clinic} හි හමුවක් වෙන් කර ගන්න.`,
  },
  invoice_due: {
    en: (name: string, amount: string, clinic: string) =>
      `Dear ${name}, your invoice of ${amount} at ${clinic} is due. Please contact us to arrange payment.`,
    si: (name: string, amount: string, clinic: string) =>
      `ආයුබෝවන් ${name}, ${clinic} හි ඔබගේ ${amount} ගෙවීම් ඉල්ලුම් කිරීම. කරුණාකර අප හා සම්බන්ධ වන්න.`,
  },
}

// ─── NOTIFY.LK SMS ────────────────────────────────────────────────────────────
export async function sendSMS(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  const apiKey    = process.env.NOTIFY_LK_API_KEY
  const userId    = process.env.NOTIFY_LK_USER_ID
  const senderId  = process.env.NOTIFY_LK_SENDER_ID ?? 'DentalCare'

  if (!apiKey || !userId) {
    console.warn('[SMS] Notify.lk credentials not configured — SMS skipped')
    return { success: false, error: 'SMS not configured' }
  }

  try {
    const params = new URLSearchParams({
      user_id:   userId,
      api_key:   apiKey,
      sender_id: senderId,
      to:        phone.replace(/\D/g, ''),
      message,
    })

    const res = await fetch(`https://app.notify.lk/api/v1/send?${params}`, { method: 'GET' })
    const json = await res.json()

    if (json.status === 'success') return { success: true }
    return { success: false, error: json.message ?? 'SMS send failed' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ─── WHATSAPP ─────────────────────────────────────────────────────────────────
export async function sendWhatsApp(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  const token   = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID

  if (!token || !phoneId) {
    console.warn('[WhatsApp] Credentials not configured — WhatsApp skipped')
    return { success: false, error: 'WhatsApp not configured' }
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messaging_product: 'whatsapp',
          to:      phone.replace(/\D/g, ''),
          type:    'text',
          text:    { body: message },
        }),
      }
    )
    const json = await res.json()
    if (json.messages?.[0]?.id) return { success: true }
    return { success: false, error: json.error?.message ?? 'WhatsApp send failed' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

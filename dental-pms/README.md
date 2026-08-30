# DentalCare PMS — Sri Lanka Edition

A complete dental practice management system built for Sri Lankan clinics.
Simple. Fast. Designed for doctors aged 50+.

---

## Quick Start

```bash
npm install
npm run db:up        # Start PostgreSQL (Docker required)
npm run db:push      # Create database tables
npm run db:seed      # Load demo data
npm run dev          # Start the app
```

Open: **http://localhost:3000**

---

## Login Credentials

Password for all accounts: **DentalPMS2024!**

| Role           | Email                        |
|----------------|------------------------------|
| Admin          | admin@dentalcare.lk          |
| Dr. Perera     | dr.perera@dentalcare.lk      |
| Dr. Silva      | dr.silva@dentalcare.lk       |
| Hygienist      | hygiene@dentalcare.lk        |
| Clinic Manager | manager@dentalcare.lk        |
| Receptionist   | reception@dentalcare.lk      |

---

## The Real Workflow

### How a patient visit works:

1. **Patient walks in** → Receptionist/doctor searches for them in **Start Visit**
2. **Doctor opens visit** → Sees the **last visit summary at the top** (what was done, plan for today)
3. **Step 1 — Examination** → Chief complaint, findings, diagnosis
4. **Step 2 — Treatment** → What was done today, price per procedure, plan for next visit
5. **Step 3 — Prescription** → Select drugs from dropdown (common dental medicines pre-loaded)
6. **Step 4 — Bill** → Choose: Full payment / Installments / Waive
7. **Complete visit** → Patient appears in **Payment Queue** for receptionist
8. **Print** → Bill and prescription print in one click

### Installment billing:
- Doctor sets: total amount + number of visits
- System calculates amount per visit automatically
- Each follow-up visit: receptionist clicks "Pay installment" → done

### Waive / discount:
- Type the waive amount, or click "Waive full amount"
- Reason saved in notes

---

## Roles & Access

| Role           | Can do                                                    |
|----------------|-----------------------------------------------------------|
| Admin          | Everything + reports + settings + commission view         |
| Dentist        | Start visits, clinical, prescriptions, their own stats    |
| Hygienist      | Start visits, clinical notes                              |
| Clinic Manager | Register patients, payment queue, billing                 |
| Receptionist   | Register patients, payment queue, appointments, reminders |
| Nurse          | Clinical support, visit notes                             |

---

## Key Features

| Module          | What it does                                                      |
|-----------------|-------------------------------------------------------------------|
| Start Visit     | 4-step flow: Exam → Treatment → Prescription → Bill               |
| Patient List    | Full row clickable, hover shows "Start Visit" button              |
| Patient Profile | Last visit summary shown first, allergy alert in red              |
| Payment Queue   | Live view of patients ready to pay, installment recording         |
| Dashboard       | Doctor sees own stats; Admin sees full clinic stats               |
| Tooth Chart     | FDI numbering, click to select/deselect, 12 conditions            |
| Billing         | LKR/USD, cash/card/bank/insurance, installment plans              |
| Prescriptions   | Pre-loaded dental drugs, printable with doctor signature          |
| Reports         | Revenue, appointments, branch comparison, AR aging, CSV export    |
| Reminders       | SMS (Notify.lk) + WhatsApp in Sinhala or English                 |
| Transcription   | Whisper (Sinhala/English) + Claude AI summary                     |
| Settings        | Branches, staff, fee schedule, clinic profile                     |

---

## Sri Lanka Specifics

- **NIC** — old (9+V) and new (12-digit) both validated
- **No EDI** — insurance via manual letter-of-guarantee (AIA, Ceylinco, Union)
- **LKR + USD** — dual currency throughout
- **FDI tooth numbering** — used throughout Sri Lanka
- **Sinhala templates** — SMS/WhatsApp reminders in patient's language
- **Notify.lk** — Mobitel/Dialog SMS gateway
- **PDPA** — Sri Lanka data protection (simpler than GDPR)

---

## API Keys (for AI features)

Add to `.env.local`:

```env
OPENAI_API_KEY=""                 # Whisper transcription
ANTHROPIC_API_KEY=""              # Claude AI summaries
NOTIFY_LK_API_KEY=""              # SMS reminders
NOTIFY_LK_USER_ID=""
WHATSAPP_TOKEN=""                 # WhatsApp reminders
WHATSAPP_PHONE_ID=""
```

---

## Tech Stack

Next.js 14 · TypeScript · Tailwind CSS · PostgreSQL · Prisma · NextAuth · Chart.js · Docker

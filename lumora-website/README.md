# Lumora Dental Studio — Website

Patient-facing website for Lumora Dental Studio with online appointment booking.

## Setup

```bash
npm install          # Install dependencies (also runs prisma generate)
npm run dev          # Start on http://localhost:3001
```

## Requirements

- The dental-pms system must be running and its database accessible
- Uses the **same PostgreSQL database** as the PMS — no separate DB needed
- DATABASE_URL in .env.local must match the PMS .env

## .env.local

```env
DATABASE_URL="postgresql://dental_admin:change-me-local-only@localhost:5433/dental_pms"
NEXT_PUBLIC_SITE_URL="http://localhost:3001"
NEXT_PUBLIC_CLINIC_NAME="Lumora Dental Studio"
NEXT_PUBLIC_CLINIC_PHONE="0761662434"
NEXT_PUBLIC_CLINIC_EMAIL="lumoradentalstudio@gmail.com"
NEXT_PUBLIC_CLINIC_ADDRESS="151/B Negambo Road, Minuwangoda"
```

## How online booking slots work

1. In the PMS, go to **Settings → Online Booking Slots**
2. Select a doctor and click the time slots you want to open for online booking
3. Those slots appear on the website's booking page
4. When a patient books, the appointment is created directly in the PMS
5. Receptionist/doctor sees it in the Appointments calendar

## To go live

1. Deploy the website to Vercel / Netlify / your hosting
2. Update DATABASE_URL to point to your production database
3. Update NEXT_PUBLIC_CLINIC_* variables with real info
4. Replace gallery placeholder boxes with real photos
5. Update doctor names/bios in src/app/page.tsx
6. Embed real Google Maps iframe in the contact section

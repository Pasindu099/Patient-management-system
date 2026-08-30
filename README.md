# Lumora Dental Patient Management System

Full-stack dental clinic management project for Lumora Dental Studio. The repository contains an internal patient management system and a public-facing booking website that share the same PostgreSQL database.

## Project Structure

```text
.
├── dental-pms/        # Internal PMS dashboard for clinic staff
├── lumora-website/    # Public marketing and online booking website
├── deploy/            # Production Docker Compose and Caddy config
├── logo/              # Brand logo assets
└── DEPLOY.md          # Production deployment guide
```

## Applications

### Dental PMS

The internal dashboard handles patient records, appointments, queue management, visits, billing, prescriptions, inventory, staff settings, reports, reminders, and AI-assisted clinical workflows.



### Lumora Website

The public website presents Lumora Dental Studio and allows patients to book appointments. Booking data is written directly to the shared PMS database.


## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- NextAuth
- Docker

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop
- Git

## Quick Start

Start the PMS first because it owns the database schema.

```bash
cd dental-pms
npm install
cp .env.example .env.local
npm run db:up
npm run db:push
npm run db:seed
npm run dev
```

In a second terminal, start the public website.

```bash
cd lumora-website
npm install
cp .env.example .env.local
npm run dev
```

## Environment Variables

Use the committed example files as templates:

- `dental-pms/.env.example`
- `lumora-website/.env.example`
- `deploy/.env.production.example`

Never commit filled-in `.env`, `.env.local`, or production secret files. Generate strong values for production secrets such as `NEXTAUTH_SECRET`, database passwords, API keys, SMTP passwords, and WhatsApp/SMS tokens.

## Deployment

See `DEPLOY.md` for the production setup. The `deploy/` folder includes Docker Compose and Caddy configuration for running the PMS, public website, PostgreSQL, Redis, and HTTPS routing.

## Security Notes

- Real environment files are ignored by Git.
- Local logs, build outputs, dependency folders, archives, and temporary deployment bundles are ignored.
- Prisma migrations are committed because production deployments need them.
- Replace demo credentials immediately before using this system with real patient or clinic data.
- Keep production API keys and service credentials only in your deployment environment, not in source control.

## Repository

GitHub: <https://github.com/Pasindu099/Patient-management-system>

# Pro Club Order Portal

A web app for sales teams managing pro club clients. Upload order PDFs, apply CSV status updates, and export weekly Excel/CSV reports. Clients can log in to view their own orders.

## Features

- **Admin dashboard** — order counts by status, recent imports, overdue deliveries
- **Client management** — create pro club accounts and portal users
- **PDF import** — bulk upload, template-based parsing, review before save, duplicate detection
- **CSV update import** — column mapping, order-number matching, unmatched report download
- **Excel/CSV export** — per-client reports with optional "Changes This Week" sheet
- **Client portal** — clients view their orders, status history, and self-serve downloads
- **Scheduled exports** — configure weekly export schedules (email requires SMTP in production)

## Quick Start

```bash
cd C:\Users\danoe\Projects\pro-club-order-portal
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Logins

| Role   | Email                   | Password  |
|--------|-------------------------|-----------|
| Admin  | admin@portal.local      | admin123  |
| Client | riverside@portal.local  | client123 |
| Client | summit@portal.local     | client123 |

## Environment

Copy `.env.example` to `.env`:

```
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="change-me-to-a-random-secret-in-production"
UPLOAD_DIR="./uploads"
```

For production, switch `DATABASE_URL` to PostgreSQL (Supabase/Neon) and set a strong `NEXTAUTH_SECRET`.

## Workflow

1. **Create clients** — Admin → Clients
2. **Upload PDFs** — Admin → PDF Import (select client, upload one or many PDFs, review, confirm)
3. **Apply CSV updates** — Admin → CSV Update (map columns, apply status/delivery updates)
4. **Export weekly report** — Admin → Export (choose client, date filters, download .xlsx or .csv)
5. **Client self-service** — Clients log in at `/portal` to view orders and download reports

## PDF Parser

The parser uses regex templates for common order PDF layouts. When you share a sample PDF from your jobs system, the parser template in `src/lib/pdf-parser.ts` can be tuned for your exact format.

If a PDF is scanned/image-based, the review screen lets you add or edit rows manually before import.

## Scheduled Exports

Configure per-client schedules in Admin → Settings. Trigger a dry-run via the test button, or call:

```bash
curl -X POST http://localhost:3000/api/cron/weekly-export -H "Content-Type: application/json" -d "{\"dryRun\": true}"
```

For production email delivery, add SMTP configuration and wire it into `src/app/api/cron/weekly-export/route.ts`.

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Prisma + SQLite (dev) / PostgreSQL (production)
- NextAuth (credentials)
- pdf-parse, papaparse, exceljs

## Project Structure

```
src/
  app/
    admin/          # Admin pages
    portal/         # Client portal
    api/            # REST API routes
  components/       # Shared UI
  lib/              # Auth, parsers, export, utilities
prisma/
  schema.prisma     # Data model
  seed.ts           # Demo data
uploads/            # Stored PDF/CSV files
```

# Ledger.

A personal budget tracker built for you and you alone. Modern, mobile-first PWA.

## What's in v1

- CSV import from any bank (column-mappable, dedupes on re-import)
- Accounts (checking, savings, HYS, credit, brokerage, Roth IRA, 401k, HSA, loan)
- Categories with monthly limits and a `need / want / savings` classification
- Auto-categorization rules — "always categorize STARBUCKS as Coffee"
- Recurring detection — Netflix, rent, anything monthly+steady gets flagged
- Dashboard with need/want/savings split + per-category progress bars
- Year view — Category × Month grid mirroring the spreadsheet
- Net worth (assets − debts)
- Single-password lock
- PWA — install to iPhone home screen

## Quick start

```bash
npm install
cp .env.example .env       # edit APP_PASSWORD
npm run db:push            # creates local.db (SQLite)
npm run db:seed            # inserts default categories
npm run dev
```

Visit http://localhost:3000 — log in with whatever you set as `APP_PASSWORD`.

## Tech

- Next.js 16 (App Router) + React 19
- libSQL/SQLite (local file in dev; Turso for production)
- Drizzle ORM
- Tailwind v4
- Instrument Serif (display) + Geist Sans (body) + Geist Mono (numbers)

## Deploying to Vercel

1. **Database — Turso (free):**
   - `brew install tursodatabase/tap/turso`
   - `turso db create ledger`
   - `turso db show ledger --url` → set as `DATABASE_URL`
   - `turso db tokens create ledger` → set as `DATABASE_AUTH_TOKEN`
   - Push the schema once: `npm run db:push`
   - Seed once: `npm run db:seed`
2. **Vercel:**
   - `vercel` → connect this repo
   - Set env vars: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `APP_PASSWORD`
3. Visit `/dashboard` — add to home screen on iPhone via Safari share menu.

## v2 ideas (designed for, not yet built)

- Teller integration for automatic bank sync (free for personal use)
- Split transactions
- Savings goals
- Spend-pace forecasting
- Receipt attachments
- Charts: monthly trends, merchant leaderboard

## Useful scripts

```bash
npm run dev           # next dev
npm run build         # next build
npm run db:push       # apply schema changes to DB
npm run db:seed       # seed default categories (idempotent)
npm run db:studio     # drizzle visual db browser
```

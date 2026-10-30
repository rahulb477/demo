# Orbit POS

A self-hosted point-of-sale, inventory and reporting system. Next.js 16 (App Router) + TypeScript,
Drizzle ORM, SQLite/libSQL for local dev, PostgreSQL-ready.

> **Provenance note:** this is an **original implementation** built from a written feature brief.
> The external reference application was unreachable from the build environment, so no screen,
> workflow or asset here was copied or observed. See `docs/hyper-pos/00-observation-status.md`
> and `docs/feature-matrix.md` for exactly what is verified.

---

## Quick start

```bash
npm install
cp .env.example .env          # then edit AUTH_SECRET
npx drizzle-kit push          # create schema
npm run db:seed               # demo data: 20 products, 14 days of sales
npm run dev                   # http://localhost:3000
```

Seeded accounts (change `SEED_*` in `.env` before seeding for anything non-local):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@orbitpos.local` | `Admin#12345` |
| Cashier | `cashier@orbitpos.local` | `Cashier#12345` |

Production:

```bash
npm run build && npm start
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | `file:./data/orbit.db` for SQLite; `libsql://…` for Turso |
| `DATABASE_AUTH_TOKEN` | for Turso | libSQL auth token |
| `AUTH_SECRET` | yes | HS256 session signing key, **≥ 16 chars**. `openssl rand -base64 48` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | seeding | Admin credentials |
| `SEED_CASHIER_EMAIL` / `SEED_CASHIER_PASSWORD` | seeding | Cashier credentials |

Never commit `.env`. It is gitignored, along with `*.db` and `data/backups/`.

## Architecture

```
src/
  app/(app)/…          authenticated pages (dashboard, pos, products, inventory, sales, …)
  app/api/…            JSON APIs (products, sales, inventory, customers, export, import, backup)
  app/login/           public sign-in
  components/          Shell (nav/theme) + dependency-free SVG charts
  db/schema.ts         36-table domain schema
  db/seed.ts           deterministic dev seed (refuses to wipe a non-empty DB unless FORCE=1)
  lib/money.ts         integer-minor-unit arithmetic (no floats)
  lib/rbac.ts          permission catalogue + role presets
  lib/api.ts           auth guard, error envelope, activity log, document numbering
  middleware.ts        JWT gate for every non-public route
```

### Money

All amounts are **integer minor units** (cents/paise). `computeLine` / `computeCart` in
`lib/money.ts` are the single source of truth for line totals, order-level discount distribution and
tax. Floats never touch money.

### Stock

`stock` holds current on-hand quantity with a unique index on
`(product_id, variant_id, location_id)`. Every change writes an append-only `stock_movements` row.
Sales decrement with a guarded `UPDATE … WHERE quantity >= ?` inside a transaction; a zero-row
update means insufficient stock, which aborts the whole sale.

### Offline & idempotency

Every sale carries a client-generated `client_uuid` with a **unique index**. A retried checkout
returns the original sale instead of charging twice. The POS keeps an unsent payload in
`localStorage` when the network fails and drains that queue on reconnect.

## Exports

All exports are generated server-side from the database — no placeholder files.

| Endpoint | Formats | Entities |
|---|---|---|
| `/api/export/{entity}?format=csv\|xlsx` | CSV, XLSX | `products`, `sales`, `customers`, `suppliers`, `inventory`, `movements`, `expenses`, `payments` |
| `/api/sales/{id}/invoice` | PDF | A4 invoice, generated with PDFKit |
| `/api/backup` | JSON | all 36 tables + SHA-256 in `X-Backup-Checksum` |

XLSX files use ExcelJS with a styled, filterable header row.

## Import

`POST /api/import/products` (multipart: `file`, `mode=preview|commit`).

Required columns: `name`, `sku`, `selling_price`.
Optional: `barcode`, `category`, `purchase_price`, `tax_rate`, `opening_stock`.

Preview validates every row with Zod, reports row-level errors, flags duplicate SKUs inside the file
**and** against the database, and inserts nothing. Commit skips existing SKUs rather than
overwriting them, and records the run in `import_jobs`.

## Roles

| Role | Scope |
|---|---|
| Admin | all permissions |
| Manager | operations; no `users.write`, `settings.write`, `backup.run` |
| Cashier | dashboard, products read, sales, customers, quotations read, cash |

Permissions are embedded in the signed session and re-checked server-side on every API call — the UI
is never the only gate.

## Testing performed

Verified against a running production build (`next build` + `next start`):

- login → session cookie; unauthenticated API → `401`
- sale of 3× Cola + 2× Chips → invoice `INV-2026-0029`, subtotal 500, tax 35, total 535
- stock 67 → 64; identical replay → same sale id, stock unchanged, sales count unchanged
- 99,999-unit sale → `409 Insufficient stock`
- invoice PDF → `%PDF-`, 1,993 bytes
- products CSV → 20 data rows; sales XLSX → 8,246-byte zip
- import 4 rows → 2 valid, 2 rejected (bad number, dup SKU) in preview; 2 inserted on commit
- backup → 36 tables, sales rows present, SHA-256 header

## Not built yet

Restore-from-backup, cash-register session close/reconcile, purchase & quotation creation,
expense/income UI, weight-based line entry, customer display, PDF statements. See
`docs/feature-matrix.md` for the row-by-row status.

## PostgreSQL

The data layer is Drizzle with a libSQL driver. To move to Postgres: add `drizzle-orm/node-postgres`
+ `pg`, switch the schema imports from `sqlite-core` to `pg-core` (types map ~1:1), point
`DATABASE_URL` at Postgres, and run `drizzle-kit generate` against a `postgresql` dialect config.
SQLite was used here because no Postgres server binary exists in this environment; the Postgres path
is documented but **not runtime-verified**.

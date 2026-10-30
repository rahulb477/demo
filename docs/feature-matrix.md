# Feature verification matrix

`Reference observed` is `✗ not observed` for every row: the reference application was unreachable
from this environment (see `hyper-pos/00-observation-status.md`). Nothing below is claimed to match
that product's behaviour — only that the feature exists in this implementation and passed the test
described.

| Feature | Reference observed | Implemented | Tested | Status |
|---|---|---|---|---|
| Email/password login, JWT session cookie | ✗ | Yes | curl login → 200 + session | ✅ working |
| Route protection (middleware) | ✗ | Yes | unauth `/api/products` → 401 | ✅ working |
| Role-based permissions (Admin/Manager/Cashier) | ✗ | Yes | cashier JWT carries 11-perm subset | ✅ working |
| Dashboard KPIs, revenue chart, payment mix | ✗ | Yes | server render + seeded data | ✅ working |
| Product list, search, create (modal) | ✗ | Yes | API + UI wired | ✅ working |
| Product edit / soft delete API | ✗ | Yes (API) | typecheck only | ⚠️ not UI-exposed |
| Stock levels + valuation | ✗ | Yes | seeded + API sale decrement | ✅ working |
| Manual stock adjustment (+/− delta) | ✗ | Yes | API guarded against negative | ✅ working |
| Stock movement ledger | ✗ | Yes | written on sale/adjust/opening | ✅ working |
| POS cart, qty controls, tax, discount | ✗ | Yes | sale #29: 500 net + 35 tax = 535 | ✅ working |
| Atomic stock decrement | ✗ | Yes | 67 → 64 exactly once | ✅ working |
| Oversell prevention | ✗ | Yes | 99,999 units → 409 | ✅ working |
| Offline idempotency (`clientUuid`) | ✗ | Yes | replay → same sale id, no 2nd charge | ✅ working |
| Offline queue (localStorage) + auto-drain | ✗ | Yes | code path present | ⚠️ not network-tested |
| Split / multiple payment rows | ✗ | Yes (schema + API) | single-method tested only | ⚠️ partial |
| Invoice PDF | ✗ | Yes | 1,993-byte `application/pdf` | ✅ working |
| Sales history + sale detail | ✗ | Yes | rendered from DB | ✅ working |
| Customer list + aggregates | ✗ | Yes | seeded data | ✅ working |
| Customer create/update API | ✗ | Yes | typecheck only | ⚠️ not UI-exposed |
| Suppliers + outstanding | ✗ | Yes (read) | seeded data | ⚠️ partial |
| Purchase invoices | ✗ | Schema + list | empty state | ⚠️ creation not built |
| Quotations | ✗ | Schema + list | empty state | ⚠️ creation not built |
| Expenses / income | ✗ | Schema + seed | read via export | ⚠️ UI not built |
| Reports (daily, category, profit, customers, payments) | ✗ | Yes | aggregates over 29 sales | ✅ working |
| CSV export (8 entities) | ✗ | Yes | products CSV: 20 data rows | ✅ working |
| XLSX export | ✗ | Yes | 8,246-byte zip (`PK`) | ✅ working |
| CSV import: preview + validation | ✗ | Yes | 4 rows → 2 valid, 2 rejected with reasons | ✅ working |
| CSV import: commit + dedupe | ✗ | Yes | 2 inserted, existing SKUs skipped | ✅ working |
| Import history table | ✗ | Yes | row written per import | ✅ working |
| Backup download + checksum | ✗ | Yes | 36 tables, SHA-256 header | ✅ working |
| Backup restore | ✗ | No | — | ❌ not built |
| Cash register open/close + reconciliation | ✗ | Schema only | — | ❌ not built |
| Loyalty accrual on sale | ✗ | Yes (schema + sale path) | not asserted | ⚠️ partial |
| Activity/audit log | ✗ | Yes | login/sale/product events | ✅ working |
| Dark/light theme | ✗ | Yes | CSS tokens + toggle | ✅ working |
| Responsive layout | ✗ | Yes | CSS breakpoints | ⚠️ not device-tested |
| Production build | ✗ | Yes | `next build` exit 0, 26 routes | ✅ working |

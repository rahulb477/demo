# Reference observation status — BLOCKED

## Verdict

The reference application **`https://hyper-pos.eshopweb.store` was never observed** during this
build. Every document that requires observation of that site is therefore **not produced**.

## Evidence (measured 2026-10-30, from the Arena workspace)

| Probe | Result |
|---|---|
| DNS `hyper-pos.eshopweb.store` | resolves (`2a02:4780:…`, IPv6) |
| `curl -I https://hyper-pos.eshopweb.store` | `SSL_ERROR_SYSCALL` on :443, code `000` |
| `curl -I https://hyper-pos.eshopweb.store/login` | same TLS-level rejection |
| `curl -I https://github.com/` (control) | `200` |

The workspace network is an **allowlist** (`github.com`, `codeload.github.com`, `api.github.com`,
`registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`). DNS resolves, but the TLS handshake to
the reference host is dropped by the egress firewall.

REA cannot substitute for browser access here either: it analyses **local artifacts**, and its
`capture-browser-scenario` path needs a Chromium binary. This sandbox has **no browser binary and no
route to download one** (`cdn.playwright.dev`, `binaries.prisma.sh` and general internet are blocked).

## Consequence

The requested documents — `sitemap.md`, `admin-feature-inventory.md`, `cashier-feature-inventory.md`,
`ui-ux-analysis.md`, `workflow-analysis.md`, `export-analysis.md` — would be **invented**, not
observed. Writing them would make every downstream "tested" claim unfalsifiable, so they are
deliberately absent.

The product in this repository is an **original implementation** driven by the written feature brief
supplied by the product owner, not by the reference application. See
`../feature-matrix.md` for per-feature provenance.

## What unblocks it

Upload any of the following and the analysis becomes real:

1. **Page saves** — Chrome → *Save page as → Webpage, Complete*, one file per screen, named
   `admin-dashboard.html`, `admin-products.html`, … (repeat for the cashier account).
2. **Screenshots** of each module, modals opened.
3. **HAR** (DevTools → Network → preserve log → save all as HAR). Strip `Cookie` and
   `Authorization` before upload.
4. **Real artifacts** — one CSV, one XLSX, one invoice PDF, one quotation PDF, one backup file.
5. **JS bundles** from the saved page folders, for genuine REA `analyze-javascript-application`.

# Production test report (2026-10-21)

GitHub `main` tip: **`95b9c49`** (includes deploy fixes, Playwright prod profile, demo fallbacks).

## Gate summary

| Gate | Result | RCA / next step |
|------|--------|-----------------|
| Preflight (`test:preflight`) | **FAIL** | Clone missing `STD-DEMO-001` — redeploy **bis-clone** with `seed-demo-records.mjs` in build |
| Smoke + `SMOKE_CHAT` | **FAIL** | Admin index still Git LFS pointer on running container — **redeploy bis-mitra-admin** after `git lfs pull` build |
| Playwright prod (18 tests) | **13 pass / 5 fail** | Chat cards fail until admin+clone redeploy; shell/personas/config refresh **pass** |
| Admin UI (browser) | **FAIL** | [bis-mitra-admin-ui.vercel.app](https://bis-mitra-admin-ui.vercel.app) shows “No clusters” — set **`REND_ADMIN_API`** on Vercel admin-ui and redeploy |
| `proof-actions-sandbox` suite | **SKIP** | Cluster not on prod volume — use **`mitra-knowledge`** only |

## User portal — section A (chrome)

| # | Result |
|---|--------|
| A1–A7 | **PASS** (Playwright prod: theme, language, nav, 8 personas, config refresh) |

## User portal — section B (agent / proof)

| Action | Result | Notes |
|--------|--------|-------|
| 1 Helmet compliance | **FAIL** | `/api/agent/chat` error until admin redeploy + clone demo seed |
| 4 FMCS checklist | **FAIL** | Same |
| 5 Lab matching | **FAIL** | Same |
| 6 CML verify | **FAIL** | Same |
| 2–3, 7–10 | **Not run** (blocked on chat stability) | Re-run after regate |

## Admin UI — section M

| # | Result | Notes |
|---|--------|-------|
| M1 | **FAIL** | Empty cluster list — Vercel **`REND_ADMIN_API`** likely missing at build |
| M2–M8 | **Blocked** | Fix M1 first; then health strip, publish, agent preview via Railway API |

## Fixes landed in repo (awaiting Railway/Vercel redeploy)

- Hosted publish guard, preflight `URL_*`, smoke gates (`c538f86`)
- LFS-safe index read + retrieve try/catch (`704582c`, `95b9c49`)
- Clone `seed-demo-records.mjs` + helmet probe fallback (`47f94d5`, `95b9c49`)
- Playwright prod config; **no unpublish on prod** teardown/setup (`global-teardown.mjs`, `portal-unpublished` skip)
- `npm run test:prod:gate` — [prod-regate.mjs](../bis-mitra-admin/scripts/prod-regate.mjs)
- GitHub Action: `.github/workflows/prod-smoke.yml` (manual)

## Operator regate (after redeploy)

```powershell
$env:ADMIN_API="https://bismitra-production.up.railway.app"
$env:CLONE_API="https://bis-clone-production.up.railway.app"
cd bis-mitra-admin
npm run test:prod:gate
cd ../bis-mitra-user
$env:PLAYWRIGHT_PROD="1"
npm run test:e2e:prod
```

See [DEPLOY_CONTEXT.md](DEPLOY_CONTEXT.md) for redeploy order.

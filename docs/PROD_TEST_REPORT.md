# Production test report

Last Phase 0 baseline: **2026-10-21** (USER_EVAL_PLAN §3).

## Phase 0 — Preflight snapshot (Railway prod)

| Check | Result | Notes |
|-------|--------|-------|
| Admin `GET /api/health` | **200** | `cloneApi` set |
| Clone `GET /api/health` | **200** | |
| `GET /api/portal/config` | **OK** | `publishedClusterId`: `mitra-knowledge`; `cloneFilesBase`: `…/files` (correct suffix) |
| `GET /api/transform/mitra-knowledge/status` | **OK** | golden **176**, chunks **3123**, live index promoted **2026-10-21** |
| Hosted RAG | **Mitigated in repo** | Golden scan fallback when index >32MB ([hosted-golden-search.js](../bis-mitra-admin/api/retrieval/hosted-golden-search.js)) — redeploy admin to apply |

**URLs used:**

- Admin: `https://bismitra-production.up.railway.app`
- Clone: `https://bis-clone-production.up.railway.app`
- User portal: `https://bis-mitra-user.vercel.app`

## Evaluation assets

- Runbook: [USER_EVAL_PLAN.md](USER_EVAL_PLAN.md)
- Golden Q&A: [eval/mitra-knowledge-golden-qa.json](eval/mitra-knowledge-golden-qa.json)
- Command: `cd bis-mitra-admin && npm run test:eval:knowledge`

## Gate summary (historical + next regate)

| Gate | Result | RCA / next step |
|------|--------|-----------------|
| Preflight (`test:preflight`) | Re-run after redeploy | Clone demo seed for proof actions |
| Smoke + `SMOKE_CHAT` | Re-run after admin redeploy | |
| Playwright prod | Re-run | `proof-actions-quick.spec.js`, `knowledge-smoke.spec.js` |
| Admin UI | Verify `REND_ADMIN_API` on Vercel admin-ui | |
| `proof-actions-sandbox` | **SKIP on prod** | Use `mitra-knowledge` + D-* prompts |

## Operator regate (after deploy)

```powershell
$env:ADMIN_API="https://bismitra-production.up.railway.app"
$env:CLONE_API="https://bis-clone-production.up.railway.app"
cd bis-mitra-admin
npm run test:prod:gate
npm run test:eval:knowledge
cd ../bis-mitra-user
$env:PLAYWRIGHT_PROD="1"
$env:ADMIN_API="https://bismitra-production.up.railway.app"
npm run test:e2e:prod
```

**Hosted auto-transform (optional):** set Railway `ENABLE_HOSTED_PIPELINE=1` on admin — runs stale warehouse transform without full scheduler.

See [DEPLOY_CONTEXT.md](DEPLOY_CONTEXT.md), [USER_EVAL_PLAN.md](USER_EVAL_PLAN.md).

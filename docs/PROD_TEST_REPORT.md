# Production test report

**Last full regate:** 2026-10-21  
**Git `main`:** `6787084` (after `3360c40` eval/RAG/PDF ship)

## Deploy status

| Target | Commit | State |
|--------|--------|--------|
| Railway **bis-clone** | `3360c40`+ | SUCCESS |
| Railway **bis admin api** | `3360c40` live (`0b114a70`); newer deploys may still BUILDING | Health OK |
| Vercel **bis-mitra-user** | `6787084` | READY |
| Vercel **bis-mitra-admin-ui** | `3360c40` | READY |

**Railway admin vars added:** `ENABLE_HOSTED_PIPELINE=1`, `HOSTED_PIPELINE_MS=60000`

## Automated gates (prod URLs)

| Gate | Result | Notes |
|------|--------|-------|
| Preflight | **PASS** | STD-DEMO-001, CML-DEMO-61003 |
| Portal config | **PASS** | `mitra-knowledge`, `cloneFilesBase` → `/files` |
| `test:proof:01` | **PASS** | Helmet compliance API |
| `SMOKE_CHAT` | **INTERMITTENT FAIL** | 502 / Groq 401 — see RCA below |
| Playwright knowledge (K-01, K-14) | **PASS** | Industry persona + hosted golden fallback |
| Playwright Action 1 (helmet card) | **PASS** | |
| Playwright Actions 4–6 | **FAIL** | Timeouts when chat API unhealthy |
| Playwright portal config/BIS | **PASS** | |
| `test:eval:knowledge` (local index) | **PASS** | 8/8 |

## RCA — chat / smoke failures

Railway **deploy logs** show:

```text
[llm] groq auth: 401 ... Invalid API Key
```

**Action:** In Railway → **bis admin api** → Variables, set a valid **`GROQ_API_KEY`** (and `LLM_PROVIDER=groq`). Redeploy admin. Do not commit keys to git.

Secondary: hosted index uses **golden scan fallback** (72MB index) — expected; log line is informational.

## Manual USER_EVAL spot checks

| Check | Result |
|-------|--------|
| `GET /api/pipeline/status?clusterId=mitra-knowledge` | **OK** — not stale, index ready |
| K-01 / K-14 via user portal (Playwright) | **PASS** after e2e persona fix |
| PDF path normalization | Shipped in `3360c40` — verify in UI after stable chat |

## Operator regate (after Groq key fixed)

```powershell
$env:ADMIN_API="https://bismitra-production.up.railway.app"
$env:CLONE_API="https://bis-clone-production.up.railway.app"
cd bis-mitra-admin
npm run test:prod:gate
npm run test:eval:knowledge
```

See [USER_EVAL_PLAN.md](USER_EVAL_PLAN.md), [DEPLOY_CONTEXT.md](DEPLOY_CONTEXT.md).

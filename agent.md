# BIS MITRA — Agent session context (deploy, fetch, chat)

Reference for Cursor agents and operators. Summarizes production deployment architecture, env wiring, and debugging from Oct 2026 sessions.

**Last updated:** 2026-10-20 (Railway deploy + prod parity, proof actions, cross-portal linking, git/`main` status).

---

## Architecture (who does what)

| Layer | Host | Role |
|-------|------|------|
| **5 frontends** | Vercel | Static Vite apps; env baked in at **build time** |
| **Admin API** | Railway (`bis-mitra-admin`) | Ingest, prefetch, agent chat, portal config, transforms |
| **Clone API** | Railway (`bis-clone`) | SQLite-backed REST (standards, news, documents, etc.) |

**Critical:** Vercel shared vars (`REND_*`, `URL_*`) tell **browsers** where to call APIs. They do **not** configure server-side fetch/ingest. **Railway admin** uses **`CLONE_API`**, **`URL_BIS`**, **`URL_MANAK`**, **`URL_STANDARDS`**, **`GROQ_API_KEY`**, etc.

Env reference files live in **`env/`** (per deployment):

| File | Use |
|------|-----|
| `env/vercel-shared-all-projects.env` | All 8 Vercel Production vars (canonical copy-paste) |
| `env/vercel-*.env` | Per-project subsets if not using team shared env |
| `env/railway-bis-mitra-admin-api.env` | Admin API service variables (+ secrets in dashboard only) |
| `env/railway-bis-clone-api.env` | Clone API service variables |

Root **`.env`** (gitignored) = **Vercel only** — same eight keys as `env/vercel-shared-all-projects.env`. **Do not** put Railway server vars (`CLONE_API`, `GROQ_API_KEY`, `BIS_WEB`, …) in root `.env`; those belong in `env/railway-*.env` / Railway dashboard.

---

## Vercel env (per project)

See `env/vercel-*.env`, `docs/vercel-env.example`, and `scripts/mitra-vercel-env.mjs`.

**What Vercel needs:** public HTTPS URLs only — no LLM keys, no `ADMIN_PASSWORD`, no Twilio/WhatsApp secrets.

**Build-time mapping:** Vercel vars `REND_*` / `URL_*` → injected as `import.meta.env.VITE_*` and admin `__MITRA_CONFIG__`. You do **not** need `VITE_*` or `ADMIN_*` on Vercel if the shared names below are set. Legacy fallbacks: `ADMIN_API_URL`, `ADMIN_USER_PORTAL_URL`, `ADMIN_BIS_URL`, etc. (see `pickEnv` in `mitra-vercel-env.mjs`). `URL_ADMIN_UI` is documented for operators; not read by `mitra-vercel-env.mjs` today.

### Shared Production values (current)

No trailing slashes. Point APIs at **Railway**, portals at **Vercel**.

```env
REND_ADMIN_API=https://bismitra-production.up.railway.app
REND_CLONE_API=https://bis-clone-production.up.railway.app
REND_CLONE_FILES=https://bis-clone-production.up.railway.app/files
URL_USER=https://bis-mitra-user.vercel.app
URL_ADMIN_UI=https://bis-mitra-admin-ui.vercel.app
URL_BIS=https://bis-clone-bis.vercel.app
URL_MANAK=https://bis-clone-manak.vercel.app
URL_STANDARDS=https://bis-clone-standards.vercel.app
```

| Variable | Value (production) |
|----------|-------------------|
| `REND_ADMIN_API` | `https://bismitra-production.up.railway.app` |
| `REND_CLONE_API` | `https://bis-clone-production.up.railway.app` |
| `REND_CLONE_FILES` | `https://bis-clone-production.up.railway.app/files` |
| `URL_USER` | `https://bis-mitra-user.vercel.app` |
| `URL_ADMIN_UI` | `https://bis-mitra-admin-ui.vercel.app` |
| `URL_BIS` | `https://bis-clone-bis.vercel.app` |
| `URL_MANAK` | `https://bis-clone-manak.vercel.app` |
| `URL_STANDARDS` | `https://bis-clone-standards.vercel.app` |

If admin UI shows “**ADMIN_API_URL is missing**”, Production env is empty or the app was not redeployed after setting vars (`bis-mitra-admin/frontend/src/App.jsx`).

| Project | Root directory | Main vars |
|---------|----------------|-----------|
| bis-mitra-admin-ui | `bis-mitra-admin/frontend` | `REND_ADMIN_API`, `REND_CLONE_API`, `URL_USER`, `URL_BIS`, `URL_MANAK` |
| bis-mitra-user | `bis-mitra-user` | `REND_ADMIN_API`, `REND_CLONE_API`, `REND_CLONE_FILES`, `URL_BIS`, `URL_MANAK` |
| bis-clone-bis | `bis-clone/apps/bis-web` | `REND_CLONE_API`, `URL_MANAK`, `URL_STANDARDS` |
| bis-clone-manak | `bis-clone/apps/manak-web` | `REND_CLONE_API`, `URL_BIS` |
| bis-clone-standards | `bis-clone/apps/standards-web` | `REND_CLONE_API`, `REND_CLONE_FILES`, `URL_BIS`, `URL_MANAK` |

**Redeploy each Vercel app** after changing env (values are injected at build, not runtime).

---

## Railway env

See `env/railway-bis-mitra-admin-api.env` and `env/railway-bis-clone-api.env`.

**Admin (minimum):**

- `CLONE_API` → live clone URL (e.g. `https://bis-clone-production.up.railway.app`)
- `URL_BIS`, `URL_MANAK`, `URL_STANDARDS` → Vercel clone portal URLs (health strip + Playwright)
- `GROQ_API_KEY`, `LLM_PROVIDER=groq`
- `DISABLE_ADMIN_AUTH=1` (optional; auto when `RAILWAY_ENVIRONMENT` is set)

**Build (Railpack):**

- `RAILPACK_PACKAGES=node@20` — **avoid Node 24** on admin (better-sqlite3 crashes on teardown)
- `RAILPACK_BUILD_APT_PACKAGES=... git-lfs git`

**Clone:**

- `MITRA_ADMIN_URL`, `CLONE_PUBLIC_URL`, `NODE_VERSION=20`

**Root Directory:** `bis-mitra-admin` or `bis-clone` — never monorepo root alone.

### Admin build command (must match `bis-mitra-admin/railway.toml`)

With Root Directory **`bis-mitra-admin`**, the build image **does not contain** `../bis-clone`. Do **not** use Render-style:

`cd ../bis-clone && … && cd ../bis-mitra-admin && …`

That fails with `sh: cd: can't cd to ../bis-clone` (exit 2).

**Correct admin build** (Railpack already runs `npm install` first):

```bash
npm rebuild better-sqlite3 -w api && node scripts/fetch-render-seed-lfs.mjs && node scripts/apply-render-seed.mjs
```

**Clone build** (`bis-clone/railway.toml`):

```bash
npm ci && npm rebuild better-sqlite3 -w api && cp data/bis-clone.seed.db data/bis-clone.db
```

**Single Railway service at monorepo root:** not recommended (no root `package.json`; two APIs need two `PORT`s). Use **two services** or empty root + custom Dockerfile.

### Static files on clone API

Clone serves assets at **`/files`**, not `/api/files`:

- Base: `https://<clone-host>/files`
- Vercel: `REND_CLONE_FILES=https://<clone-host>/files` (or omit — defaults to `{REND_CLONE_API}/files`)

REST JSON stays under **`/api/*`** (e.g. `/api/health`).

---

## Admin UI: health strip vs env

Labels **`Clone API :4000`**, **`BIS :3001`**, etc. are **hardcoded** in `bis-mitra-admin/frontend/src/components/common/HealthStrip.jsx`. They are **not** the configured URLs.

Real URLs come from **`GET /api/status`** on **Railway admin** (hover tooltip on each pill). Vercel env does **not** fix red pills — only **Railway admin** portal URL vars + **`CLONE_API`**.

---

## Fetch / prefetch (maintainer admin)

- Runs on **Railway admin**, not Vercel.
- **`POST /api/clusters/:id/prefetch`** runs all **ingest** plans for that cluster.
- Methods: **Clone API** (use on hosted), **Direct DB** (needs local `bis-clone.db` — not on Railway), **Playwright script** (needs `URL_BIS` / `URL_MANAK` / `URL_STANDARDS` reachable from Railway).

**Production issues observed:**

1. **`CLONE_API`** pointed at dead Render URL while Railway clone was live → API fetch failed preflight.
2. **`mitra-knowledge`** had **0 plans** after seed merge (seed `plans: []`) → prefetch did nothing. Fix: `ensurePlansForAllClusters()` in `api/store.js` on load.
3. Empty cluster **`test`** with 0 files → prefetch has nothing to fill; use **MITRA Knowledge** or create plans.

---

## User portal chat

- **`VITE_API_URL`** ← `REND_ADMIN_API` → `POST /api/agent/chat` on admin API.
- Requires a **published** cluster (`GET /api/portal/config` → `publishedClusterId` not null). Prefer **`proof-actions-sandbox`** or **MITRA Knowledge** for demo — not empty **`test`** only.
- Runtime overrides: `GET /api/portal/config` returns `bisWebUrl`, `manakWebUrl`, `cloneFilesBase` when Railway admin has `URL_BIS` / `URL_MANAK` and `CLONE_API` (see `api/clone-files-proxy.js`, `bis-mitra-user/src/portal/portalUrls.js`).

### Prod symptoms vs causes (Oct 2026)

| Symptom | Usually **not** | Usually **is** |
|---------|----------------|----------------|
| Long RAG answer + raw JSON, no compliance card | Missing Groq alone | Wrong/missing **`CLONE_API`** → no `search_standards` probe; wrong/unpublished cluster |
| **View doc** → `Cannot GET /api/clone-files/...` | User portal bug only | PDFs on **clone** `/files/...`; admin disk empty — use **`REND_CLONE_FILES`**, admin PDF proxy, or clone URL in `sourceToPdfUrl` |
| **Open on BIS** → `localhost:3001` | Groq | Missing **`URL_BIS`** at Vercel **build** and/or `bisWebUrl` null on portal config |
| Groq | — | Set **`GROQ_API_KEY`** + **`LLM_PROVIDER=groq`** on **Railway admin** only; affects LLM polish, not probe/compliance card |

**Groq:** Railway → **bis-mitra-admin** service → `GROQ_API_KEY`, `LLM_PROVIDER=groq`. Not on Vercel.

### Error: `Unexpected token 'v', "version ht"... is not valid JSON`

Usually **Git LFS pointer** content where JSON expected (e.g. `search-index.json` starts with `version https://git-lfs.github.com/spec/v1`). Build did not run **`git lfs pull`**.

### Error: CORS blocked on `/api/agent/chat`

Admin code uses `app.use(cors())`. Browser **CORS + ERR_FAILED** often means **no response from Node** (crash, 502, timeout) — not missing CORS config.

**Observed crash (Railway deploy logs):**

- Many `Warning: Indexing all PDF objects` (pdf.js/pdf-parse)
- `Aborted`, exit **134**, `better-sqlite3` assertion on `Statement` destructor
- Causes: **Node 24**, **OOM** loading large index/chunks, synchronous **catalog backfill** reading many PDFs on `getStore()`

**Fixes applied in repo:**

- Skip heavy catalog backfill on `RAILWAY_ENVIRONMENT` / `RENDER` (`api/store.js`)
- `apply-render-seed.mjs` fails build if seed index is LFS pointer
- `railway.toml`: `git lfs pull` without `|| true`
- Graceful `SIGTERM` → `closeSessionDb()` (`api/server.js`)
- Pin **Node 20** via `RAILPACK_PACKAGES=node@20`

**Preflight / env aliases:** `api/preflight.js`, `api/env.js` (`URL_BIS` → `BIS_URL` for Playwright).

---

## Render-seed + `mitra-knowledge` (agent without server transform)

Production admin **must not** run Full transform on large PDF sets (OOM on Render/Railway). Pre-built data ships in Git:

| Path | Role |
|------|------|
| `data/render-seed/admin-store.json` | Clusters + warehouse (packed demo: usually **only** `mitra-knowledge`, **published**) |
| `data/render-seed/uploads/mitra-knowledge/` | PDFs (~68 files in current MANIFEST) |
| `data/render-seed/indexes/mitra-knowledge/` | golden, chunks (~2793), `index/live/search-index.json` |

**Build:** `scripts/apply-render-seed.mjs` copies seed → live `data/admin-store.json`, `data/indexes/mitra-knowledge/`, `data/uploads/mitra-knowledge/`.

**Local refresh:** `npm run build:mitra-knowledge` → `npm run pack:render-seed` → commit + `git lfs push origin main --all`.

**Admin on Railway has no local `bis-clone.db`:** ingestion “Direct DB” and default `clone-db.js` paths need **`CLONE_API`** (HTTP) or optional **`CLONE_DB_PATH`**. Agent RAG on the knowledge cluster does **not** require clone DB on disk.

**Cluster behavior (2026-10-20):** Demo **read-only / secured** locks for `mitra-knowledge` were **removed**. Store **v16** migration sets `secured: false`, normal `deletable`/`renamable`. Transform unpublish/delete/clear/rebuild work like any other cluster. Seed still may ship **only** `mitra-knowledge` in `pack-render-seed` (deploy size), not other local clusters unless repacked.

---

## Git LFS + Railway build

LFS-tracked (see `.gitattributes`):

- `bis-mitra-admin/data/render-seed/uploads/**`
- `bis-mitra-admin/data/render-seed/indexes/**`

**Build command** (`bis-mitra-admin/railway.toml`):

```bash
npm rebuild better-sqlite3 -w api && node scripts/fetch-render-seed-lfs.mjs && node scripts/apply-render-seed.mjs
```

If the build snapshot lacks `.git`, **`fetch-render-seed-lfs.mjs`** shallow-clones the repo and pulls LFS for `render-seed` (see `bis-mitra-admin/railway.toml`).

Logs should show: `install apt packages: git git-lfs`, then LFS download lines, then `[apply:render-seed]`.

---

## Smoke checks

```powershell
Invoke-RestMethod https://bismitra-production.up.railway.app/api/health
Invoke-RestMethod https://bismitra-production.up.railway.app/api/portal/config
```

```bash
cd bis-mitra-admin
ADMIN_API=https://<admin>.up.railway.app CLONE_API=https://<clone>.up.railway.app node scripts/smoke-deploy.mjs
```

With chat + compliance panel + demo PDF:

```bash
SMOKE_CHAT=1 ADMIN_API=... CLONE_API=... node scripts/smoke-deploy.mjs
```

Expect `panel.compliance` with `IS DEMO 1001`, non-null `bisWebUrl` on portal config, `CLONE_API` matching Railway clone (not legacy Render).

Full proof gate: `npm run test:proof:all` from `bis-mitra-admin` (see `docs/PROOF_ACTIONS_RUNBOOK.md`).

---

## Cross-portal links (BIS ↔ eBIS ↔ Standards)

Clone **Vercel** apps use **`import.meta.env.VITE_*` baked at build**. Defaults are **`localhost:3001/3002/3003`** if env missing at build.

| App | Layout / links | Build vars (`mitra-vercel-env.mjs`) |
|-----|----------------|-------------------------------------|
| bis-clone-bis | `VITE_MANAK_URL`, `VITE_STANDARDS_URL` | `URL_MANAK`, `URL_STANDARDS` |
| bis-clone-manak | `VITE_BIS_URL` | `URL_BIS` |
| bis-clone-standards | `VITE_BIS_URL`, `VITE_MANAK_URL` | `URL_BIS`, `URL_MANAK` |

**Fix:** All eight Vercel shared vars set → **redeploy all five** frontends. “Know Your Standard” in bis-web uses `STANDARDS_URL` (root); deep link is `/know-your-standards` on standards host.

**Known hardcode:** `bis-clone/apps/manak-web/src/pages/ConformityAssessment.jsx` still has `http://localhost:3001/product-manuals` — breaks eBIS → BIS until changed to `VITE_BIS_URL`.

---

## Transform: warehouse file count vs golden count

Cluster **fileCount** = warehouse rows. **Golden** count can be lower (e.g. 174 vs 94): quarantine (missing PDF on Railway admin), failed extract, duplicates. **Incremental** transform skips unchanged items. Demo: use **prebuilt seed index** (`proof-actions-sandbox` / render seed), not full live golden of all warehouse on admin-only disk. Preflight checks clone has **`STD-DEMO-001`** (`cd bis-clone && npm run seed` locally).

---

## Git / deploy branch (production uses `main`)

As of **2026-10-20** session:

- **`main`** on GitHub is what prod should track (`bdd5925`+ after pushes).
- **`agent/prod-parity-tests-portal-merge`** tip **`5f570e5`** is **already contained in `main`** — no PR needed to merge that branch.
- **`agent/bis-mitra-proof-actions-and-clone`** is **behind** `main` — do **not** merge into `main` for new fixes.
- Avoid committing **`bis-mitra-admin/data/agent-session.db-*`** (commit `flow test` touched WAL/SHM — consider gitignore/remove from history).

Code on `main` includes: clone-files PDF proxy, portal config URLs, answer sanitize + compliance short answer, proof runbook, smoke hardening, Playwright `proof-actions-quick.spec.js`.

---

## Proof actions (panel demo)

- Runbook: **`docs/PROOF_ACTIONS_RUNBOOK.md`**
- API tests: `npm run test:proof:01` … `10`, orchestrator `test:proof:all`
- Requires published **`proof-actions-sandbox`**, live **`CLONE_API`**, clone demo DB seeded (`STD-DEMO-001`, etc.)

---

## Operator checklist (production)

1. Railway **clone** up → set admin **`CLONE_API`** (must match **`REND_CLONE_API`**, not old Render URL)
2. Railway **admin** vars: `CLONE_API`, `URL_BIS`, `URL_MANAK`, `URL_STANDARDS`, Groq (see `env/railway-bis-mitra-admin-api.env`)
3. **`RAILPACK_PACKAGES=node@20`**, **`RAILPACK_BUILD_APT_PACKAGES=... git-lfs git`**
4. Build: **LFS pull + apply-render-seed** succeeds
5. Vercel **all eight** shared vars → **redeploy all five** frontends
6. Admin UI: **Publish** indexed cluster (**proof-actions-sandbox** or **MITRA Knowledge**)
7. Verify: `portal/config` → `publishedClusterId`, `cloneApi`, `bisWebUrl` not null; `SMOKE_CHAT=1` smoke passes
8. User portal: compliance card + working PDF/BIS links; clone cross-links no localhost

---

## Key files touched (deployment sessions)

| File | Change |
|------|--------|
| `agent.md` | Agent/operator context (this file) |
| `.env` (repo root) | Gitignored **Vercel-only** URL reference (8 vars) |
| `env/vercel-shared-all-projects.env` | Committed twin of root `.env` for Vercel |
| `env/railway-bis-mitra-admin-api.env` | Admin Railway vars template |
| `env/railway-bis-clone-api.env` | Clone Railway vars template |
| `bis-mitra-admin/railway.toml` | Admin build **without** `cd ../bis-clone`; fetch-render-seed-lfs + apply-render-seed |
| `bis-clone/railway.toml` | Clone seed DB copy + start |
| `scripts/apply-render-seed.mjs`, `pack-render-seed.mjs`, `render-seed-paths.mjs` | Deploy seed pipeline |
| `data/render-seed/**` | Committed pre-built index (Git LFS) |
| `api/store.js` | v16 unlock C2; `ensurePlansForAllClusters`; hosted catalog skip |
| `api/clusters.js`, `frontend/src/clusters.js` | Permissions via `deletable`/`renamable` only (no demo read-only) |
| `api/transform-routes.js`, `api/server.js` | Removed transform/unpublish 403 for secured demo |
| `api/preflight.js` | Portal URL env alignment, clearer clone errors |
| `api/env.js` | `BIS_WEB` / `URL_*` → `BIS_URL` aliases |
| `scripts/mitra-vercel-env.mjs` | Vercel `REND_*` → Vite `VITE_*` at build |
| `api/server.js` | `ensureEnvLoaded`, graceful shutdown, `/api/portal/config` |
| `frontend/src/App.jsx` | Removed “Demo · read-only” badges |
| `docs/DEPLOY_RAILWAY.md`, `docs/DEPLOY_CONTEXT.md` | Operator deploy guides |
| `api/prefetch.js`, `frontend/src/api.js` | Debug session logs (optional remove later) |
| `api/debug-session-log.js` | NDJSON debug helper |
| `api/clone-files-proxy.js` | Admin PDF proxy to clone `/files` |
| `bis-mitra-user/src/portal/portalUrls.js` | Runtime BIS/files URLs from portal config |
| `scripts/smoke-deploy.mjs` | SMOKE_CHAT compliance + demo PDF HEAD |
| `docs/PROOF_ACTIONS_RUNBOOK.md` | 10 proof actions rehearsal |
| `api/tests/helpers/preflight.mjs` | Clone demo anchor checks (STD-DEMO-001) |

---

## Production URLs (reference)

| Service | URL |
|---------|-----|
| Admin API (Railway) | `https://bismitra-production.up.railway.app` |
| Clone API (Railway) | `https://bis-clone-production.up.railway.app` |
| User portal | `https://bis-mitra-user.vercel.app` |
| Admin UI | `https://bis-mitra-admin-ui.vercel.app` |
| BIS clone web | `https://bis-clone-bis.vercel.app` |
| Manak clone web | `https://bis-clone-manak.vercel.app` |
| Standards clone web | `https://bis-clone-standards.vercel.app` |

Replace with current domains if redeployed.

---

## Session memory (Cursor)

### 2026-10-20 — env split + this thread consolidated

**User intent:** Run full stack in production (Railway APIs + Vercel UIs), agent works with pre-indexed `mitra-knowledge`, then operate admin **normally** (no locked demo cluster). Document deploy/context for future agents.

**What was deployed and verified (production):**

| Piece | Host | URL |
|-------|------|-----|
| Clone API | Railway, root `bis-clone` | `https://bis-clone-production.up.railway.app` |
| Admin API | Railway, root `bis-mitra-admin` | `https://bismitra-production.up.railway.app` |
| Five frontends | Vercel | See shared `URL_*` / `REND_*` table above |

Health: `GET …/api/health` on both. User/agent: `GET …/api/portal/config` → `publishedClusterId: "mitra-knowledge"` when seed applied.

**Deploy flow that worked:**

1. Two Railway services from same GitHub repo (`Anurag17-2005/BIS_MITRA`), each with correct **Root Directory** (not repo root).
2. **Networking → Generate domain** on each (avoid “Unexposed service”).
3. Clone deploy → copy URL → set admin **`CLONE_API`** (must not stay on old Render URL in `/api/health`).
4. Admin deploy with Groq + LFS build + **`apply-render-seed`**.
5. Vercel **Production** shared env: `REND_ADMIN_API`, `REND_CLONE_API`, `REND_CLONE_FILES` (+ `URL_*`) → **redeploy all 5** frontends.

**Failure modes resolved in thread:**

| Symptom | Cause | Fix |
|---------|--------|-----|
| `can't cd to ../bis-clone` | Admin root = `bis-mitra-admin` only | Use `railway.toml` build without sibling clone; push or override Railway Build command |
| Railpack “could not determine how to build” | Service at monorepo root, no `package.json` | Root Directory `bis-clone` or `bis-mitra-admin` |
| Admin health shows wrong `cloneApi` | Stale **`CLONE_API`** on Railway | Set to live clone Railway URL, redeploy |
| Chat / JSON parse “version ht…” | LFS pointers, no real index | `fetch-render-seed-lfs.mjs` in build; fail build if pointer (`apply-render-seed`) |

**Env ownership (decisions):**

1. **Vercel** = eight shared vars (`REND_*` + `URL_*`). Baked at build via `mitra-vercel-env.mjs`. No Groq/admin password on Vercel.
2. **Root `.env`** = Vercel-only mirror; **not** committed. Railway: `env/railway-*.env` + dashboard secrets (`GROQ_API_KEY`).
3. **Railway admin** = `CLONE_API`, portal `URL_*`, Groq, Node 20, git-lfs apt packages — independent of Vercel.
4. **Clone static files** = `{clone host}/files`, not `/api/files`.

**Code / product decisions:**

- **Render-seed** is the production path for RAG data; do not Full rebuild on server for demo corpus.
- **`mitra-knowledge` read-only** (secured, blocked transform/unpublish/delete) **removed** — store v16, updated `render-seed/admin-store.json`, API/UI guards dropped. Repack seed still filters to one cluster for Git size unless operator changes `pack-render-seed.mjs` behavior.
- **Prefetch:** seed store had `plans: []`; **`ensurePlansForAllClusters()`** on load so ingest prefetch can run on hosted admin (Clone API method).

**Operator order (quick):** clone up → admin `CLONE_API` + Groq + URLs → admin build LFS+seed OK → Vercel `REND_*` → redeploy UIs → confirm portal config + user chat.

**Earlier 2026-10-20 work (same repo):** Railway chat crashes (Node 24, LFS, OOM/catalog backfill), health strip labels vs `GET /api/status` tooltips — see sections above.

---

### 2026-10-05 — Prod parity, proof actions, user portal + clone linking

**User intent:** Fix production user portal (agent answer, PDFs, Open on BIS); validate **10 proof actions** for panel demo; confirm git branch vs **`main`** for deploy.

**Observed on prod (before env fix):**

- User portal: long Expert answer + JSON leak; no helmet **compliance card**; cluster label **test**.
- `GET /api/portal/config`: `cloneApi` → old **Render** URL; `bisWebUrl` / `manakWebUrl` **null**; `publishedClusterId` **null**.
- BIS / eBIS / Standards: nav links to **`localhost:3001–3003`** (Vercel builds without `URL_*` at build time).
- Transform UI: **174** warehouse files vs **~94** golden (quarantine / missing PDFs on admin volume).

**Agent answer quality (clarification):** Poor answers were primarily **`CLONE_API` + published cluster + probe**, not missing Groq. Groq on Railway admin still needed for LLM wording.

**Git / deploy:**

- Production tracks **`main`** on `Anurag17-2005/BIS_MITRA`.
- **`agent/prod-parity-tests-portal-merge`** (`5f570e5`) already **in** `main` — **no PR** required for that branch.
- **`agent/bis-mitra-proof-actions-and-clone`** is **behind** `main` — do not merge for new fixes.
- Commits on `main`: `5f570e5` (clone proxy, portal URLs, chat sanitize), `38b1a6e` (runbook, smoke, E2E), `bdd5925` (only session DB WAL/SHM — avoid).

**Deliverables added to repo:**

- `docs/PROOF_ACTIONS_RUNBOOK.md` — 10 actions, deploy gate, demo-day order.
- `scripts/smoke-deploy.mjs` — `SMOKE_CHAT=1` asserts compliance panel + demo PDF.
- `api/tests/helpers/preflight.mjs` — requires clone **`STD-DEMO-001`** (run `bis-clone npm run seed` locally).
- `bis-mitra-user/e2e/proof-actions-quick.spec.js` + portal testids for checklist/matching/verify cards.

**Cross-portal fix (operator, not code):** Set all **eight** Vercel shared vars → **redeploy all five** apps. Railway admin: `URL_BIS`, `URL_MANAK`, `URL_STANDARDS`, `CLONE_API`. Code follow-up: `ConformityAssessment.jsx` hardcoded localhost → should use `VITE_BIS_URL`.

**Local dev note:** Admin on **Node 24** Windows may **exit 134** (scheduler + better-sqlite3); use **Node 20** or run proofs against Railway.

---

## Docs to read next

- `docs/DEPLOY_RAILWAY.md`
- `docs/DEPLOY_CONTEXT.md`
- `docs/vercel-env.example`
- `docs/PROOF_ACTIONS_RUNBOOK.md`

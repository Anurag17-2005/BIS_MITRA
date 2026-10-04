# Deploy BIS MITRA (Vercel + Render)

Full stack: **2 Render web services** (APIs) + **5 Vercel projects** (static UIs).

## Prerequisites

- GitHub repo: `Anurag17-2005/BIS_MITRA` on `main`
- [Render](https://render.com) account + **API key** (for CLI) or Blueprint
- [Vercel](https://vercel.com) account + **token** (for CLI)
- **Groq API key** — set only in Render (never commit)

## 1. Render (APIs) — two Web Services

Create **two** services under your **BIS** project (same GitHub repo, different root directories). Do **not** use one service at repo root.

**Services**

| Service | Root dir | Notes |
|---------|----------|--------|
| `bis-mitra-clone-api` | `bis-clone` | Build below |
| `bis-mitra-admin-api` | `bis-mitra-admin` | Build below |

### Clone API (`bis-mitra-clone-api`)

| Setting | Value |
|---------|--------|
| Root Directory | `bis-clone` |
| Build Command | `npm ci && npm rebuild better-sqlite3 -w api && cp data/bis-clone.seed.db data/bis-clone.db` |
| Start Command | `npm run start -w api` |
| Health Check Path | `/api/health` |
| Env | `NODE_VERSION=20` |

### Admin API (`bis-mitra-admin-api`)

| Setting | Value |
|---------|--------|
| Root Directory | `bis-mitra-admin` |
| Build Command | `cd ../bis-clone && npm ci && npm rebuild better-sqlite3 -w api && cp data/bis-clone.seed.db data/bis-clone.db && cd ../bis-mitra-admin && npm ci && npm rebuild better-sqlite3 -w api && node scripts/apply-render-seed.mjs` |
| Start Command | `npm run start:api` |
| Health Check Path | `/api/health` |
| Env | `NODE_VERSION=20`, `GROQ_API_KEY`, `LLM_PROVIDER=groq`, `CLONE_API` (after clone is live) |

Do **not** run `build:demo` / Full rebuild on Render (OOM on large PDF sets). RAG indexes ship via **Git seed** (below).

Optional: `NODE_OPTIONS=--max-old-space-size=512` on the admin service if occasional transform is needed.

Copy public URLs when ready:

- `CLONE_API` = `https://<clone-service>.onrender.com`
- `ADMIN_API` = `https://<admin-service>.onrender.com`

Set on Render:

| Service | Variable | Value |
|---------|----------|--------|
| clone | `CLONE_PUBLIC_URL` | same as public clone URL (no trailing slash) |
| clone | `MITRA_ADMIN_URL` | `ADMIN_API` |
| admin | `CLONE_API` | clone public URL |
| admin | `GROQ_API_KEY` | your Groq key |
| admin | `BIS_WEB` | Vercel BIS site URL (after step 2) |
| admin | `MANAK_APPLICATIONS_URL` | Vercel Manak site URL (applications / deep links) |
| admin | `STANDARDS_URL` | Vercel Standards site URL |

Redeploy both services after URL env vars are set.

## 2. Vercel (frontends)

Create **five** projects from the same repo (different **Root Directory**):

| Project name (suggested) | Root Directory | Build env (`VITE_*`) |
|--------------------------|----------------|----------------------|
| `bis-mitra-user` | `bis-mitra-user` | see below |
| `bis-mitra-admin-ui` | `bis-mitra-admin/frontend` | see below |
| `bis-clone-bis` | `bis-clone/apps/bis-web` | see below |
| `bis-clone-manak` | `bis-clone/apps/manak-web` | see below |
| `bis-clone-standards` | `bis-clone/apps/standards-web` | see below |

Each folder has a `vercel.json`. Clone apps run `npm ci` from `bis-clone` root (workspaces).

### Environment variables (Production, rebuild after changes)

All five frontends map env at **build time** via `scripts/mitra-vercel-env.mjs` (see each app’s `vite.config.js`). React code still uses `import.meta.env.VITE_*` / admin `config.js`; you do **not** need `VITE_` prefixes on Vercel.

**Recommended: one shared set on the Vercel team** (link the same keys to every frontend project):

```
REND_ADMIN_API=https://<ADMIN_API>
REND_CLONE_API=https://<CLONE_API>
REND_CLONE_FILES=https://<CLONE_API>/files
URL_USER=https://<bis-mitra-user>.vercel.app
URL_ADMIN_UI=https://<bis-mitra-admin-ui>.vercel.app
URL_BIS=https://<bis-clone-bis>.vercel.app
URL_MANAK=https://<bis-clone-manak>.vercel.app
URL_STANDARDS=https://<bis-clone-standards>.vercel.app
```

Legacy names still work as fallbacks: `ADMIN_*`, `VITE_*` (per-app mapping in `mitra-vercel-env.mjs`).

| Project | Uses from shared set |
|---------|----------------------|
| `bis-mitra-user` | `REND_ADMIN_API`, `REND_CLONE_API`, `URL_BIS`, `URL_MANAK` |
| `bis-mitra-admin/frontend` | `REND_ADMIN_API`, `REND_CLONE_API`, `URL_USER`, `URL_BIS`, `URL_MANAK` |
| `bis-clone/apps/bis-web` | `REND_CLONE_API`, `URL_MANAK`, `URL_STANDARDS` |
| `bis-clone/apps/manak-web` | `REND_CLONE_API`, `URL_BIS` |
| `bis-clone/apps/standards-web` | `REND_CLONE_API`, `REND_CLONE_FILES`, `URL_BIS`, `URL_MANAK` |

### Vercel CLI (optional)

```powershell
npm i -g vercel
cd D:\BIS_MITRA\bis-mitra-user
vercel link
vercel env add VITE_API_URL production
vercel --prod
```

Repeat per app root with its `VITE_*` set.

## 3. Deploy order

1. Push `main` to GitHub
2. Render: deploy **clone API** → note URL
3. Render: deploy **admin API** with `CLONE_API` + `GROQ_API_KEY`
4. Vercel: deploy all 5 sites with `VITE_*` pointing at Render + other Vercel URLs
5. Render: set `BIS_WEB`, `MANAK_APPLICATIONS_URL`, `STANDARDS_URL`, `MITRA_ADMIN_URL`, `CLONE_PUBLIC_URL` → **manual redeploy**
6. Vercel: **redeploy** if any `VITE_*` changed

## 4. Smoke test

- `GET https://<CLONE_API>/api/health`
- `GET https://<ADMIN_API>/api/health`
- `GET https://<ADMIN_API>/api/portal/config` → `publishedClusterId: "mitra-knowledge"` (when seed is committed)
- Open user portal → chat (needs Groq on admin API)
- “Open on BIS” links → Vercel clone sites

## 5. Pre-built RAG seed (`mitra-knowledge`) via GitHub

Transform runs **locally**; Render applies committed seed on each deploy (same idea as `bis-clone.seed.db`).

**Local (high RAM):**

```bash
cd bis-mitra-admin
npm ci
set NODE_OPTIONS=--max-old-space-size=4096   # Windows; use export on macOS/Linux
npm run build:mitra-knowledge
npm run pack:render-seed
```

Verify before pack:

- `http://localhost:5050/api/portal/config` → published `mitra-knowledge`
- Transform tab → live index chunk count &gt; 0

**Git:**

```bash
git lfs install
git add bis-mitra-admin/data/render-seed .gitattributes
git commit -m "chore: add Render admin seed for mitra-knowledge"
git push origin main
```

Render admin build runs `node scripts/apply-render-seed.mjs` (no-op if seed not in repo yet).

Seed paths: [`bis-mitra-admin/data/render-seed/`](bis-mitra-admin/data/render-seed/) — see [`docs/vercel-env.example`](vercel-env.example) for frontends only.

Evaluators: use published **`mitra-knowledge`** (single demo cluster in seed, read-only — delete/unpublish/clear/transform rebuild blocked).

## 6. Not deployed (by design)

- Local `data/bronze` (~GB) — not required when using `render-seed`
- Live `data/indexes/` and `admin-store.json` (gitignored); only `data/render-seed/` is committed
- `node_modules`, logs, sandbox under `proof-actions-sandbox`

## 7. Admin login

Password default **`mitra`** (`ADMIN_PASSWORD` on admin API if you override). Auth is disabled when `RENDER=true`.

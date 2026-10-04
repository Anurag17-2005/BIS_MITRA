# Deploy BIS MITRA APIs on Railway (+ Vercel frontends)

Same architecture as Render: **2 Railway services** (APIs) + **5 Vercel** static apps. Frontends stay on Vercel; only the Node APIs move to [Railway](https://railway.app).

## Why Railway can be easier

- **GitHub → deploy** (like Render)
- **`PORT`** is injected automatically (your code already uses `process.env.PORT`)
- **More RAM** on paid plans — still use **Git seed** for `mitra-knowledge` (do not Full rebuild on the server)
- **Service variables** — wire `CLONE_API` / admin URLs without copy-paste after first deploy

## 0. Fix “Railpack could not determine how to build the app”

That error means Railway is building the **repo root** (`BIS_MITRA/`), which has **no** `package.json`.

**You must set Root Directory per service** (not the monorepo root):

1. Open the service → **Settings**
2. **Source** → **Root Directory** → `bis-clone` **or** `bis-mitra-admin`
3. Save → **Redeploy**

Each service reads [`bis-clone/railway.toml`](bis-clone/railway.toml) or [`bis-mitra-admin/railway.toml`](bis-mitra-admin/railway.toml) from that root.

Do **not** deploy a single service at `/` with the whole repo unless you add a custom Dockerfile.

## 1. Create a Railway project

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → `Anurag17-2005/BIS_MITRA`
2. Add **two services** from the **same repo** (duplicate service or “Add service” twice):

| Service name (suggested) | Root directory | Start command |
|------------------------|----------------|---------------|
| `bis-mitra-clone-api` | `bis-clone` | `npm run start -w api` |
| `bis-mitra-admin-api` | `bis-mitra-admin` | `npm run start:api` |

For each service: **Settings → Root Directory** = path above (required).

Then **Networking → Generate domain** so the service is not “Unexposed”.

## 2. Build commands

### Clone API (`bis-clone`)

**Build:**

```bash
npm ci && npm rebuild better-sqlite3 -w api && cp data/bis-clone.seed.db data/bis-clone.db
```

**Variables (minimum):**

| Variable | Value |
|----------|--------|
| `NODE_VERSION` or Nixpacks Node 20 | `20` |
| `MITRA_ADMIN_URL` | Admin public URL (after admin is live) |
| `CLONE_PUBLIC_URL` | This service’s public URL, e.g. `https://<clone>.up.railway.app` |

Railway also sets `RAILWAY_PUBLIC_DOMAIN`; clone API will use `https://${RAILWAY_PUBLIC_DOMAIN}` if `CLONE_PUBLIC_URL` is unset.

**Health:** generate domain → `GET https://<clone>/api/health`

### Admin API (`bis-mitra-admin`)

**Build** (in [`bis-mitra-admin/railway.toml`](../bis-mitra-admin/railway.toml); do **not** `cd ../bis-clone` — with Root Directory `bis-mitra-admin`, only that folder exists in the build image):

```bash
npm rebuild better-sqlite3 -w api && (command -v git-lfs >/dev/null && git lfs install && git lfs pull || true) && node scripts/apply-render-seed.mjs
```

Railpack runs `npm install` before this. `apply-render-seed` **merges** the committed **`mitra-knowledge`** corpus into the live store (does not wipe your other clusters or publish flags). See [DEPLOY_CONTEXT.md](DEPLOY_CONTEXT.md).

**Clone data on admin:** there is no local `bis-clone.db` on this service. Set **`CLONE_API`** to the clone Railway URL so HTTP-backed features work. Direct SQLite (`clone-db.js`, some ingestion/runner paths) need **`CLONE_DB_PATH`** only if you mount or copy a DB file — optional for the agent demo if clone API is up.

**Variables (minimum):**

| Variable | Value |
|----------|--------|
| `GROQ_API_KEY` | Your Groq key |
| `LLM_PROVIDER` | `groq` |
| `CLONE_API` | Clone service public URL |
| `DISABLE_ADMIN_AUTH` | `1` (demo; or rely on auto-detect when `RAILWAY_ENVIRONMENT` is set) |

**Optional (cross-links for agent / server):**

| Variable | Value |
|----------|--------|
| `BIS_WEB` | Vercel BIS URL |
| `MANAK_APPLICATIONS_URL` | Vercel Manak URL |
| `STANDARDS_URL` | Vercel Standards URL |

**Health:** `GET https://<admin>/api/health`  
**Portal:** `GET https://<admin>/api/portal/config` → `publishedClusterId: null` until you publish a cluster in admin

Do **not** add `npm run build:mitra-knowledge` to the Railway build (run that locally; seed is in Git).

## 3. Public URLs & networking

For each service: **Settings → Networking → Generate domain** (e.g. `*.up.railway.app`).

**Tip:** In admin service variables, set:

```text
CLONE_API=https://${{bis-mitra-clone-api.RAILWAY_PUBLIC_DOMAIN}}
```

(Replace `bis-mitra-clone-api` with your exact Railway service name.)

Set on clone:

```text
MITRA_ADMIN_URL=https://${{bis-mitra-admin-api.RAILWAY_PUBLIC_DOMAIN}}
CLONE_PUBLIC_URL=https://${{bis-mitra-clone-api.RAILWAY_PUBLIC_DOMAIN}}
```

## 4. Vercel (unchanged)

Update shared env to Railway URLs (names from [vercel-env.example](vercel-env.example)):

```text
REND_ADMIN_API=https://<admin>.up.railway.app
REND_CLONE_API=https://<clone>.up.railway.app
REND_CLONE_FILES=https://<clone>.up.railway.app/files
```

Redeploy **all 5** Vercel frontends after changing env.

## 5. Deploy order

1. Push `main` (includes `data/render-seed/` + Git LFS if used)
2. Deploy **clone** → health OK → copy URL
3. Deploy **admin** with `CLONE_API` + Groq → build runs `apply-render-seed`
4. Update Vercel `REND_*` → redeploy frontends
5. Set clone `MITRA_ADMIN_URL` + redeploy clone if needed

## 6. Git LFS

If the repo uses LFS for `render-seed`, enable **Git LFS** in Railway build or ensure LFS objects are fetched (Railway: install `git-lfs` in build or use `GIT LFS pull` in build command before `apply-render-seed`):

```bash
git lfs install && git lfs pull
```

(Add at the start of the admin build if LFS files are missing on deploy.)

## 7. Smoke test

Run [`bis-mitra-admin/scripts/smoke-deploy.mjs`](../bis-mitra-admin/scripts/smoke-deploy.mjs) with `ADMIN_API` / `CLONE_API`, or follow the checklist in [DEPLOY_CONTEXT.md](DEPLOY_CONTEXT.md).

## Render vs Railway env (reference)

| Purpose | Render | Railway |
|---------|--------|---------|
| Hosted demo (skip admin login) | `RENDER=true` (auto on Render) | `RAILWAY_ENVIRONMENT` (auto) or `DISABLE_ADMIN_AUTH=1` |
| Public URL hint | `RENDER_EXTERNAL_URL` | `RAILWAY_PUBLIC_DOMAIN` / `CLONE_PUBLIC_URL` |
| Seed apply | build: `apply-render-seed.mjs` | same |

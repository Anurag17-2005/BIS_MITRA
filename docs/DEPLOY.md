# Deploy BIS MITRA (Vercel + Render)

Full stack: **2 Render web services** (APIs) + **5 Vercel projects** (static UIs).

## Prerequisites

- GitHub repo: `Anurag17-2005/BIS_MITRA` on `main`
- [Render](https://render.com) account + **API key** (for CLI) or Blueprint
- [Vercel](https://vercel.com) account + **token** (for CLI)
- **Groq API key** — set only in Render (never commit)

## 1. Render (APIs)

### Option A — Blueprint

1. Render → **New** → **Blueprint**
2. Connect GitHub repo → uses root `render.yaml`
3. When prompted, set **secret** env vars:
   - `GROQ_API_KEY`
   - After first URLs exist: `CLONE_API`, `MITRA_ADMIN_URL`, `CLONE_PUBLIC_URL`, `BIS_WEB`, `MANAK_WEB` (see below)

### Option B — CLI

```powershell
# Install: winget install Render.RenderCLI  OR  npm i -g render-cli
$env:RENDER_API_KEY = "<your-render-api-key>"
render blueprint sync
```

**Services**

| Service | Root dir | Notes |
|---------|----------|--------|
| `bis-mitra-clone-api` | `bis-clone` | Seeds `bis-clone.db` on build |
| `bis-mitra-admin-api` | `bis-mitra-admin` | Seeds clone DB + `npm run build:demo` (indexes) |

First admin build may take **10–20 minutes** (index pipeline).

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

**bis-mitra-user**

```
VITE_API_URL=https://<ADMIN_API>
VITE_BIS_API=https://<CLONE_API>
VITE_BIS_URL=https://<bis-clone-bis>.vercel.app
VITE_MANAK_URL=https://<bis-clone-manak>.vercel.app
```

**bis-mitra-admin/frontend**

```
VITE_API_URL=https://<ADMIN_API>
VITE_USER_PORTAL_URL=https://<bis-mitra-user>.vercel.app
VITE_BIS_URL=https://<bis-clone-bis>.vercel.app
```

**bis-clone/apps/bis-web**

```
VITE_API_URL=https://<CLONE_API>
VITE_MANAK_URL=https://<bis-clone-manak>.vercel.app
VITE_STANDARDS_URL=https://<bis-clone-standards>.vercel.app
```

**bis-clone/apps/manak-web**

```
VITE_API_URL=https://<CLONE_API>
VITE_BIS_URL=https://<bis-clone-bis>.vercel.app
```

**bis-clone/apps/standards-web**

```
VITE_API_URL=https://<CLONE_API>
VITE_FILES_URL=https://<CLONE_API>/files
VITE_BIS_URL=https://<bis-clone-bis>.vercel.app
VITE_MANAK_URL=https://<bis-clone-manak>.vercel.app
```

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

1. Push `main` with `render.yaml` + fixes to GitHub
2. Render: deploy **clone API** → note URL
3. Render: deploy **admin API** with `CLONE_API` + `GROQ_API_KEY`
4. Vercel: deploy all 5 sites with `VITE_*` pointing at Render + other Vercel URLs
5. Render: set `BIS_WEB`, `MANAK_APPLICATIONS_URL`, `STANDARDS_URL`, `MITRA_ADMIN_URL`, `CLONE_PUBLIC_URL` → **manual redeploy**
6. Vercel: **redeploy** if any `VITE_*` changed

## 4. Smoke test

- `GET https://<CLONE_API>/api/health`
- `GET https://<ADMIN_API>/api/health`
- Open user portal → chat (needs Groq)
- “Open on BIS” links → Vercel clone sites

## 5. Not deployed (by design)

- Local `data/bronze` (~GB) — rebuilt via `build:demo` on Render admin service
- `node_modules`, logs, sandbox under `proof-actions-sandbox`

## Admin login

Password default **`mitra`** (`ADMIN_PASSWORD` on admin API if you override).

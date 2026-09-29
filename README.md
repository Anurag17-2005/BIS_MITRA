# BIS MITRA

Two apps: **Clone B** (portal mirror) and **MITRA Admin** (maintainer warehouse). Transformation / agent layer comes later.

## Quick start

```bash
# Terminal 1 — Clone B (API + 3 portals)
cd bis-clone
npm install
npm run generate-pdfs
npm run seed
npm start                 # :4000 :3001 :3002 :3003

# Terminal 2 — Admin
cd bis-mitra-admin
npm install
npm start                 # UI :5001  API :5050
```

Admin login password: **`mitra`** (override with `ADMIN_PASSWORD`).

Manak login: `demo@bis-mitra.in` / `Demo@123` / captcha `1234`.

See **[NAVIGATION.md](./NAVIGATION.md)** for pages, Playwright patterns, and the admin demo path.

## Fetch methods (every plan)

| Method | What it does |
|--------|----------------|
| **Clone API** | HTTP to Clone B REST `:4000` |
| **Direct DB** | Read `bis-clone/data/bis-clone.db` |
| **Playwright script** | Drive the matching portal page (patterns A–G, N) |

Hover a plan name in Config fetch for **what** is fetched, **how** (all vs search), and **from where**.

Warehouse ingest **replaces** the previous snapshot for that plan. Uploads stay. Clone edits do **not** auto-update admin until you fetch.
# BIS_MITRA

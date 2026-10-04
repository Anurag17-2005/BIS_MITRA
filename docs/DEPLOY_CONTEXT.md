# Production deploy context (operator workflow)

This doc complements [DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md) and [DEPLOY.md](DEPLOY.md).

## Who owns what

| Concern | Operator (you) | Deploy / seed |
|--------|----------------|---------------|
| Which cluster is live for users | **Publish** one cluster in admin | Seed does **not** auto-publish |
| Extra prod clusters (e.g. `test`) | Create in admin UI | **Preserved** on Railway redeploy |
| `mitra-knowledge` corpus files + index | Optional pre-seeded | **Updated** from Git on each admin build |
| Lock delete on a published cluster | **⋯ → Prevent deletion** | `deletable: false` stored in live `admin-store.json` |

## Render seed apply (merge, not wipe)

On each admin API build, `node scripts/apply-render-seed.mjs`:

1. **Replaces** `data/indexes/mitra-knowledge/` and `data/uploads/mitra-knowledge/` from committed seed.
2. **Merges** seed warehouse/plans/history for `mitra-knowledge` into **live** `data/admin-store.json`.
3. **Does not remove** other clusters or change their publish/delete flags.
4. If `mitra-knowledge` is new on the volume, it is added with **`published: false`**.

Committed seed in Git uses **`published: false`** (`npm run pack:render-seed` normalizes the same).

Repack locally after corpus changes:

```bash
cd bis-mitra-admin
npm run pack:render-seed
# commit data/render-seed/ + Git LFS if uploads/indexes changed
```

## Admin UX

- App opens on the **cluster list**; no cluster is pre-selected.
- **Agent** tab preview uses the **published** cluster only (not the first cluster in the list).
- Per cluster: **⋯** menu → **Prevent deletion** toggles `deletable` (hides Delete; API returns 403).

## Smoke checks

Automated (set URLs to your Railway services):

```bash
cd bis-mitra-admin
ADMIN_API=https://<admin>.up.railway.app CLONE_API=https://<clone>.up.railway.app node scripts/smoke-deploy.mjs
```

| Check | Expected |
|-------|----------|
| `GET /api/health` (admin) | 200; `cloneApi` points at clone when `CLONE_API` is set |
| `GET /api/portal/config` | `publishedClusterId: null` until you publish |
| Admin UI | List view; optional `mitra-knowledge`, not auto-selected |
| Publish your cluster → user portal | Chat uses published cluster |
| Prevent deletion → try Delete | Button hidden; `DELETE` → 403 |
| `GET /api/registry/verify?cml=CML-DEMO-61003` (clone) | 200 (tools path for agent) |

Manual: 2–3 chat prompts from [PROOF_ACTIONS_4_10_PLAN.md](../PROOF_ACTIONS_4_10_PLAN.md) or industry helmet prompt after you publish.

Full local test matrix: see **[TEST_MATRIX.md](TEST_MATRIX.md)**.

```bash
cd bis-mitra-admin
npm run test:proof:all          # preflight + proof 1–10 + integration
cd ../bis-mitra-user && npm run test:e2e   # portal UI (admin + clone must be running)
```

Prod optional chat probe: `SMOKE_CHAT=1 ADMIN_API=… CLONE_API=… node scripts/smoke-deploy.mjs` (asserts helmet **compliance panel**, demo PDF, warns on `test` cluster).

Full proof gate: [PROOF_ACTIONS_RUNBOOK.md](PROOF_ACTIONS_RUNBOOK.md) Phase 0 + `npm run test:proof:all`.

## Railway / Vercel wiring (reminder)

- Admin build: **no** `cd ../bis-clone`; LFS pull + `apply-render-seed.mjs` only ([`railway.toml`](../bis-mitra-admin/railway.toml)).
- Admin env: `GROQ_API_KEY`, `LLM_PROVIDER=groq`, `CLONE_API` = clone public URL; optional `URL_BIS` / `URL_MANAK` (served via `/api/portal/config` so **Open on BIS** works even if a frontend was built without `URL_BIS`).
- Vercel: `REND_ADMIN_API`, `REND_CLONE_API`, `REND_CLONE_FILES`, `URL_BIS`, `URL_MANAK` — redeploy all five frontends after URL changes.
- Publish an **indexed** cluster (e.g. `proof-actions-sandbox`), not an empty `test` cluster, for helmet compliance cards and clean answers.

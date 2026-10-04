# BIS MITRA test matrix

Maps user/admin features to automated tests. Run local stack: **clone :4000**, **admin :5050**, then tests from `bis-mitra-admin`.

## Commands

| Command | Scope |
|---------|--------|
| `npm run test:preflight` | Admin + clone health, SQLite sanity |
| `npm run test:integration` | Seed merge unit, cluster flags, publish↔portal |
| `npm run test:proof:01` … `03` | Industry proof actions 1–3 |
| `npm run test:proof:04` … `10` | Proof actions 4–10 |
| `npm run test:proof:suite` | All 10 actions sequentially |
| `npm run test:proof:all` | Preflight + merge + suite + integration |
| `cd bis-mitra-user && npm run test:e2e` | Playwright portal UI (needs admin + clone up) |
| `SMOKE_CHAT=1 node scripts/smoke-deploy.mjs` | Prod chat probe (uses published cluster only) |

**Env:** `TEST_CLUSTER=proof-actions-sandbox` (default), `ADMIN_API`, `CLONE_API`, `DISABLE_ADMIN_AUTH=1` optional locally, `ADMIN_PASSWORD` when auth on.

**Prerequisite:** Cluster `proof-actions-sandbox` exists with index (see `data/bronze/proof-actions-sandbox`). Tests publish it temporarily; set `TEST_LEAVE_PUBLISHED=1` to skip restore.

---

## User portal (`bis-mitra-user`)

| Feature | Automated | Test ID |
|---------|-----------|---------|
| Dark / light theme | Playwright | `portal-chrome.spec.js` |
| EN / HI language | Playwright | `portal-chrome.spec.js` |
| Sidebar collapse + nav pages | Playwright | `portal-chrome.spec.js` |
| 8 personas + welcome tiles | Playwright | `portal-personas.spec.js` |
| Published cluster label | Playwright | `portal-publish-cross.spec.js` |
| Helmet compliance card (action 1 UI) | Playwright | `portal-publish-cross.spec.js` |
| Unpublished banner | Playwright | `portal-unpublished.spec.js` |
| Config refresh on focus | Playwright | `portal-config-refresh.spec.js` |
| Voice mic | Manual | — |
| PDF viewer full flow | Manual | — |
| File attach in composer | Manual | — |
| Save snippet | Manual | — |

---

## Proof actions (API — user response quality)

| Action | Persona | Automated |
|--------|---------|-----------|
| 1 Helmet compliance | industry | `test:proof:01` |
| 2 Cert apply + confirm | industry | `test:proof:02` |
| 3 Status + alerts | industry | `test:proof:03` |
| 4 FMCS checklist | foreign_exporter | `test:proof:04` |
| 5 Lab matching | industry | `test:proof:05` |
| 6 CML verify | citizen | `test:proof:06` |
| 7 Consumer complaint | citizen | `test:proof:07` |
| 8 HUID + calculation | gold_investor | `test:proof:08` |
| 9 Standard comparison | academic | `test:proof:09` |
| 10 Enforcement evidence | enforcement | `test:proof:10` |

Orchestrator: `test:proof:suite` / `test:proof:all`.

---

## Admin ↔ user cross-function

| Feature | Automated | Test ID |
|---------|-----------|---------|
| Publish → `portal/config` | API | `cluster-publish-portal.test.mjs` |
| Chat uses config `clusterId` | API | same |
| Exclusive single publish | API | same |
| Unpublish → null config | API | same |
| Prevent deletion / DELETE 403 | API | `cluster-flags.test.mjs` |
| Seed merge preserves user clusters | Unit | `apply-seed-merge.test.mjs` |

---

## Deploy smoke

See [DEPLOY_CONTEXT.md](DEPLOY_CONTEXT.md). Optional: `SMOKE_CHAT=1` on `smoke-deploy.mjs`.

---

## Maintainer admin UI

| Feature | Automated |
|---------|-----------|
| Cluster list / publish / ⋯ lock | API only (no Playwright v1) |
| Transform / autofetch / rules | Manual or future |

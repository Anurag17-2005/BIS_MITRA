# BIS MITRA — 10 Proof Actions Runbook

Panel demo: **Prompt → Agent → System change → Visible proof**. Rehearsal target: **~2 hours** including automated gate.

See also: [TEST_MATRIX.md](TEST_MATRIX.md), [DEPLOY_CONTEXT.md](DEPLOY_CONTEXT.md), [vercel-env.example](vercel-env.example).

---

## Phase 0 — Deploy gate (before any proof)

- [ ] **Git:** `main` on GitHub matches local (prod fixes: clone PDF proxy, portal URLs, answer sanitize).
- [ ] **Railway admin:** `CLONE_API`, `GROQ_API_KEY`, `LLM_PROVIDER=groq`, optional `URL_BIS`, `URL_MANAK` → redeploy.
- [ ] **Railway clone:** public URL healthy → redeploy if needed.
- [ ] **Vercel (shared env, all 5 frontends):** `REND_ADMIN_API`, `REND_CLONE_API`, `REND_CLONE_FILES`, `URL_BIS`, `URL_MANAK` → redeploy all five.
- [ ] **Admin UI:** Publish cluster **`proof-actions-sandbox`** (not empty `test` only).
- [ ] **Smoke:**

```powershell
$env:ADMIN_API="https://YOUR-admin.up.railway.app"
$env:CLONE_API="https://YOUR-clone.up.railway.app"
$env:SMOKE_CHAT="1"
node bis-mitra-admin/scripts/smoke-deploy.mjs
```

- [ ] **Clone demo DB** (local): `cd bis-clone && npm install && npm run seed` — preflight checks `STD-DEMO-001` and `CML-DEMO-61003`.
- [ ] **Automated proof gate** (local or prod URLs):

```powershell
cd bis-mitra-admin
$env:ADMIN_API="http://localhost:5050"   # or prod
$env:CLONE_API="http://localhost:4000"
$env:DISABLE_ADMIN_AUTH="1"              # local maintainer bypass only
$env:TEST_CLUSTER="proof-actions-sandbox"
npm run test:proof:all
```

**Note:** Admin API on Windows Node 24 may exit (code 134) under scheduler load — restart `npm run start -w api` and re-run proofs, or use Railway for long suites.

---

## Demo-day script (recommended order)

1. **Action 1** — Industry helmet compliance + sources  
2. **Action 2** — Submit cert → **eBIS/Manak Applications**  
3. **Action 3** — Admin certifies → user **Alerts**  
4. **Action 6** or **8** — Citizen/Gold verification  
5. **Action 7** — Consumer complaint before/after  
6. **Actions 4–5, 9–10** — API-proven; show if time (foreign / lab / research / enforcement)

Morning of demo: run `npm run test:proof:all` against **prod** `ADMIN_API` + `CLONE_API`.

---

## Action 1 — Industry: standard & compliance

| Field | Value |
|--------|--------|
| **Persona** | Industry (View as) |
| **Prompt** | I manufacture industrial safety helmets. What BIS standard applies to my product, is certification mandatory, and what tests and documents do I need? |
| **Data anchor** | `STD-DEMO-001` / `IS DEMO 1001:2026` |
| **API** | `npm run test:proof:01` |
| **Expected UI** | Compliance card `data-testid="portal-compliance-card"`: standard, 4 tests, 4 documents, **Start Certification** |
| **Sources** | View doc (PDF via clone `/files/...`); Open on BIS → hosted BIS URL (not localhost) |
| **Before → After** | N/A (read-only knowledge) |

**Portal check:** Send prompt → card visible → open one source PDF → Open on BIS loads process page.

- [ ] Pass

---

## Action 2 — Industry: submit certification application

| Field | Value |
|--------|--------|
| **Persona** | Industry |
| **Prompt** | I want to apply for certification for my industrial safety helmet under IS DEMO 1001:2026. Help me complete and submit the application. |
| **Follow-up** | Provide lab report ref when asked; declare accuracy; reply **Confirm** on review table |
| **Data anchor** | `STD-DEMO-001`, `LIC-DEMO-26001`, `CERT-DEMO-001` |
| **API** | `npm run test:proof:02` |
| **Before** | eBIS/clone `GET /api/applications` — new ID **not** listed |
| **After** | New row `BIS-APP-DEMO-XXXXXX`, status **Submitted**, tied to session |
| **Portal** | Confirm table → **My Applications** shows application |
| **eBIS** | Manak web → Applications table shows same ID |

- [ ] Pass

---

## Action 3 — Industry: status → notification

| Field | Value |
|--------|--------|
| **Persona** | Industry (same session as Action 2) |
| **Prompt** | What is the status of my certification application {referenceId}? |
| **Prereq** | Application ID from Action 2 |
| **Admin demo** | Change status: Under Review → Testing → **Certified** (clone PATCH or admin UI) |
| **API** | `npm run test:proof:03` (needs `referenceId` from 02 or `PROOF_REFERENCE_ID`) |
| **Before** | No “Certification Approved” alert |
| **After** | Alert **Certification Approved**; chat panel status **Certified** + history |
| **Portal** | Bell badge; alert mentions application ID |

- [ ] Pass

---

## Action 4 — Foreign exporter: FMCS checklist

| Field | Value |
|--------|--------|
| **Persona** | Foreign exporter |
| **Prompt** | I manufacture induction cooking appliances outside India and want to sell them in India. What BIS requirements apply, which standard and QCO should I check, and what AIR, factory inspection, documents and testing evidence do I need? |
| **Data anchor** | `IS DEMO 1003:2025`, `QCO-DEMO-003` |
| **API** | `npm run test:proof:04` |
| **Expected UI** | FMCS checklist card `data-testid="portal-checklist-card"` |
| **Before → After** | N/A |

- [ ] Pass

---

## Action 5 — Industry: laboratory matching

| Field | Value |
|--------|--------|
| **Persona** | Industry |
| **Prompt** | I need to test my induction cooking appliance against IS DEMO 1003:2025. Which BIS-recognised laboratory should I use? |
| **Data anchor** | `LAB-DEMO-001` |
| **API** | `npm run test:proof:05` |
| **Expected UI** | Lab card `data-testid="portal-matching-card"` with recommended lab |
| **Before → After** | N/A |

- [ ] Pass

---

## Action 6 — Citizen: product verification (CML)

| Field | Value |
|--------|--------|
| **Persona** | Everyday consumer / Citizen |
| **Prompt** | Verify CML-DEMO-61003 — is this product certified under BIS? |
| **Data anchor** | `CML-DEMO-61003` |
| **API** | `npm run test:proof:06` |
| **Expected UI** | Verification card `data-testid="portal-verify-card"` — record found |
| **Clone proof** | `GET /api/registry/verify?cml=CML-DEMO-61003` → `found: true` |

- [ ] Pass

---

## Action 7 — Citizen: file complaint + proof

| Field | Value |
|--------|--------|
| **Persona** | Citizen |
| **Prompt** | I want to file a consumer complaint (guided: product, seller, invoice, description) |
| **Data anchor** | New `CMP-DEMO-*` |
| **API** | `npm run test:proof:07` |
| **Before** | Complaint ID absent in `GET /api/consumer/grievances` |
| **After** | New ticket **SUBMITTED**; admin PATCH → Investigation → user alert |
| **Portal** | Confirm flow; optional **My Alerts** |

- [ ] Pass

---

## Action 8 — Gold buyer: HUID verify + calculation

| Field | Value |
|--------|--------|
| **Persona** | Gold buyer |
| **Prompt** | Verify HUID-DM26-H29ZC6. Explain 22K/916 purity and calculate pure-gold value for 14.68 g at ₹7,000/g. Then verify HUID-DM26-Z99FLAG. |
| **Data anchor** | `HUID-DM26-H29ZC6`, `HUID-DM26-Z99FLAG` |
| **API** | `npm run test:proof:08` |
| **Expected UI** | Verify card + calculation ₹; second query **MISMATCH**, no calc |
| **Before → After** | N/A |

- [ ] Pass

---

## Action 9 — Academic: standard comparison

| Field | Value |
|--------|--------|
| **Persona** | Academic researcher |
| **Prompt** | Compare STD-DEMO-010 and STD-DEMO-011. Show old and current requirements, what changed, and sources. |
| **Data anchor** | `STD-DEMO-010` → `STD-DEMO-011` |
| **API** | `npm run test:proof:09` |
| **Expected UI** | Comparison table (`uiMode: comparison`) |
| **Before → After** | N/A |

- [ ] Pass

---

## Action 10 — Enforcement: inspection evidence

| Field | Value |
|--------|--------|
| **Persona** | Enforcement officer |
| **Prompt** | I am inspecting the manufacturer linked to SURV-DEMO-001. Check licence, standard, surveillance and ENF-DEMO-001. What evidence must I record if the helmet fails? |
| **Follow-up** | Log sealed sample + photos → **Confirm** |
| **Data anchor** | `SURV-DEMO-001`, `ENF-DEMO-001` |
| **API** | `npm run test:proof:10` |
| **Before** | Evidence history count = N |
| **After** | Evidence history N+1 on clone enforcement case |
| **Portal** | Case card + confirm table |

- [ ] Pass

---

## Portal sidebar smoke (non-agent)

| Page | Accept if |
|------|-----------|
| Home / chat | Loads; knowledge label = published cluster name |
| My Applications | Loads; shows app after Action 2 |
| My Alerts | Badge + list after Action 3 or 7 |
| Documents | Page loads |
| BIS Services | Tiles pre-fill chat |
| EN / HI / theme | Toggle works |

Playwright: `cd bis-mitra-user && npm run test:e2e`

---

## Failure → fix (quick)

| Symptom | Fix |
|---------|-----|
| Long RAG text, no compliance card | Publish `proof-actions-sandbox`; set admin `CLONE_API` |
| PDF 404 | `REND_CLONE_FILES`; admin clone-files proxy deployed |
| Open on BIS → localhost | `URL_BIS` on Vercel + admin `URL_BIS` in portal config |
| Insufficient evidence | Use seeded sandbox index, not live transform of full warehouse on Railway |
| Proof 02 confirm empty | Complete profile / lab report / declaration turns |
| No alert on Action 3 | Status PATCH on clone; alert scanner on admin |

---

## Success criteria

- All `test:proof:01` … `test:proof:10` pass against prod admin + clone with sandbox published.
- Live portal Action 1: compliance card + working source links.
- Actions 2–3: application + notification visible in portal and eBIS.

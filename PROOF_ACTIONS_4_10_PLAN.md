# BIS MITRA — Proof-of-Action Plan (Actions 4–10)

## Purpose

This plan extends the completed proof actions 1–3 with seven judge-visible demonstrations.
Every action must prove a real system path:

> Prompt → Agent capability → Data/tool → Confirmed action (when applicable) → eBIS/user portal change → Visible proof

The goal is not to build seven isolated demos. The goal is to reuse a small set of portal primitives and add only the minimum synthetic data or API behavior needed for deterministic proof.

## Scope and constraints

- Actions 1–3 are complete and are the reference implementation. Do not rebuild them.
- Use `proof-actions-sandbox` for all agent/RAG demonstrations.
- Prefer existing Clone APIs, SQLite tables, agent tools, cards, status history, and notification services.
- Never let the LLM invent a standard, QCO, AIR, licence, laboratory capability, legal consequence, or status.
- All mutations require deterministic confirmation outside the LLM.
- Every mutable proof gets a unique run suffix so repeated demos do not collide.
- Browser validation is shallow: one happy-path UI check per action. API/integration tests provide the detailed proof.
- Any required record not currently available is labelled **NEW DATA / NEW eBIS MODULE REQUIRED** below.

---

## Corrections to the original proposal

These changes make the demonstration logically sound:

1. **Action 6 uses a licence/CML, not a standard ID.** A standard identifies requirements; it does not prove that a particular product is certified. Use `CML-DEMO-61003` / `LIC-DEMO-26003` for product verification.
2. **Action 7 does not submit `CMP-DEMO-010` again.** That record already exists and is under investigation. Use it as a seeded tracking/flagged-HUID reference. A new submission must receive a new `CMP-DEMO-*` ID.
3. **Action 8 is the only HUID verification proof.** This avoids duplicating hallmarking in Action 6.
4. **Action 9 needs an explicit comparison dataset.** Supersession metadata alone cannot support detailed “what changed” claims.
5. **Action 10 separates advice from enforcement mutation.** Reading a case and recommending evidence is read-only. Logging evidence or issuing an order is a distinct, confirmation-gated step.
6. **No legal/compensation claim is calculated unless a verified rule dataset supports it.** The gold demonstration calculates metal value only from user-supplied price, weight, and verified fineness.

---

## Shared proof contract

Each action must produce a machine-readable proof receipt:

```json
{
  "proof_action": 4,
  "run_id": "PA4-<timestamp>",
  "prompt": "...",
  "route": "...",
  "tools": ["..."],
  "data_ids": ["..."],
  "before": {},
  "confirmation": null,
  "after": {},
  "portal_evidence": ["..."],
  "result": "PASS"
}
```

Save receipts under:

```text
bis-mitra-admin/data/proof-receipts/<run-id>.json
```

Receipts are test artifacts only; do not expose internal diagnostics in the user answer.

## Reusable UI primitives

Extend existing response cards instead of creating seven pages:

1. `verification` — identifier, match/mismatch, status, source, timestamp.
2. `checklist` — standard, QCO, requirements, documents, missing items, next step.
3. `matching` — ranked labs with scope, location, turnaround, sample needs.
4. `calculation` — verified inputs, formula, result, caveat.
5. `comparison` — old/current records and field-level changes.
6. `workflow` — record ID, status, timeline, next action.
7. `case` — manufacturer, licence, related cases, evidence, findings, actions.
8. Existing `confirmTable`, sources, notifications, applications, and alerts.

Add only fields needed by these cards to the existing `panel` contract. Do not create a second response protocol.

## Shared implementation strategy

### Data path

```text
Canonical synthetic data
→ bis-clone import/seed
→ Clone SQLite/API
→ Admin probe/tool
→ deterministic router
→ structured response panel
→ user/admin portal
```

### Mutation path

```text
User intent
→ collect missing fields
→ review table
→ explicit confirm
→ guarded write tool
→ Clone DB change
→ workflow event
→ notification
→ user-visible status/timeline
```

### Fast build order

1. Fix shared data/API inconsistencies.
2. Implement read-only proof cards (4, 5, 6, 8, 9, read half of 10).
3. Implement complaint write/event loop (7).
4. Implement enforcement evidence write (10).
5. Add one test file per action plus one aggregate runner.
6. Perform shallow browser checks after all API tests pass.

---

# Action 4 — Foreign Manufacturer Compliance

## Judge story

An overseas manufacturer asks about selling induction cooking appliances in India. The agent produces a grounded FMCS checklist tied to the exact standard and QCO.

## Prompt

> I manufacture induction cooking appliances outside India and want to sell them in India. What BIS requirements apply, which standard and QCO should I check, and what AIR, factory inspection, documents and testing evidence do I need?

## Existing anchors

- `STD-DEMO-003`
- `IS DEMO 1003:2025`
- `QCO-DEMO-003`
- `CERT-DEMO-003`
- `CML-DEMO-61003`
- Existing FMCS endpoints and tools:
  - `GET /api/fmcs`
  - `GET /api/fmcs/fees`
  - `GET /api/treaty`
  - `verify_import_compliance`
  - `check_qco_enforcement`
  - `generate_air_template`

## Required work

### **NEW DATA / NEW eBIS MODULE REQUIRED**

Add one canonical FMCS catalog record:

```text
FMCS-DEMO-003
Product: Domestic induction cooking appliance
Standard: IS DEMO 1003:2025
QCO: QCO-DEMO-003
Certification: Mandatory
AIR required: Yes
Factory inspection: Required
Testing: BIS-recognised laboratory
```

Include explicit document names and never infer treaty exemptions.

### Agent

- Route foreign-manufacturer questions to FMCS compliance before generic knowledge.
- Join FMCS record → standard → QCO → laboratory/testing requirement.
- Return `panel.checklist` with:
  - country
  - product
  - standard
  - QCO
  - AIR requirement
  - factory inspection
  - testing evidence
  - documents
  - application path
  - sources
- CTA: `Start Foreign Manufacturer Application`.
- Do not submit in this action; submission can be a later proof.

## Before → action → after

- **Before:** no result card is visible.
- **Action:** agent performs the standard/QCO/FMCS joins.
- **After:** foreign compliance checklist appears with three independent source references.

## Acceptance criteria

- Exactly `IS DEMO 1003:2025` and `QCO-DEMO-003` are returned.
- AIR and inspection claims come from `FMCS-DEMO-003`.
- No domestic-only Form-I guidance is shown.
- Missing country-specific treaty data is labelled unavailable.
- `Start Foreign Manufacturer Application` is advisory only.

## Test

Create `api/tests/agent/proof-action-04-fmcs.test.mjs`.

Assert route, IDs, citations, checklist fields, no invented legal claim, and no DB mutation.

---

# Action 5 — Find an Indian Testing Laboratory

## Judge story

The exporter asks for a laboratory. The agent performs a real standard/scope/location match and explains why the result matches.

## Prompt

> I need to test my induction cooking appliance in India. Find a BIS-recognised laboratory for IS DEMO 1003:2025 and tell me its scope, tests, equipment, sample requirements and turnaround.

## Existing anchors

- `LAB-DEMO-001`
- ApexLab Industrial Testing Centre
- `IS DEMO 1003:2025`
- `GET /api/labs`
- `suggest_testing_labs`
- `search_labs`

## Required work

- Add/normalize searchable fields only if absent:
  - recognised status
  - supported standard
  - city/state
  - test methods
  - equipment
  - sample requirements
  - turnaround days
- Return `panel.matching`, ranked by:
  1. exact standard scope
  2. active recognition
  3. requested location
  4. turnaround
- Show the matching reason, not just the lab name.

No new module is required unless the current API omits equipment/sample fields from its response.

## Before → action → after

- **Before:** an unfiltered list/count of labs.
- **Action:** match product standard and optional location.
- **After:** `LAB-DEMO-001` appears as the recommended lab with scope evidence and contact details.

## Acceptance criteria

- `LAB-DEMO-001` supports `IS DEMO 1003:2025`.
- Unsupported labs never appear as exact matches.
- Turnaround is shown only when present in data.
- Sources link to the lab record and relevant standard.
- Result remains read-only; no fake booking is claimed.

## Test

Create `api/tests/agent/proof-action-05-lab-match.test.mjs`.

Assert exact match, ranking rationale, complete fields, and rejection of a lab outside scope.

---

# Action 6 — Verify a Product Certification Record

## Judge story

A consumer verifies a specific certified appliance using its licence/CML identifier. The agent looks up the registry and explains the result in plain language.

## Prompt

> Verify CML-DEMO-61003 for my induction cooking appliance. Is the record genuine, which product and manufacturer does it cover, and what does the status mean?

## Existing anchors

- `CML-DEMO-61003`
- `LIC-DEMO-26003`
- `CERT-DEMO-003`
- `IS DEMO 1003:2025`
- `/api/registry/verify`
- `/api/certification-registry`
- `verify_registry_id`

## Required work

- Normalize lookup by `CML-DEMO-61003`, `LIC-DEMO-26003`, or certification ID.
- Return `panel.verification`:
  - searched identifier
  - found/not found
  - exact identifier match
  - manufacturer
  - product/model
  - applicable standard
  - licence status
  - source
  - verification timestamp
- Clearly distinguish:
  - genuine active record
  - found but expired/suspended
  - not found
  - identifier/product mismatch

### **NEW DATA / NEW eBIS MODULE REQUIRED**

Only if `CML-DEMO-61003` is not indexed in the registry table, add the missing registry row or index. Do not verify against `STD-DEMO-003` alone.

## Before → action → after

- **Before:** identifier has not been checked.
- **Action:** exact registry lookup.
- **After:** timestamped verification card with match/mismatch and source.

## Acceptance criteria

- The displayed product and manufacturer come from `CERT-DEMO-003`.
- The answer does not imply every product under the standard is certified.
- Unknown identifiers return `Not found`, never a nearest-neighbour record.
- HUID language is absent from this flow.

## Test

Create `api/tests/agent/proof-action-06-product-verify.test.mjs`.

Test active, unknown, and identifier/product mismatch cases.

---

# Action 7 — Complaint Submission, Tracking and Notification

## Judge story

A citizen files a complaint about a certification/HUID issue. The complaint appears in eBIS, an admin changes its status, and the citizen receives an alert.

## Prompts

Submission:

> The product I bought appears to have a certification or HUID problem. Help me file a complaint.

Tracking:

> What is the status of complaint CMP-DEMO-<new-id>?

## Existing anchors

- Seeded reference case `CMP-DEMO-010`
- Flagged HUID `HUID-DM26-Z99FLAG`
- Existing guided complaint intake and confirmation flow
- `POST /api/consumer/grievances`
- `grievance_status`
- Existing alert engine and workflow timeline

## Required work

### **NEW DATA / NEW eBIS MODULE REQUIRED**

1. New complaints must allocate `CMP-DEMO-<unique>` IDs instead of `CON-GRP-*`.
2. Add workflow/status history for every newly submitted complaint.
3. Add admin complaint status update endpoint/control:

```text
Submitted → Investigation → Resolved / Rejected
```

4. Emit `COMPLAINT_STATUS_CHANGED`.
5. Create a recipient-scoped user notification.
6. Add/extend an eBIS `Consumer Complaints` list so the new record is visibly absent before and present after.

Keep `CMP-DEMO-010` as a seeded investigation example; do not overwrite or resubmit it.

## Intake fields

- product
- seller
- purchase date
- complaint type
- description
- invoice/evidence
- photos (metadata is sufficient for the demo)
- contact information

## Before → action → after

1. **Before:** generated complaint ID is absent from eBIS.
2. **Action:** guided intake → review table → explicit confirmation → guarded submit.
3. **After submit:** complaint appears with `Submitted`.
4. **Admin action:** status changes to `Investigation`.
5. **User after:** notification and timeline show the same event, actor, and timestamp.

## Acceptance criteria

- No complaint is written before confirmation.
- The created row contains the session/user owner.
- Status history begins with `Submitted`.
- Admin change creates exactly one status event and one user notification.
- Another user cannot see the notification.
- Tracking returns the new complaint, not a canned demo record.

## Test

Extend the existing complaint test into:

`api/tests/agent/proof-action-07-complaint-loop.test.mjs`

The test must record count/ID before, submit, assert DB/API presence, update status, and assert notification.

---

# Action 8 — HUID Verification and Gold Value Calculation

## Judge story

A gold buyer verifies a HUID and receives a transparent value calculation based on verified weight/fineness and a user-provided market price.

## Prompt

> Verify HUID-DM26-H29ZC6. Explain 22K/916 purity and calculate the pure-gold-equivalent value for 14.68 g if today's 24K price is ₹7,000 per gram.

Negative prompt:

> Verify HUID-DM26-Z99FLAG.

## Existing anchors

- `HUID-DM26-H29ZC6`
- 22K / 916
- 14.68 g
- AsterBloom Jewels, Pune
- Demo Assaying Centre Pune
- `HUID-DM26-Z99FLAG`
- `/api/gold/huid/verify`
- `verify_huid_code`

## Required work

### **NEW DATA / DATA FIX REQUIRED**

The ledger currently treats `HUID-DM26-Z99FLAG` as verified while source data marks it flagged. Normalize the ledger/API to return:

```text
status: FLAGGED
verification_result: MISMATCH
reason: <seeded reason>
```

- Return `panel.verification` for HUID.
- Return `panel.calculation` only for a verified record.
- Deterministic formula:

```text
pure_gold_grams = gross_weight_grams × fineness / 1000
estimated_value = pure_gold_grams × user_price_per_gram_24k
```

- Display every input and formula.
- Label the result an estimate excluding making charges, tax, stones, and deductions.
- Do not calculate compensation or legal penalties.

## Before → action → after

- **Before:** HUID status unknown.
- **Action:** exact ledger lookup, then deterministic calculation using user price.
- **After:** verification, purity, and calculation cards with timestamped source.

## Acceptance criteria

- `H29ZC6` returns verified registry details.
- `Z99FLAG` returns flagged/mismatch and no valuation.
- 916 is explained as 91.6% fineness.
- Calculation is deterministic and unit-tested.
- No live market price is implied unless explicitly fetched from a trusted source.

## Test

Create `api/tests/agent/proof-action-08-huid-value.test.mjs`.

Cover verified, flagged, not-found, missing-price, and arithmetic cases.

---

# Action 9 — Historical Standard Comparison

## Judge story

A researcher compares a superseded standard to its replacement and sees a field-level, source-backed diff.

## Prompt

> Compare STD-DEMO-010 and STD-DEMO-011. Show the old and current requirements, what changed, and the source for each difference.

## Existing anchors

- `STD-DEMO-010` / `IS DEMO 1010:2023` / Superseded
- `STD-DEMO-011` / `IS DEMO 1011:2026` / Active
- Existing supersedes/superseded-by relationship
- `generate_revision_diff`
- `panel.comparison`

## Required work

### **NEW DATA / NEW eBIS MODULE REQUIRED**

Add a canonical comparison record (not model-generated prose):

```text
comparison_id
old_standard_id
new_standard_id
aspect
old_requirement
new_requirement
change_type
old_source_clause
new_source_clause
```

Populate only differences supported by the source standards. If a clause is unavailable, mark it `Not available in demo source`.

- Extend `/api/academic/revision-diff` to accept the two demo IDs.
- Return a structured `comparison` panel with old/current status and rows.
- Add an export action only after the on-screen comparison is valid; export may be JSON/CSV first, PDF later.

## Before → action → after

- **Before:** two independent standard records.
- **Action:** resolve historical relationship and fetch stored diff rows.
- **After:** comparison view with source clause per row and optional export artifact.

## Acceptance criteria

- Direction is always 010 → 011.
- Status is Superseded → Active.
- Every claimed change has two source references or an explicit missing-data marker.
- The LLM may simplify wording but cannot create diff rows.
- Reversing prompt order still renders old/current correctly.

## Test

Create `api/tests/agent/proof-action-09-standard-diff.test.mjs`.

Assert relationship, field-level rows, citations, missing-data handling, and deterministic export.

---

# Action 10 — Inspection, Evidence and Enforcement Case

## Judge story

An enforcement officer inspects a helmet manufacturer, retrieves the licence and previous surveillance failure, sees the required evidence checklist, and logs a new evidence item after confirmation.

## Prompt

Read/assessment:

> I am inspecting the manufacturer linked to SURV-DEMO-001. Check its licence, applicable standard, previous surveillance and ENF-DEMO-001. What evidence must I record if the helmet fails?

Write:

> Log a sealed sample and inspection photographs against ENF-DEMO-001.

## Existing anchors

- `SURV-DEMO-001`
- `ENF-DEMO-001`
- `IS DEMO 1001:2026`
- linked manufacturer/licence/lab/sample/evidence records
- `search_surveillance`
- `search_enforcement_cases`
- `verify_license_index`
- `log_raid_evidence`
- existing confirmation guard

## Required work

- Join surveillance → enforcement case → licence → standard → lab.
- Return `panel.case`:
  - manufacturer
  - licence and status
  - product/standard
  - previous surveillance
  - failed test/sample
  - existing evidence
  - evidence required
  - findings
  - actions
  - follow-up
  - case status
- Evidence guidance must come from seeded case/process data.
- Evidence write collects:
  - evidence type
  - description
  - sample/seal reference
  - attachment metadata
  - officer
  - timestamp
- Show review table and require confirmation.

### **NEW DATA / NEW eBIS MODULE REQUIRED**

If the seizure/evidence ledger cannot link rows to `ENF-DEMO-001`, add `case_id` and expose evidence history through the enforcement case API.

Do not include emergency sealing in the default happy path. Keep it as a separately confirmed high-risk demonstration.

## Before → action → after

1. **Before:** evidence item/run ID absent from `ENF-DEMO-001`.
2. **Action:** retrieve case context; collect evidence metadata; show review; confirm.
3. **After:** evidence appears in the case timeline with officer and timestamp.
4. Optional: create an admin/user alert that the case received new evidence.

## Acceptance criteria

- The case and surveillance records cross-link correctly.
- No evidence is written before confirmation.
- The model cannot invoke `log_raid_evidence`.
- New evidence is attached to `ENF-DEMO-001`, not a generic ledger.
- Duplicate submission with the same run ID is idempotent.
- Emergency seal remains separately gated and is never suggested as already executed.

## Test

Create `api/tests/agent/proof-action-10-enforcement.test.mjs`.

Assert joined context, before/after evidence count, confirmation gate, ownership/actor, idempotency, and no fabricated action claim.

---

## Implementation phases

### Phase 0 — Baseline lock (short)

- Run existing Actions 1–3 proof tests.
- Record current counts for complaints, HUID ledger, evidence ledger, and comparison rows.
- Keep all existing passing behavior.

### Phase 1 — Canonical data fixes

- Add `FMCS-DEMO-003`.
- Normalize registry lookup for `CML-DEMO-61003`.
- Fix `HUID-DM26-Z99FLAG` status.
- Add 010→011 comparison rows.
- Link enforcement evidence to `ENF-DEMO-001`.
- Re-import/seed once and verify IDs through Clone APIs.

### Phase 2 — Shared API/panel support

- Add checklist, matching, calculation, comparison, and case panel fields.
- Keep verification/workflow/confirm cards backward compatible.
- Add proof receipt utility.

### Phase 3 — Read-only actions first

- Implement and test 4, 5, 6, 8, 9, and Action 10 assessment.
- These are fast because they reuse existing probes and require no workflow mutation.

### Phase 4 — Transactional loops

- Implement Action 7 complaint status event/notification loop.
- Implement Action 10 evidence write/history loop.
- Reuse the certification confirmation, status history, and notification patterns.

### Phase 5 — Portal polish

- Add only the reusable cards needed by the structured panels.
- Ensure source links and timestamps are visible.
- Add one admin status control for complaints and one evidence-history view for enforcement.

### Phase 6 — Validation

- Run all existing agent/proof tests.
- Run proof actions 4–10 API tests.
- Perform one shallow browser happy path per action.
- Capture before/after screenshots only for mutable actions 7 and 10.

---

## Test and demo commands

Add scripts:

```json
{
  "test:proof:04": "node api/tests/agent/proof-action-04-fmcs.test.mjs",
  "test:proof:05": "node api/tests/agent/proof-action-05-lab-match.test.mjs",
  "test:proof:06": "node api/tests/agent/proof-action-06-product-verify.test.mjs",
  "test:proof:07": "node api/tests/agent/proof-action-07-complaint-loop.test.mjs",
  "test:proof:08": "node api/tests/agent/proof-action-08-huid-value.test.mjs",
  "test:proof:09": "node api/tests/agent/proof-action-09-standard-diff.test.mjs",
  "test:proof:10": "node api/tests/agent/proof-action-10-enforcement.test.mjs",
  "test:proof:4-10": "npm run test:proof:04 && npm run test:proof:05 && npm run test:proof:06 && npm run test:proof:07 && npm run test:proof:08 && npm run test:proof:09 && npm run test:proof:10"
}
```

Keep a separate browser smoke script. Do not make deep browser automation the correctness gate.

---

## Judge demo sequence

Use this order to minimize persona switches and waiting:

1. **Foreign exporter:** Action 4 checklist.
2. **Foreign exporter:** Action 5 lab match.
3. **Citizen:** Action 6 product verification.
4. **Citizen:** Action 7 complaint submission (leave admin status change for later).
5. **Gold buyer:** Action 8 verified HUID + value, then flagged HUID.
6. **Researcher:** Action 9 historical comparison.
7. **Enforcement officer:** Action 10 case assessment and confirmed evidence logging.
8. **Admin:** move Action 7 complaint to Investigation.
9. **Citizen:** refresh notifications and show complaint timeline.

This creates two strong before/action/after moments without slowing every read-only proof:

- Complaint absent → submitted → investigation notification.
- Evidence absent → confirmed write → visible in enforcement case history.

---

## Definition of done

- [ ] Actions 1–3 still pass.
- [ ] Every Action 4–10 prompt routes deterministically.
- [ ] Every factual claim is backed by a seeded record or marked unavailable.
- [ ] Actions 4–10 each generate a proof receipt.
- [ ] Actions 7 and 10 show a genuine before/after database and portal change.
- [ ] All writes require explicit user confirmation.
- [ ] Admin status changes create scoped notifications with actor and timestamp.
- [ ] Unknown identifiers never return nearest-match verification.
- [ ] HUID flagged status is consistent across source, DB, API, agent, and UI.
- [ ] Standard comparison contains no model-created differences.
- [ ] Gold valuation shows formula and inputs and makes no legal-compensation claim.
- [ ] Browser checks are shallow and pass for one happy path per action.
- [ ] `npm run test:proof:4-10` passes.

## Explicitly out of scope

- Production identity/authentication hardening.
- Real payment processing.
- Real BIS legal determinations.
- Live commodity-price integration.
- Full document OCR/upload storage beyond demo attachment metadata.
- Separate bespoke pages for every capability.
- Autonomous enforcement actions.


/**
 * End-to-end validation for Personas 5–8 (Gold, Lab, Academic, Enforcement).
 * Run: node test-personas-5-8-integration.js  (from bis-clone, after npm run seed)
 */
const API = process.env.CLONE_API || 'http://localhost:4000';

async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const failures = [];
  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (err) {
      console.error(`✗ ${name}: ${err.message}`);
      failures.push(name);
    }
  }

  // Persona 5 — Gold
  await test('G1. Decode 22K916 hallmark', async () => {
    const d = await get('/api/gold/hallmark/decode?stamp=22K916');
    assert(d.found, 'stamp not found');
    assert(/91\.6/.test(d.purity_percentage || ''), 'purity missing');
    assert(d.carat === 22, `carat=${d.carat}`);
  });

  await test('G2. Verify HUID A1B2C3', async () => {
    const d = await get('/api/gold/huid/verify?huid=A1B2C3');
    assert(d.found, 'HUID not found');
    assert(/Abha Jewels/i.test(d.jeweller_name || ''), 'jeweller missing');
  });

  await test('G3. Hallmark violation ENF-GOLD-9921', async () => {
    const d = await post('/api/v1/grievances/hallmark-violation', { complaint_details: 'Unhallmarked chains' });
    assert(/ENF-GOLD/.test(d.ticket_id || ''), 'ticket id missing');
  });

  await test('G4. Gold compensation calculator', async () => {
    const d = await post('/api/gold/compensation/calculate', { promised_carat: 22, actual_carat: 18, weight_grams: 20, paid_inr: 140000 });
    assert(d.total_compensation_inr >= 40000, `compensation=${d.total_compensation_inr}`);
    assert(d.net_value_deficit_inr > 0, 'deficit missing');
  });

  await test('Gold profile aggregate', async () => {
    const p = await get('/api/gold/profile');
    assert(p.sample_stamp?.stamp === '22K916', 'profile stamp');
  });

  // Persona 6 — Lab
  await test('L1. IS 1786 environmental limits', async () => {
    const d = await get('/api/lab/environmental-specs?is_number=IS%201786');
    assert(/27/.test(d.ambient_temp_c || ''), 'temp missing');
    assert(/65/.test(d.relative_humidity_pct || ''), 'humidity missing');
  });

  await test('L2. Log test certificate CERT-1786-992', async () => {
    const d = await post('/api/v1/labs/submit-certificate', { sample_id: 'S-992', value_mpa: 550 });
    assert(/CERT-1786/.test(d.cert_id || ''), 'cert id missing');
  });

  await test('L3. Validation delta row 14', async () => {
    const d = await get('/api/v1/validation/logs');
    assert(d.latest?.row_number === 14, 'row 14 missing');
    assert(/150\s*MPa/i.test(d.latest?.value_recorded || ''), 'value missing');
  });

  await test('L4. Blind cross-testing BLIND-X1', async () => {
    const d = await post('/api/lab/proficiency/init', { batch_id: 'BLIND-X1' });
    assert(d.batch_id === 'BLIND-X1', 'batch id');
    assert((d.labs || []).length >= 3, 'labs missing');
  });

  await test('Lab profile aggregate', async () => {
    const p = await get('/api/lab/profile');
    assert(p.environmental_spec, 'env spec');
  });

  // Persona 7 — Academic
  await test('A1. IS 2062 engineering table', async () => {
    const d = await get('/api/academic/engineering-table?is_number=IS%202062');
    assert(d.found, 'table not found');
    assert(d.rows?.length >= 3, 'rows missing');
  });

  await test('A2. Semester gazette updates', async () => {
    const d = await get('/api/academic/semester-updates');
    assert(d.count >= 2, `count=${d.count}`);
    assert(/16444|1554/.test(JSON.stringify(d.publications)), 'publications missing');
  });

  await test('A3. Insulation formula derivation', async () => {
    const d = await get('/api/academic/formula-derivation?topic=insulation');
    assert(/2E\s*\+\s*1000/.test(d.formula || ''), 'formula missing');
  });

  await test('A4. IS 4151 revision diff matrix', async () => {
    const d = await get('/api/academic/revision-diff?is_number=IS%204151');
    assert(d.diff_matrix?.length >= 3, 'diff rows missing');
  });

  // Persona 8 — Enforcement
  await test('E1. Raid evidence SEZ-CEMENT-992', async () => {
    const d = await post('/api/v1/enforcement/raid-evidence', { units: 500 });
    assert(/SEZ-CEMENT/.test(d.evidence_id || ''), 'evidence id');
  });

  await test('E2. Licence CM/L-8830112 SUSPENDED', async () => {
    const d = await get('/api/registry/verify?cml=8830112');
    assert(d.status === 'SUSPENDED', `status=${d.status}`);
  });

  await test('E3. HS 8504.40.90 border clearance', async () => {
    const d = await get('/api/enforcement/border-exemption?hs_code=8504.40.90');
    assert(d.found, 'HS not found');
    assert(/13252/.test(d.is_number || ''), 'IS mapping missing');
  });

  await test('E4. Emergency seal SEAL-2026-9921', async () => {
    const d = await post('/api/v1/enforcement/emergency-seal', { cml_number: '8830112' });
    assert(/SEAL-2026/.test(d.order_id || ''), 'order id');
  });

  await test('Enforcement profile aggregate', async () => {
    const p = await get('/api/enforcement/profile');
    assert(p.suspended_license?.cml_number === '8830112', 'suspended licence');
  });

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll personas 5–8 integration checks passed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

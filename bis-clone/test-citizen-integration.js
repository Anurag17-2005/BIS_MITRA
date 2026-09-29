/**
 * End-to-end validation for Everyday Citizen persona (8 requirements).
 * Run: node test-citizen-integration.js  (from bis-clone, after npm run seed)
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

  await test('1. IS 9873 toy safety limits', async () => {
    const rows = await get('/api/standards-catalog?q=9873');
    assert(rows.length >= 3, 'expected 3 IS 9873 parts');
    const part3 = rows.find(r => /part\s*3/i.test(r.part || r.title || ''));
    assert(part3, 'Part 3 row missing');
    assert(/90/.test(part3.chemical_limits || ''), 'Lead < 90 mg/kg missing');
    assert(/75/.test(part3.chemical_limits || ''), 'Cadmium < 75 mg/kg missing');
  });

  await test('2. Grievance submission CON-GRP-4401', async () => {
    const out = await post('/api/consumer/grievances', {
      merchant_name: 'PowerSafe Retail Electronics',
      product_category: 'Electrical Accessories',
      complaint_details: 'Extension board caught fire',
    });
    assert(out.ticket_id, 'no ticket_id');
    assert(/CON-GRP/.test(out.ticket_id), 'expected CON-GRP ticket');
  });

  await test('3. Grievance OFFICER_ASSIGNED tracking', async () => {
    const rows = await get('/api/consumer/grievances?ticket_id=CON-GRP-4401');
    assert(rows[0], 'grievance not found');
    assert(rows[0].status === 'OFFICER_ASSIGNED', `status=${rows[0].status}`);
    assert(/sample collection/i.test(rows[0].action || ''), 'missing sample collection action');
  });

  await test('4. Layman jargon dielectric', async () => {
    const rows = await get('/api/synonyms?q=dielectric');
    assert(rows.length > 0, 'no synonym rows');
    assert(/shock|barrier|insulation/i.test(rows[0].formal_terms || rows[0].notes || ''), 'plain translation missing');
  });

  await test('5. Dispute leverage G.S.R. 182(E)', async () => {
    const d = await get('/api/dispute-leverage?is_number=IS%202082');
    assert(d.found !== false, 'QCO row not found');
    assert(/182\(E\)|G\.S\.R/i.test(d.gazette_ref || d.dispute_leverage_text || ''), 'gazette ref missing');
    assert(/16|17|BIS Act/i.test(d.legal_statute || d.dispute_leverage_text || ''), 'penal statute missing');
  });

  await test('6. Registry CM/L-4151999 EXPIRED', async () => {
    const d = await get('/api/registry/verify?cml=4151999');
    assert(d.found, 'registry row not found');
    assert(/EXPIRED|COUNTERFEIT/i.test(d.status || ''), `status=${d.status}`);
    assert(/FakeArmor/i.test(d.factory || d.company_name || ''), 'FakeArmor factory missing');
  });

  await test('7. Hindi hallmarking rights', async () => {
    const d = await get('/api/bilingual-rights?topic=gold_hallmarking&lang=hi');
    assert(d.formatted_text || d.summary, 'no Hindi text');
    assert(/22K916|HUID|BIS|त्रिकोण/i.test(d.formatted_text || d.summary || ''), 'hallmarking points missing');
  });

  await test('8. Hazard alert HAZ-8802', async () => {
    const d = await post('/api/hazard-alerts', {
      product_name: 'Baby feeding bottles',
      hazard_category: 'Toxic Industrial Plastic',
      report_text: 'Toxic smell from unbranded bottles',
    });
    assert(d.hazard_id, 'no hazard_id');
    assert(/HAZ-/.test(d.hazard_id), 'expected HAZ-xxxx id');
  });

  await test('Citizen profile aggregate', async () => {
    const p = await get('/api/citizen/profile');
    assert(p.grievance_ticket, 'no grievance_ticket');
    assert(p.mandatory_standards?.length >= 1, 'no mandatory standards');
  });

  console.log(failures.length ? `\n${failures.length} failed: ${failures.join(', ')}` : '\nAll citizen integration checks passed.');
  process.exit(failures.length ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

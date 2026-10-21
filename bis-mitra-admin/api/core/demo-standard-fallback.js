/** Minimal clone-shaped rows when hosted clone DB lacks demo seed (until seed-demo-records runs). */
export const DEMO_HELMET_STANDARD = {
  is_number: 'IS DEMO 1001:2026',
  title: 'Industrial Safety Helmets - Performance and Marking',
  status: 'Active',
  mandatory_voluntary: 'Mandatory',
  demo_id: 'STD-DEMO-001',
  certification_applicability:
    'Certification applicable where the referenced product control order is in force.',
  qco_reference: 'QCO-DEMO-PPE-2026-01',
  description: [
    'Key requirements: Shell material shall maintain structural integrity after impact testing.',
    'Testing requirements: Impact attenuation test; Penetration resistance test; Retention-system performance test; Environmental conditioning before selected performance tests.',
    'Documentation required: Product specification sheet; Bill of materials or material declaration; Routine production inspection record; Relevant laboratory test report.',
  ].join('\n\n'),
  source_reference: 'BIS MITRA Demo → Standards → STD-DEMO-001',
  source_file: 'standards.pdf',
};

function sectionFromDescription(description, label) {
  const text = String(description || '');
  const match = text.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n\\n[A-Z][^:]+:|$)`, 'i'));
  return match?.[1]?.split(';').map((item) => item.trim()).filter(Boolean) || [];
}

/** Lists for compliance panel when clone DB description lacks section headers. */
export function demoHelmetComplianceLists(description) {
  const fromDesc = {
    requirements: sectionFromDescription(description, 'Key requirements'),
    tests: sectionFromDescription(description, 'Testing requirements'),
    documents: sectionFromDescription(description, 'Documentation required'),
  };
  if (fromDesc.tests.length && fromDesc.documents.length) return fromDesc;
  return {
    requirements: sectionFromDescription(DEMO_HELMET_STANDARD.description, 'Key requirements'),
    tests: sectionFromDescription(DEMO_HELMET_STANDARD.description, 'Testing requirements'),
    documents: sectionFromDescription(DEMO_HELMET_STANDARD.description, 'Documentation required'),
  };
}

export function appendDemoHelmetIfMissing(results, query) {
  const rows = Array.isArray(results) ? [...results] : [];
  const q = String(query || '');
  const needsHelmet = /helmet|IS DEMO 1001|STD-DEMO-001/i.test(q);
  if (!needsHelmet) return rows;
  if (rows.some((r) => r.demo_id === 'STD-DEMO-001' || /IS DEMO 1001/i.test(String(r.is_number)))) {
    return rows;
  }
  return [DEMO_HELMET_STANDARD, ...rows];
}

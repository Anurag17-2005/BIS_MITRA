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

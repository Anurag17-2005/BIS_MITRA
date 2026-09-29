export const PERSONAS = [
  { id: 'industry', short: 'Industry', label: 'Industry (Manufacturer)', icon: '🏭', agentMode: 'industry', density: 'medium' },
  { id: 'foreign_exporter', short: 'Foreign Exporter', label: 'Foreign Exporter', icon: '🌐', agentMode: 'industry', density: 'medium' },
  { id: 'citizen', short: 'Citizen', label: 'General Citizen', icon: '👤', agentMode: 'consumer', density: 'simple' },
  { id: 'gold_investor', short: 'Gold Buyer', label: 'Gold Buyer', icon: '💍', agentMode: 'consumer', density: 'simple' },
  { id: 'lab_testing', short: 'Laboratory', label: 'Laboratory', icon: '🔬', agentMode: 'industry', density: 'technical' },
  { id: 'academic', short: 'Researcher', label: 'Researcher', icon: '🎓', agentMode: 'industry', density: 'technical' },
  { id: 'enforcement', short: 'Enforcement Officer', label: 'Enforcement Officer', icon: '🛃', agentMode: 'industry', density: 'technical' },
  { id: 'bis_admin', short: 'BIS Officer', label: 'BIS Officer', icon: '🏛️', agentMode: 'industry', density: 'technical' },
];

export function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) || PERSONAS[0];
}

export const PROFILES = {
  industry: {
    name: 'Rahul Mehta',
    org: 'NovaShield Safety Products Pvt. Ltd.',
    city: 'Pune',
    products: 'Industrial safety helmet — Model NSH-1001',
    market: 'Maharashtra',
    udyam: 'UDYAM-MH-12-0012345',
    email: 'compliance@novashield.demo',
  },
  foreign_exporter: { name: 'A. Chen', org: 'Northwind Exports', city: '', products: '', country: '', air_name: '' },
  citizen: { name: 'Priya Shah', org: 'General public' },
  gold_investor: { name: 'Priya Shah', org: 'Jewellery buyer' },
  lab_testing: { name: 'Dr. S. Iyer', org: 'NABL applicant laboratory' },
  academic: { name: 'Dr. S. Iyer', org: 'Standards research' },
  enforcement: { name: 'Inspector Kulkarni', org: 'BIS Enforcement', city: '', products: '', market: '', udyam: '' },
  bis_admin: {
    name: 'Case Officer',
    org: 'BIS Certification',
    city: 'New Delhi',
    desk: 'Product certification queue',
    role: 'Case Officer',
  },
};

export function profileFor(id) {
  return PROFILES[id] || { name: 'BIS user', org: 'Bureau of Indian Standards' };
}

export const QUICK_BY_PERSONA = {
  industry: [
    { icon: '📘', label: 'Helmet compliance', prompt: 'I manufacture industrial safety helmets. What BIS standard applies to my product, is certification mandatory, and what tests and documents do I need?' },
    { icon: '✓', label: 'Mandatory?', prompt: 'Is certification mandatory for industrial safety helmets under IS DEMO 1001:2026?' },
    { icon: '🗺️', label: 'Certification steps', prompt: 'What is the BIS certification process for my industrial safety helmet?' },
    { icon: '📝', label: 'Apply now', prompt: 'I want to apply for certification for my industrial safety helmet. Help me complete and submit the application.' },
    { icon: '▣', label: 'Application status', prompt: 'What is the status of my BIS certification application BIS-APP-CERT-DEMO-001?' },
    { icon: '🧪', label: 'Tests required', prompt: 'What tests do I need to perform for IS 2082 water heater certification?' },
    { icon: '💰', label: 'Fee estimate', prompt: 'Calculate the BIS marking fees for my water heater application.' },
    { icon: '🔬', label: 'Lab near Pune', prompt: 'Which BIS recognised laboratory near Pune can test my water heater?' },
  ],
  foreign_exporter: [
    { icon: '🚢', label: 'FMCS requirements', prompt: 'What are the FMCS requirements to export to India?' },
    { icon: '📋', label: 'Start application', prompt: 'I want to apply for an FMCS licence' },
    { icon: '🔍', label: 'Check status', prompt: 'What is the status of my FMCS application?' },
  ],
  citizen: [
    { icon: '💬', label: 'File a Complaint', prompt: 'I want to file a consumer complaint about a defective product' },
    { icon: '🔎', label: 'Verify product', prompt: 'How do I check if a product has a genuine BIS mark?' },
    { icon: '📘', label: 'Safety guidance', prompt: 'What safety checks should I do before buying a helmet?' },
  ],
  gold_investor: [
    { icon: '💎', label: 'Verify HUID', prompt: 'Verify HUID A1B2C3' },
    { icon: '💍', label: 'Hallmark meaning', prompt: 'What does the 22K916 hallmark stamp mean?' },
    { icon: '⚠️', label: 'Report jeweller', prompt: 'I want to report a jeweller selling gold without HUID' },
  ],
  lab_testing: [
    { icon: '🔬', label: 'Lab recognition', prompt: 'How do I apply for BIS laboratory recognition?' },
    { icon: '🧪', label: 'Inspection status', prompt: 'What is the status of my laboratory recognition application?' },
    { icon: '📘', label: 'Test requirements', prompt: 'What are the room conditions for IS 1786 mechanical tests?' },
  ],
  academic: [
    { icon: '📘', label: 'Open a standard', prompt: 'What is IS 2925:1984?' },
    { icon: '⇄', label: 'Compare standards', prompt: 'Compare IS 2925:1984 and IS 2925 (Part 1):2019' },
    { icon: '📄', label: 'Related documents', prompt: 'Show related documents for helmet standards' },
  ],
  enforcement: [
    { icon: '🛃', label: 'Open a case', prompt: 'Show the status of enforcement case ENF-RAID-001' },
    { icon: '🔎', label: 'Verify licence', prompt: 'Is licence CM/L-8830112 active or suspended?' },
    { icon: '📘', label: 'Related standard', prompt: 'Which standard applies to this seized helmet consignment?' },
  ],
  bis_admin: [
    { icon: '▣', label: 'Waiting cases', prompt: 'Which certification applications are waiting for action?' },
    { icon: '🔬', label: 'Delayed tests', prompt: 'Which laboratory tests are delayed?' },
    { icon: '📘', label: 'Amendments', prompt: 'Which amendments affect active licences?' },
  ],
};

import { BIS_WEB, MANAK_APPLICATIONS_URL, librarySectionFromSource, openOnBisUrl } from './bisUrls';

export { MANAK_APPLICATIONS_URL, openOnBisUrl, librarySectionFromSource };

function docRow(row) {
  const section = row.librarySection || librarySectionFromSource(row);
  return {
    ...row,
    librarySection: section,
    bisUrl: row.bisUrl || openOnBisUrl({ ...row, librarySection: section }),
  };
}

export const APPLICATIONS = {
  industry: [
    { id: 'BIS-APP-CERT-DEMO-001', type: 'Product Certification', product: '25L electric storage water heater', status: 'Under Review', stage: 'Officer reviewing Form-I', submitted: '15 Sep 2026', tone: 'amber' },
    { id: 'LAB-APP-DEMO-001', type: 'Laboratory Recognition', product: 'NABL scope', status: 'Inspection Scheduled', stage: 'Inspection on 29 Sep 2026', submitted: '10 Aug 2026', tone: 'blue' },
    { id: 'CML-DEMO-61001', type: 'Licence / CML', product: 'Safety Helmet', status: 'Granted', stage: 'Valid till 11 Aug 2027', submitted: '11 Aug 2025', tone: 'green' },
  ],
  foreign_exporter: [
    { id: 'FMCS-APP-DEMO-014', type: 'FMCS', product: 'LED lamps', status: 'Under Review', stage: 'Factory audit pending', submitted: '02 Sep 2026', tone: 'amber' },
    { id: 'CRS-APP-DEMO-220', type: 'CRS', product: 'IT equipment', status: 'Documents required', stage: 'Upload test report', submitted: '18 Aug 2026', tone: 'orange' },
  ],
  citizen: [
    { id: 'CMP-DEMO-001', type: 'Consumer Complaint', product: 'Extension board', status: 'Officer assigned', stage: 'Awaiting inspection', submitted: '28 Sep 2026', tone: 'amber' },
  ],
  gold_investor: [
    { id: 'HUID-A1B2C3', type: 'HUID verification', product: 'Gold necklace', status: 'Verified', stage: 'Hallmarked · 22K916', submitted: '27 Sep 2026', tone: 'green' },
  ],
  lab_testing: [
    { id: 'LAB-APP-DEMO-001', type: 'Laboratory Recognition', product: 'Mechanical testing', status: 'Inspection Scheduled', stage: 'Inspection on 29 Sep 2026', submitted: '10 Aug 2026', tone: 'blue' },
  ],
  academic: [
    { id: 'RES-IS-2925', type: 'Standards research', product: 'IS 2925:1984', status: 'In progress', stage: 'Related documents ready', submitted: 'Today', tone: 'blue' },
  ],
  enforcement: [
    { id: 'ENF-RAID-001', type: 'Enforcement case', product: 'Uncertified helmets', status: 'Open', stage: 'Evidence logged', submitted: '26 Sep 2026', tone: 'red' },
  ],
  bis_admin: [
    { id: 'BIS-APP-CERT-DEMO-001', type: 'Product Certification', product: 'Water heater', status: 'Under Review', stage: 'Needs officer action', submitted: '15 Sep 2026', tone: 'amber' },
    { id: 'LAB-APP-DEMO-001', type: 'Laboratory test', product: 'Delayed sample', status: 'Delayed', stage: 'Lab report overdue', submitted: '01 Sep 2026', tone: 'orange' },
  ],
};

export const ALERTS_BY_PERSONA = {
  industry: [
    { id: 'a1', title: 'Application status changed', body: 'BIS-APP-CERT-DEMO-001 is now Under Review.', time: '2 hrs ago', tone: 'amber', tag: 'New' },
    { id: 'a2', title: 'Inspection scheduled', body: 'Factory inspection on 29 Sep 2026.', time: '1 day ago', tone: 'blue' },
    { id: 'a3', title: 'Licence renewal approaching', body: 'CML-DEMO-61001 expires on 11 Aug 2027.', time: '2 days ago', tone: 'orange' },
  ],
  foreign_exporter: [
    { id: 'f1', title: 'Factory audit pending', body: 'FMCS-APP-DEMO-014 is waiting for the factory audit.', time: '5 hrs ago', tone: 'amber', tag: 'New' },
    { id: 'f2', title: 'AIR document missing', body: 'Upload the Authorised Indian Representative letter.', time: '1 day ago', tone: 'orange' },
    { id: 'f3', title: 'Test report due', body: 'CRS-APP-DEMO-220 still needs the test report.', time: '2 days ago', tone: 'blue' },
  ],
  citizen: [
    { id: 'c1', title: 'Complaint officer assigned', body: 'CMP-DEMO-001 has an officer. Inspection is next.', time: '3 hrs ago', tone: 'amber', tag: 'New' },
    { id: 'c2', title: 'Bill received', body: 'Your uploaded bill is attached to CMP-DEMO-001.', time: '1 day ago', tone: 'blue' },
  ],
  gold_investor: [
    { id: 'g1', title: 'HUID checked', body: 'HUID-A1B2C3 is on the hallmark record.', time: '1 hr ago', tone: 'green', tag: 'New' },
    { id: 'g2', title: 'Purity note', body: 'Ask the jeweller for the assay slip before you pay.', time: '1 day ago', tone: 'amber' },
  ],
  lab_testing: [
    { id: 'l1', title: 'Inspection scheduled', body: 'LAB-APP-DEMO-001 inspection on 29 Sep 2026.', time: '6 hrs ago', tone: 'blue', tag: 'New' },
    { id: 'l2', title: 'Value outside limit', body: 'Sample ST-19 is outside the IS limit. Check before you submit.', time: '1 day ago', tone: 'orange' },
  ],
  academic: [
    { id: 'r1', title: 'Standard updated', body: 'A newer helmet safety text is available next to IS 4151.', time: '4 hrs ago', tone: 'blue', tag: 'New' },
    { id: 'r2', title: 'Comparison ready', body: 'IS 2925:1984 and the later part can be compared.', time: '2 days ago', tone: 'amber' },
  ],
  enforcement: [
    { id: 'e1', title: 'Case still open', body: 'ENF-RAID-001 has evidence logged and no notice yet.', time: '2 hrs ago', tone: 'red', tag: 'New' },
    { id: 'e2', title: 'Licence to check', body: 'Confirm the factory licence before you enter.', time: '1 day ago', tone: 'amber' },
  ],
  bis_admin: [
    { id: 'b1', title: 'Case waiting', body: 'BIS-APP-CERT-DEMO-001 is waiting for your action.', time: '1 hr ago', tone: 'amber', tag: 'New' },
    { id: 'b2', title: 'Lab test delayed', body: 'LAB-APP-DEMO-001 report is overdue.', time: '1 day ago', tone: 'orange' },
    { id: 'b3', title: 'Amendment flag', body: 'An amendment may affect active licences in your queue.', time: '2 days ago', tone: 'blue' },
  ],
};

export const ALERTS = ALERTS_BY_PERSONA.industry;

export const DOCUMENTS_BY_PERSONA = {
  industry: [
    docRow({ id: 'd-fee', title: 'FMCS fee matrix 2026', kind: 'BIS Official', meta: 'Fee schedule', size: 'PDF', storage_uri: 'knowledge/pdfs/schemes/fmcs-fee-matrix-2026.pdf' }),
    docRow({ id: 'd-proc', title: 'Certification process', kind: 'Procedure', meta: 'How to apply', size: 'Page', bisUrl: `${BIS_WEB}/product-certification/process`, librarySection: 'process' }),
  ],
  foreign_exporter: [
    docRow({ id: 'd-fmcs', title: 'FMCS scheme notification', kind: 'BIS Official', meta: 'Scheme text', size: 'PDF', storage_uri: 'knowledge/pdfs/schemes/fmcs-scheme-notification-2018.pdf' }),
    docRow({ id: 'd-air', title: 'AIR nomination', kind: 'Form', meta: 'Representative letter', size: 'PDF', storage_uri: 'knowledge/pdfs/schemes/fmcs-air-nomination-template.pdf' }),
  ],
  citizen: [
    docRow({ id: 'd-cmp', title: 'Complaint guidance', kind: 'BIS Official', meta: 'How to complain', size: 'Page', bisUrl: `${BIS_WEB}/consumer/complaints`, librarySection: 'consumer' }),
    docRow({ id: 'd-safe', title: 'Consumer safety PDFs', kind: 'BIS Official', meta: 'Safety tips', size: 'PDF', storage_uri: 'knowledge/pdfs/consumer/consumer-safety-guidance.pdf' }),
  ],
  gold_investor: [
    docRow({ id: 'd-gold', title: 'Hallmark guidance', kind: 'BIS Official', meta: 'What to check', size: 'Page', bisUrl: `${BIS_WEB}/consumer-guidance`, librarySection: 'hallmarking' }),
    docRow({ id: 'd-hm', title: 'Hallmarking manual', kind: 'BIS Official', meta: 'HUID rules', size: 'PDF', storage_uri: 'knowledge/pdfs/hallmarking/hallmarking-guidelines.pdf' }),
  ],
  lab_testing: [
    docRow({ id: 'd-lab', title: 'Laboratory recognition', kind: 'BIS Official', meta: 'LRS process', size: 'Page', bisUrl: `${BIS_WEB}/product-manuals`, librarySection: 'labs' }),
    docRow({ id: 'd-labpdf', title: 'Lab recognition checklist', kind: 'BIS Official', meta: 'Inspection', size: 'PDF', storage_uri: 'knowledge/pdfs/labs/lrs-checklist.pdf' }),
  ],
  academic: [
    docRow({ id: 'd-lib', title: 'Document library', kind: 'BIS Official', meta: 'Standards texts', size: 'Page', bisUrl: `${BIS_WEB}/library#standards`, librarySection: 'standards' }),
    docRow({ id: 'd-std', title: 'Standards meta pack', kind: 'BIS Official', meta: 'IS catalogue', size: 'PDF', storage_uri: 'knowledge/pdfs/standards-meta/standards-index.pdf' }),
  ],
  enforcement: [
    docRow({ id: 'd-enf', title: 'Compulsory certification', kind: 'BIS Official', meta: 'QCO list', size: 'Page', bisUrl: `${BIS_WEB}/product-certification/compulsory`, librarySection: 'schemes' }),
    docRow({ id: 'd-qco', title: 'QCO notification', kind: 'BIS Official', meta: 'Orders', size: 'PDF', storage_uri: 'knowledge/pdfs/schemes/qco-notification-sample.pdf' }),
  ],
  bis_admin: [
    docRow({ id: 'd-queue', title: 'Applications list', kind: 'eBIS', meta: 'Cases on Manak', size: 'Page', bisUrl: MANAK_APPLICATIONS_URL, librarySection: 'process' }),
    docRow({ id: 'd-man', title: 'Officer process manual', kind: 'BIS Official', meta: 'Case handling', size: 'PDF', storage_uri: 'knowledge/pdfs/manuals/officer-process-manual.pdf' }),
    docRow({ id: 'd-amend', title: 'Amendment notices', kind: 'BIS Official', meta: 'Active licences', size: 'PDF', storage_uri: 'knowledge/pdfs/schemes/amendment-notice-sample.pdf' }),
  ],
};

export const DOCUMENTS = DOCUMENTS_BY_PERSONA.industry;

export const SERVICES = [
  { icon: '📘', title: 'Standards & IS', text: 'Search and download Indian Standards', prompt: 'Help me find an Indian Standard' },
  { icon: '🏅', title: 'Product Certification', text: 'Apply for ISI Mark certification', prompt: 'I want to apply for BIS product certification' },
  { icon: '📄', title: 'Licence / CML', text: 'Check licence status and details', prompt: 'Check my BIS licence status' },
  { icon: '💬', title: 'Consumer Complaint', text: 'File a complaint and track status', prompt: 'I want to file a consumer complaint' },
  { icon: '💎', title: 'Hallmarking', text: 'Verify HUID and jewellery details', prompt: 'Verify a gold HUID hallmark' },
  { icon: '🔬', title: 'Laboratory Recognition', text: 'Apply for laboratory recognition', prompt: 'How do I apply for laboratory recognition?' },
];

export function modeFromResponse(res) {
  const intent = res?.router?.intent || res?.intent;
  if (intent === 'workflow_status' || intent === 'status') return 'Status';
  const ui = res?.uiMode || res?.router?.uiMode;
  const map = {
    workflow: 'Workflow',
    verification: 'Verification',
    comparison: 'Comparison',
    alert: 'Alert',
    status: 'Status',
    knowledge: 'Knowledge',
    advice: 'Advice',
  };
  const base = map[ui] || '';
  const mods = (res?.modules || []).map((m) => m.label).filter(Boolean);
  if (mods.length) return `${base || 'MITRA'} · ${mods.join(' · ')}`;
  return base;
}

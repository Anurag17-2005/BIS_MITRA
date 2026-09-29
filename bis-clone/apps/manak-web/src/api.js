const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function login(email, password, captcha) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, captcha }),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json();
}

export async function fetchMarkingFees(q) {
  const url = q ? `${API}/api/marking-fees?q=${encodeURIComponent(q)}` : `${API}/api/marking-fees`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchCertificationList() {
  const res = await fetch(`${API}/api/certification-list`);
  return res.json();
}

export async function submitFormI(payload) {
  const res = await fetch(`${API}/api/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: payload.factory_name,
      factory_name: payload.factory_name,
      udyam_id: payload.udyam_id,
      lab_report_ref: payload.lab_report_ref,
      is_number: payload.is_number,
      product_name: payload.product_name,
    }),
  });
  if (!res.ok) throw new Error('Form-I submission failed');
  return res.json();
}

export async function fetchApplications() {
  const [schemeI, fmcs] = await Promise.all([
    fetch(`${API}/api/applications`).then((r) => r.json()).catch(() => []),
    fetch(`${API}/api/fmcs/applications`).then((r) => r.json()).catch(() => []),
  ]);
  const a = Array.isArray(schemeI) ? schemeI.map((row) => ({ ...row, scheme: 'scheme-i' })) : [];
  const b = Array.isArray(fmcs) ? fmcs.map((row) => ({ ...row, scheme: 'fmcs' })) : [];
  return [...a, ...b].sort((x, y) => String(y.submitted_at || '').localeCompare(String(x.submitted_at || '')));
}

export async function patchApplicationStatus(
  referenceId,
  status,
  scheme = 'scheme-i',
  changedBy = 'Demo BIS Certification Officer',
) {
  const path = scheme === 'fmcs'
    ? `/api/fmcs/applications/${encodeURIComponent(referenceId)}`
    : `/api/applications/${encodeURIComponent(referenceId)}`;
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, changed_by: changedBy }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Status update failed');
  }
  return res.json();
}

export async function fetchOrgProfile(orgId = 'DEMO_MSME') {
  const res = await fetch(`${API}/api/org/${encodeURIComponent(orgId)}`);
  if (!res.ok) throw new Error('Org profile fetch failed');
  return res.json();
}

export async function fetchGrievances() {
  const res = await fetch(`${API}/api/consumer/grievances`);
  if (!res.ok) throw new Error('Grievances fetch failed');
  return res.json();
}

export async function patchGrievanceStatus(ticketId, status, changedBy = 'Demo BIS Consumer Officer') {
  const res = await fetch(`${API}/api/consumer/grievances/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, changed_by: changedBy, note: `Status set to ${status}` }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Complaint status update failed');
  }
  return res.json();
}

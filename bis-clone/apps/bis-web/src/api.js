const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const FILES = import.meta.env.VITE_FILES_URL || 'http://localhost:4000/files';

export { API, FILES };

export async function fetchManuals(q) {
  const url = q ? `${API}/api/product-manuals?q=${encodeURIComponent(q)}` : `${API}/api/product-manuals`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchProcessDocs() {
  const res = await fetch(`${API}/api/process-documents`);
  return res.json();
}

export async function fetchDocuments(domain) {
  const url = domain
    ? `${API}/api/documents?domain=${encodeURIComponent(domain)}`
    : `${API}/api/documents`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchCompulsoryProducts(q) {
  const url = q ? `${API}/api/compulsory-products?q=${encodeURIComponent(q)}` : `${API}/api/compulsory-products`;
  const res = await fetch(url);
  return res.json();
}

export async function submitApplication(data) {
  const res = await fetch(`${API}/api/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchNews() {
  const res = await fetch(`${API}/api/news`);
  return res.json();
}

export async function createNews(body) {
  const res = await fetch(`${API}/api/news`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function updateNews(id, body) {
  const res = await fetch(`${API}/api/news/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function deleteNews(id) {
  const res = await fetch(`${API}/api/news/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function patchManual(id, body) {
  const res = await fetch(`${API}/api/product-manuals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function runDemoAction(actionId) {
  const res = await fetch(`${API}/api/demo/actions/${actionId}`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function publishAmendment() {
  const res = await fetch(`${API}/api/demo/publish-amendment`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchGuidance(q) {
  const url = q ? `${API}/api/guidance?q=${encodeURIComponent(q)}` : `${API}/api/guidance`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchConsumerTopics(q) {
  const url = q ? `${API}/api/consumer?q=${encodeURIComponent(q)}` : `${API}/api/consumer`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchQcoOrders(q) {
  const url = q ? `${API}/api/qco?q=${encodeURIComponent(q)}` : `${API}/api/qco`;
  const res = await fetch(url);
  return res.json();
}

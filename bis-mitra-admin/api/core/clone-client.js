const CLONE_API = process.env.CLONE_API || 'http://localhost:4000';

export function getCloneApiBase() {
  return CLONE_API.replace(/\/$/, '');
}

export async function fetchClone(path) {
  const url = `${getCloneApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Clone API ${res.status} for ${url}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  return res.json();
}

export async function fetchClonePost(path, body) {
  const url = `${getCloneApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Clone API POST ${res.status} for ${url}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  return res.json();
}

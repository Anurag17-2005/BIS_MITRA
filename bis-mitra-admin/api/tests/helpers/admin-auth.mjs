import { ADMIN, fetchJson } from './http.mjs';

let cachedHeaders = null;

/** Bearer token when admin auth is enabled; JSON headers only when auth is disabled. */
export async function getAdminHeaders() {
  if (cachedHeaders) return { ...cachedHeaders };

  const base = { 'Content-Type': 'application/json' };
  const password = process.env.ADMIN_PASSWORD || 'mitra';
  const { ok, body } = await fetchJson(`${ADMIN}/api/login`, {
    method: 'POST',
    headers: base,
    body: JSON.stringify({ password }),
  });

  if (ok && body.token) {
    cachedHeaders = { ...base, Authorization: `Bearer ${body.token}` };
  } else {
    cachedHeaders = base;
  }
  return { ...cachedHeaders };
}

export function clearAuthCache() {
  cachedHeaders = null;
}

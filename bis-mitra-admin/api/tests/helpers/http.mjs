import assert from 'node:assert/strict';

export const ADMIN = (process.env.ADMIN_API || 'http://localhost:5050').replace(/\/$/, '');
export const CLONE = (process.env.CLONE_API || 'http://localhost:4000').replace(/\/$/, '');
export const TEST_CLUSTER = process.env.TEST_CLUSTER || 'proof-actions-sandbox';

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body, response };
}

export async function json(url, options = {}) {
  const { ok, body, status } = await fetchJson(url, options);
  assert.equal(ok, true, `${url}: ${body.error || status}`);
  return body;
}

export async function jsonAllowFail(url, options = {}) {
  return fetchJson(url, options);
}

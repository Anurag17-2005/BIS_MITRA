import assert from 'node:assert/strict';

export const ADMIN = process.env.ADMIN_API || 'http://localhost:5050';
export const CLONE = process.env.CLONE_API || 'http://localhost:4000';
export const CLUSTER = process.env.TEST_CLUSTER || 'proof-actions-sandbox';

export async function json(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, `${url}: ${body.error || response.statusText}`);
  return body;
}

export function chat(message, extra = {}) {
  const suffix = extra.suffix || `${Date.now()}`.slice(-6);
  const sessionId = extra.sessionId || `proof-${suffix}`;
  const userId = extra.userId || 'citizen';
  const persona = extra.personaMode || extra.userPersona || 'citizen';
  return json(`${ADMIN}/api/agent/chat`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      clusterId: CLUSTER,
      personaMode: persona,
      userPersona: persona,
      sessionId,
      userId,
      language: 'en',
      conversationId: extra.conversationId || `proof-${suffix}`,
      userProfile: extra.userProfile || {},
      ...extra,
    }),
  });
}

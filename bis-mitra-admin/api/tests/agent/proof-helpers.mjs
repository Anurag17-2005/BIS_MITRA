import { ADMIN, CLONE, TEST_CLUSTER, json } from '../helpers/http.mjs';

export const CLUSTER = TEST_CLUSTER;
export { ADMIN, CLONE, json };

export function chat(message, extra = {}) {
  const suffix = extra.suffix || `${Date.now()}`.slice(-6);
  const sessionId = extra.sessionId || `proof-${suffix}`;
  const userId = extra.userId || 'citizen';
  const persona = extra.personaMode || extra.userPersona || 'citizen';
  const clusterId = extra.clusterId || CLUSTER;
  return json(`${ADMIN}/api/agent/chat`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      clusterId,
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

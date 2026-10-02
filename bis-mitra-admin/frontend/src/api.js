import { config } from './config.js';

export const API_BASE = config.apiUrl;
const API = API_BASE;
const TOKEN_KEY = 'mitra_admin_token';
const SESSION_KEY = 'mitra_user_session_id';

export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess-${crypto.randomUUID().slice(0, 12)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function headers(json = true) {
  const h = {};
  const t = getToken();
  if (t) h.Authorization = `Bearer ${t}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function parseJson(res) {
  if (res.status === 401) {
    setToken('');
    throw new Error('Unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

export async function getPortalConfig() {
  const res = await fetch(`${API}/api/portal/config`);
  return parseJson(res);
}

export async function login(password) {
  const res = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return parseJson(res);
}

export async function getStatus() {
  const res = await fetch(`${API}/api/status`, { headers: headers(false) });
  return parseJson(res);
}

export async function getClusters() {
  if (!API) throw new Error('ADMIN_API_URL is not set (rebuild admin UI on Vercel with env vars).');
  const res = await fetch(`${API}/api/clusters`, { headers: headers(false) });
  const data = await parseJson(res);
  return Array.isArray(data) ? data : [];
}

export async function publishCluster(clusterId, published = true) {
  const res = await fetch(`${API}/api/clusters/${clusterId}/publish`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ published }),
  });
  return parseJson(res);
}

export async function createCluster(name, description = '') {
  const res = await fetch(`${API}/api/clusters`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name, description }),
  });
  return parseJson(res);
}

export async function renameCluster(clusterId, body) {
  const res = await fetch(`${API}/api/clusters/${clusterId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function clearClusterData(clusterId) {
  const res = await fetch(`${API}/api/clusters/${clusterId}/clear-data`, {
    method: 'POST',
    headers: headers(),
  });
  return parseJson(res);
}

export async function deleteCluster(clusterId) {
  const res = await fetch(`${API}/api/clusters/${clusterId}`, {
    method: 'DELETE',
    headers: headers(false),
  });
  return parseJson(res);
}

export async function getPlans(clusterId) {
  const res = await fetch(`${API}/api/clusters/${clusterId}/plans`, { headers: headers(false) });
  return parseJson(res);
}

export async function getWarehouse(clusterId, filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API}/api/clusters/${clusterId}/warehouse?${params}`, { headers: headers(false) });
  return parseJson(res);
}

export async function getFreshness(clusterId) {
  const res = await fetch(`${API}/api/clusters/${clusterId}/freshness`, { headers: headers(false) });
  return parseJson(res);
}

export async function getHistory(clusterId) {
  const res = await fetch(`${API}/api/clusters/${clusterId}/history`, { headers: headers(false) });
  return parseJson(res);
}

export async function getPlan(planId) {
  const res = await fetch(`${API}/api/plans/${planId}`, { headers: headers(false) });
  return parseJson(res);
}

export async function updatePlan(planId, body) {
  const res = await fetch(`${API}/api/plans/${planId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function runPlan(planId, queries) {
  const res = await fetch(`${API}/api/plans/${planId}/run`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ queries }),
  });
  return parseJson(res);
}

export async function rollbackPlan(planId) {
  const res = await fetch(`${API}/api/plans/${planId}/rollback`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({}),
  });
  return parseJson(res);
}

export async function runPlansBulk(planIds, queriesByPlan) {
  const res = await fetch(`${API}/api/plans/run-bulk`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ planIds, queriesByPlan }),
  });
  return parseJson(res);
}

export async function bulkConfigPlan(planIds, method, schedule) {
  const res = await fetch(`${API}/api/plans/bulk`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({
      planIds,
      method: method && method !== 'keep' ? method : 'keep',
      schedule,
    }),
  });
  return parseJson(res);
}

export async function prefetchCluster(clusterId, skipScript = false) {
  const res = await fetch(`${API}/api/clusters/${clusterId}/prefetch`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ skipScript }),
  });
  return parseJson(res);
}

export async function addQuery(planId, query) {
  const res = await fetch(`${API}/api/plans/${planId}/queries`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ query }),
  });
  return parseJson(res);
}

export async function deleteWarehouseItem(itemId) {
  const res = await fetch(`${API}/api/warehouse/${itemId}`, {
    method: 'DELETE',
    headers: headers(false),
  });
  return parseJson(res);
}

export async function getWarehouseLineage(itemId) {
  const res = await fetch(`${API}/api/warehouse/${encodeURIComponent(itemId)}/lineage`, {
    headers: headers(false),
  });
  return parseJson(res);
}

export async function getClusterTrust(clusterId) {
  const res = await fetch(`${API}/api/clusters/${clusterId}/trust`, { headers: headers(false) });
  return parseJson(res);
}

export async function getClusterQuarantine(clusterId) {
  const res = await fetch(`${API}/api/clusters/${clusterId}/quarantine`, { headers: headers(false) });
  return parseJson(res);
}

export async function getTransformOverview() {
  const res = await fetch(`${API}/api/transform/overview`, { headers: headers(false) });
  return parseJson(res);
}

export async function getTransformStatus(clusterId) {
  const res = await fetch(`${API}/api/transform/${clusterId}/status`, { headers: headers(false) });
  return parseJson(res);
}

export async function getTransformGoldenGrouped(clusterId) {
  const res = await fetch(`${API}/api/transform/${clusterId}/golden?grouped=1`, { headers: headers(false) });
  return parseJson(res);
}

export async function getTransformChunksGrouped(clusterId) {
  const res = await fetch(`${API}/api/transform/${clusterId}/chunks?grouped=1`, { headers: headers(false) });
  return parseJson(res);
}

export async function getTransformGolden(clusterId, { limit = 50, offset = 0 } = {}) {
  const res = await fetch(
    `${API}/api/transform/${clusterId}/golden?limit=${limit}&offset=${offset}`,
    { headers: headers(false) }
  );
  return parseJson(res);
}

export async function getTransformGoldenRecord(clusterId, warehouseItemId) {
  const res = await fetch(
    `${API}/api/transform/${clusterId}/golden/${encodeURIComponent(warehouseItemId)}`,
    { headers: headers(false) }
  );
  return parseJson(res);
}

export async function getTransformChunks(clusterId, opts = {}) {
  const params = new URLSearchParams(opts);
  const res = await fetch(`${API}/api/transform/${clusterId}/chunks?${params}`, { headers: headers(false) });
  return parseJson(res);
}

export async function runTransform(clusterId, stage = 'incremental') {
  const res = await fetch(`${API}/api/transform/${clusterId}/run`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ stage }),
  });
  return parseJson(res);
}

export async function searchTransformIndex(clusterId, query, topK = 5, stage = 'live') {
  const res = await fetch(`${API}/api/transform/${clusterId}/search`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ query, topK, stage }),
  });
  return parseJson(res);
}

export async function promoteTransformIndex(clusterId) {
  const res = await fetch(`${API}/api/transform/${clusterId}/promote`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({}),
  });
  return parseJson(res);
}

export async function clearTransformData(clusterId, layers = ['golden', 'chunks', 'index']) {
  const res = await fetch(`${API}/api/transform/${clusterId}/clear`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ layers }),
  });
  return parseJson(res);
}

export async function agentChat(message, clusterId, options = {}) {
  const sessionId = options.sessionId || getSessionId();
  const res = await fetch(`${API}/api/agent/chat`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      message,
      clusterId,
      personaMode: options.personaMode,
      userPersona: options.userPersona,
      sessionId,
      userId: options.userId || options.userPersona || sessionId,
      liveProbe: options.liveProbe || 'auto',
      history: options.history,
    }),
  });
  return parseJson(res);
}

export async function getUserAlerts(sessionId, { unread = false, userId } = {}) {
  const q = new URLSearchParams({ sessionId });
  if (userId) q.set('userId', userId);
  if (unread) q.set('unread', '1');
  const res = await fetch(`${API}/api/agent/alerts?${q}`, { headers: headers(false) });
  return parseJson(res);
}

export async function getUserAlertUnreadCount(sessionId, userId = null) {
  const q = new URLSearchParams({ sessionId });
  if (userId) q.set('userId', userId);
  const res = await fetch(`${API}/api/agent/alerts/unread-count?${q}`, { headers: headers(false) });
  return parseJson(res);
}

export async function markUserAlertRead(alertId, sessionId) {
  const res = await fetch(`${API}/api/agent/alerts/${alertId}/read`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ sessionId }),
  });
  return parseJson(res);
}

export async function getDemoPrompts() {
  const res = await fetch(`${API}/api/agent/demo-prompts`, { headers: headers(false) });
  return parseJson(res);
}

export async function retrieveTest(query, clusterId, options = {}) {
  const res = await fetch(`${API}/api/agent/retrieve-test`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      query,
      clusterId,
      topK: options.topK ?? 8,
      history: options.history,
      filters: options.filters || {},
      mode: options.mode || 'hybrid',
      lexicalWeight: options.lexicalWeight ?? 0.55,
      denseWeight: options.denseWeight ?? 0.45,
      stage: options.stage || 'live',
    }),
  });
  return parseJson(res);
}

export async function getComplianceAlerts(unacknowledged = true, persona = null) {
  const q = new URLSearchParams({ unacknowledged: unacknowledged ? '1' : '0' });
  if (persona) q.set('persona', persona);
  const res = await fetch(`${API}/api/compliance/alerts?${q}`, { headers: headers(false) });
  return parseJson(res);
}

export async function getCloneProbe(toolName, query = '') {
  const res = await fetch(`${API}/api/agent/tools/${toolName}`, {
    method: 'POST',
    headers: headers(false),
    body: JSON.stringify({ query }),
  });
  return parseJson(res);
}

export async function runDemoAction(actionId) {
  const res = await fetch(`${API}/api/demo/actions/${actionId}`, {
    method: 'POST',
    headers: headers(false),
  });
  return parseJson(res);
}

export async function acknowledgeComplianceAlert(id) {
  const res = await fetch(`${API}/api/compliance/alerts/${id}/acknowledge`, {
    method: 'POST',
    headers: headers(false),
  });
  return parseJson(res);
}

export async function publishDemoAmendment() {
  const res = await fetch(`${API}/api/demo/publish-amendment`, {
    method: 'POST',
    headers: headers(false),
  });
  return parseJson(res);
}

export async function getCitizenProfile() {
  const res = await fetch(`${API}/api/citizen/profile`, { headers: headers(false) });
  return parseJson(res);
}

export async function getGoldProfile() {
  const res = await fetch(`${API}/api/gold/profile`, { headers: headers(false) });
  return parseJson(res);
}

export async function getLabProfile() {
  const res = await fetch(`${API}/api/lab/profile`, { headers: headers(false) });
  return parseJson(res);
}

export async function getEnforcementProfile() {
  const res = await fetch(`${API}/api/enforcement/profile`, { headers: headers(false) });
  return parseJson(res);
}

export async function getAcademicProfile() {
  const res = await fetch(`${API}/api/academic/profile`, { headers: headers(false) });
  return parseJson(res);
}

export async function getIndustryProfile(orgId = 'DEMO_MSME') {
  const res = await fetch(`${API}/api/industry/profile/${encodeURIComponent(orgId)}`, {
    headers: headers(false),
  });
  return parseJson(res);
}

export async function getAutomationStatus() {
  const res = await fetch(`${API}/api/automation/status`, { headers: headers(false) });
  return parseJson(res);
}

export async function getAutomationEvents(limit = 50) {
  const res = await fetch(`${API}/api/automation/events?limit=${limit}`, { headers: headers(false) });
  return parseJson(res);
}

export async function patchAutomation(body) {
  const res = await fetch(`${API}/api/automation`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function runAutomationNow(clusterId) {
  const res = await fetch(`${API}/api/automation/run-now`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(clusterId ? { clusterId } : {}),
  });
  return parseJson(res);
}

export async function uploadToSection(clusterId, domain, file, note = '') {
  const form = new FormData();
  form.append('domain', domain);
  form.append('file', file);
  if (note) form.append('note', note);
  const res = await fetch(`${API}/api/clusters/${clusterId}/warehouse/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  return parseJson(res);
}

export async function getRules(type = 'all', search = '') {
  const q = new URLSearchParams();
  if (type && type !== 'all') q.set('type', type);
  if (search) q.set('q', search);
  const qs = q.toString() ? `?${q}` : '';
  const res = await fetch(`${API}/api/rules${qs}`, { headers: headers(false) });
  return parseJson(res);
}

export async function getRule(id) {
  const res = await fetch(`${API}/api/rules/${id}`, { headers: headers(false) });
  return parseJson(res);
}

export async function createRule(rule) {
  const res = await fetch(`${API}/api/rules`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(rule),
  });
  return parseJson(res);
}

export async function updateRule(id, patch) {
  const res = await fetch(`${API}/api/rules/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(patch),
  });
  return parseJson(res);
}

export async function testRule(id, inputs) {
  const res = await fetch(`${API}/api/rules/${id}/test`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ inputs }),
  });
  return parseJson(res);
}

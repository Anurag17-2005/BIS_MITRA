import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { getStore, saveStore, updateClusterFileCounts, resetStore } from './store.js';
import { runPlanInternal, rollbackPlan } from './runner-core.js';
import { prefetchCluster } from './prefetch.js';
import { startScheduler } from './scheduler.js';
import { SECTIONS, sectionForPlan } from './sections.js';
import { saveUpload } from './upload.js';
import { FETCH_METHODS, applyMethodToPlan, normalizeFetchMethod, decoratePlan } from './methods.js';
import { enrichWarehouseItem } from './fileUrls.js';
import { serviceStatus } from './preflight.js';
import { sectionFreshness } from './freshness.js';
import { login as adminLogin, authMiddleware } from './auth.js';
import { createCluster, renameCluster, deleteCluster, clearClusterData } from './cluster-crud.js';
import {
  AGENT_TOOLS,
  executeAgentTool,
  listAgentTools,
  agentChat,
  retrieve,
  routeQuery,
  getIndexStatus,
  ROUTE_CONFIG,
  getToolRegistry,
  listRegistryTools,
} from './agent/index.js';
import { getContext, clearContext } from './context/context-store.js';
import {
  listAlerts,
  getUnreadCount,
  markAlertRead,
  getAlert,
} from './alerts/alert-store.js';
import { scanSessionAlerts, startAlertScanner } from './alerts/alert-engine.js';
import { notifyApplicationStatusChange } from './alerts/notify-application.js';
import { fetchClone } from './core/clone-client.js';
import { DEMO_PROMPTS } from './agent/demo-prompts.js';
import { llmConfigured, llmProvider, llmModelLabel } from './agent/llm.js';
import { registerTransformRoutes, promoteIndexToLive } from './transform-routes.js';
import { getLineage, getTrustSummary, listQuarantine } from './lineage.js';
import {
  getAutomationStatus,
  runAutoSync,
  runPostIngestTransform,
  startAutoSyncWatcher,
  defaultAutomationConfig,
} from './automation.js';
import {
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  resetRules,
} from './rules/rules-store.js';
import { executeRule } from './rules/rules-engine.js';
import { RULE_TYPES } from './rules/rules-defaults.js';
import { registerTranscribeRoutes } from './routes/transcribe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** Load KEY=VALUE from .env (no dotenv dep). Does not override existing env. */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(ROOT, '.env'));

const app = express();
const PORT = process.env.PORT || 5050;

const FETCH_DATA_PATH = process.env.FETCH_DATA_PATH
  || path.join(__dirname, '..', '..', 'bis-clone', 'data', 'fetched');
const CLONE_FILES = process.env.CLONE_FILES_PATH
  || path.join(__dirname, '..', '..', 'bis-clone', 'public', 'files');
const KNOWLEDGE_PDFS = process.env.KNOWLEDGE_PDFS_PATH
  || path.join(__dirname, '..', '..', 'bis-clone', 'data', 'knowledge', 'pdfs');
const UPLOADS_PATH = path.join(__dirname, '..', 'data', 'uploads');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());
app.use('/api/files', express.static(FETCH_DATA_PATH));
app.use('/api/clone-files/knowledge/pdfs', express.static(KNOWLEDGE_PDFS));
app.use('/api/clone-files', express.static(CLONE_FILES));
app.use('/api/uploads', express.static(UPLOADS_PATH));

app.post('/api/login', (req, res) => {
  try {
    res.json(adminLogin(req.body.password || ''));
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
  }
});

/** End-user portal routes (no maintainer token required) */
function isPortalPublicApi(path) {
  if (path === '/portal/config' || path === '/health') return true;
  if (path === '/transcribe' || path.startsWith('/transcribe/')) return true;
  if (path === '/agent/chat' || path === '/agent/demo-prompts') return true;
  if (path.startsWith('/agent/tools/')) return true;
  if (path === '/agent/alerts' || path.startsWith('/agent/alerts/')) return true;
  if (path === '/agent/application-status') return true;
  if (path === '/portal/applications') return true;
  if (path === '/compliance/alerts' || path.startsWith('/compliance/alerts/')) return true;
  if (path.startsWith('/demo/actions/')) return true;
  if (path === '/citizen/profile' || path === '/gold/profile' || path === '/lab/profile') return true;
  if (path === '/enforcement/profile' || path === '/academic/profile') return true;
  if (path.startsWith('/industry/profile/')) return true;
  return false;
}

app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/health') return next();
  if (isPortalPublicApi(req.path)) return next();
  if (
    req.path.startsWith('/files')
    || req.path.startsWith('/clone-files')
    || req.path.startsWith('/uploads')
  ) {
    return next();
  }
  return authMiddleware(req, res, next);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', cloneApi: process.env.CLONE_API || 'http://localhost:4000' });
});

app.get('/api/portal/config', (_req, res) => {
  const store = getStore();
  const published = store.clusters.find(c => c.published);
  res.json({
    publishedClusterId: published?.id || null,
    publishedClusterName: published?.name || null,
    cloneApi: process.env.CLONE_API || 'http://localhost:4000',
    stt: {
      enabled: Boolean(process.env.GROQ_API_KEY || process.env.SARVAM_API_KEY),
    },
  });
});

registerTranscribeRoutes(app, upload);

app.get('/api/status', async (_req, res) => {
  res.json(await serviceStatus());
});

app.get('/api/sections', (_req, res) => {
  res.json(SECTIONS);
});

app.get('/api/methods', (_req, res) => {
  res.json(FETCH_METHODS);
});

app.get('/api/agent/tools', (_req, res) => {
  res.json({ tools: listAgentTools(), schemas: AGENT_TOOLS });
});

app.post('/api/agent/tools/:toolName', async (req, res) => {
  try {
    const result = await executeAgentTool(req.params.toolName, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/agent/chat', async (req, res) => {
  try {
    const {
      message,
      clusterId,
      personaMode,
      userPersona,
      liveProbe,
      topK,
      history,
      sessionId,
      userId,
      language,
      userProfile,
      agentProfile,
      conversationId,
      confirmSubmit,
      confirmFields,
      chatModule,
    } = req.body || {};
    const result = await agentChat(message, {
      clusterId,
      personaMode,
      userPersona,
      liveProbe,
      topK,
      history,
      sessionId,
      userId,
      language,
      userProfile,
      agentProfile,
      conversationId,
      confirmSubmit,
      confirmFields,
      chatModule: chatModule === 'advice' ? 'advice' : 'knowledge',
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/agent/tools/registry', (_req, res) => {
  res.json({
    tools: listRegistryTools(),
    probePlans: listRegistryTools({ kind: 'probe' }).map(t => ({
      name: t.name,
      connector: t.connector,
      planId: t.planId,
      planName: t.planName,
    })),
    internalTools: listRegistryTools({ kind: 'internal' }).map(t => t.name),
  });
});

app.get('/api/agent/context/:sessionId', (req, res) => {
  const ctx = getContext(req.params.sessionId);
  if (!ctx) return res.status(404).json({ error: 'Session not found' });
  res.json(ctx);
});

app.delete('/api/agent/context/:sessionId', (req, res) => {
  res.json(clearContext(req.params.sessionId));
});

app.get('/api/agent/alerts', (req, res) => {
  const { sessionId, userId, unread } = req.query;
  res.json({
    alerts: listAlerts({
      sessionId,
      userId,
      unreadOnly: unread === '1' || unread === 'true',
    }),
    unread_count: getUnreadCount({ sessionId, userId }),
  });
});

app.get('/api/agent/alerts/unread-count', (req, res) => {
  const { sessionId, userId } = req.query;
  res.json({ unread_count: getUnreadCount({ sessionId, userId }) });
});

app.post('/api/agent/alerts/scan', async (req, res) => {
  try {
    const { sessionId, userId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const created = await scanSessionAlerts(sessionId, { userId });
    res.json({ created, unread_count: getUnreadCount({ sessionId, userId }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/agent/application-status', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await notifyApplicationStatusChange({
      referenceId: body.reference_id || body.referenceId,
      status: body.status,
      previousStatus: body.previous_status || body.previousStatus,
      sessionId: body.session_id || body.sessionId,
      userId: body.user_id || body.userId,
      persona: body.persona,
      product: body.product_name || body.product,
      changedBy: body.changed_by || body.changedBy,
      changedAt: body.changed_at || body.changedAt,
      recordType: body.record_type || body.recordType,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function mapCloneApp(row, scheme) {
  const status = row.status || 'Under Review';
  const tone = /grant|active|certified/i.test(status)
    ? 'green'
    : /reject/i.test(status)
      ? 'red'
      : /query|document/i.test(status)
        ? 'orange'
        : /inspect/i.test(status)
          ? 'blue'
          : 'amber';
  return {
    id: row.reference_id,
    type: scheme === 'fmcs' ? 'FMCS' : 'Product Certification',
    product: row.product_name || row.company_name || '',
    manufacturer: row.company_name || row.factory_name || '',
    status,
    stage: status,
    submitted: row.submitted_at || '',
    tone,
    is_number: row.is_number || '',
    status_history: Array.isArray(row.status_history) ? row.status_history : [],
    contact_email: row.contact_email || '',
    owner_user_id: row.owner_user_id,
    owner_session_id: row.owner_session_id,
    live: true,
  };
}

app.get('/api/portal/applications', async (req, res) => {
  try {
    const { sessionId, userId } = req.query;
    const [schemeI, fmcs] = await Promise.all([
      fetchClone('/api/applications').catch(() => []),
      fetchClone('/api/fmcs/applications').catch(() => []),
    ]);
    const rows = [
      ...(Array.isArray(schemeI) ? schemeI.map((r) => mapCloneApp(r, 'scheme-i')) : []),
      ...(Array.isArray(fmcs) ? fmcs.map((r) => mapCloneApp(r, 'fmcs')) : []),
    ];
    const mine = rows.filter((row) => {
      if (row.owner_session_id && sessionId && row.owner_session_id === sessionId) return true;
      if (row.owner_user_id && userId && row.owner_user_id === userId) return true;
      return false;
    });
    res.json({ applications: mine });
  } catch (err) {
    res.status(502).json({ error: err.message, applications: [] });
  }
});

app.get('/api/agent/alerts/:alertId', (req, res) => {
  const alert = getAlert(req.params.alertId);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json(alert);
});

app.post('/api/agent/alerts/:alertId/read', (req, res) => {
  const { sessionId } = req.body || {};
  res.json(markAlertRead(req.params.alertId, { sessionId }));
});

app.post('/api/agent/retrieve-test', async (req, res) => {
  try {
    const {
      query,
      clusterId,
      topK,
      history,
      filters,
      mode,
      lexicalWeight,
      denseWeight,
      stage,
    } = req.body || {};
    if (!query?.trim()) {
      return res.status(400).json({ error: 'query required' });
    }
    const prior = Array.isArray(history) ? history : [];
    const router = routeQuery(query.trim(), { history: prior });
    const retrieval = await retrieve(router.query, {
      clusterId,
      topK: topK || 8,
      stage: stage || 'live',
      history: prior,
      contextEntities: router.contextEntities,
      filters: filters || {},
      mode: mode || 'hybrid',
      lexicalWeight: lexicalWeight ?? 0.55,
      denseWeight: denseWeight ?? 0.45,
      includeTrace: true,
    });
    const indexStatus = getIndexStatus(clusterId);
    res.json({
      query: router.query,
      originalQuery: router.originalQuery || query.trim(),
      intent: router.intent,
      confidence: retrieval.confidence,
      strategy: retrieval.trace?.strategy || retrieval.retrieval_type,
      config: retrieval.trace?.config,
      understanding: {
        ...retrieval.trace?.understanding,
        intent: router.intent,
        isFollowUp: router.isFollowUp,
        capability: router.capability,
        tool: router.tool,
      },
      stages: retrieval.trace?.stages,
      counts: retrieval.counts,
      finalEvidence: retrieval.finalEvidence,
      sources: retrieval.sources,
      provenance: retrieval.provenance,
      insufficient_evidence: retrieval.insufficient_evidence,
      retrieval_type: retrieval.retrieval_type,
      latency_ms: retrieval.latency_ms,
      indexStatus,
      router: {
        intent: router.intent,
        capability: router.capability,
        tool: router.tool,
        dataSource: router.dataSource,
        uiMode: router.uiMode,
        confidence: router.confidence,
        isFollowUp: router.isFollowUp,
      },
      retrieval,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/agent/router-config', (_req, res) => {
  res.json({ intents: Object.keys(ROUTE_CONFIG), routes: ROUTE_CONFIG });
});

app.get('/api/rules', (req, res) => {
  const { type, q } = req.query;
  res.json({
    rules: listRules({ type, search: q }),
    types: RULE_TYPES,
  });
});

app.get('/api/rules/:id', (req, res) => {
  const rule = getRule(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  res.json(rule);
});

app.post('/api/rules', (req, res) => {
  try {
    const body = req.body || {};
    if (!body.id || !body.name || !body.type) {
      return res.status(400).json({ error: 'id, name, and type required' });
    }
    res.status(201).json(createRule(body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/rules/:id', (req, res) => {
  try {
    res.json(updateRule(req.params.id, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/rules/:id', (req, res) => {
  try {
    res.json(deleteRule(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/rules/:id/test', async (req, res) => {
  try {
    const rule = getRule(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(await executeRule(rule, req.body?.inputs || req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/rules/reset', (_req, res) => {
  res.json({ rules: resetRules() });
});

app.get('/api/agent/demo-prompts', (_req, res) => {
  res.json({
    prompts: DEMO_PROMPTS,
    llmConfigured: llmConfigured(),
    llmProvider: llmProvider(),
    llmModel: llmModelLabel(),
  });
});

const CLONE_API = process.env.CLONE_API || 'http://localhost:4000';

async function proxyClone(path, options = {}) {
  const url = `${CLONE_API.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Clone proxy ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

app.get('/api/compliance/alerts', async (req, res) => {
  try {
    const params = new URLSearchParams();
    if (req.query.unacknowledged === '1') params.set('unacknowledged', '1');
    if (req.query.persona) params.set('persona', req.query.persona);
    const qs = params.toString() ? `?${params}` : '';
    res.json(await proxyClone(`/api/compliance-alerts${qs}`));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/demo/actions/:actionId', async (req, res) => {
  try {
    res.json(await proxyClone(`/api/demo/actions/${req.params.actionId}`, { method: 'POST' }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/compliance/alerts/:id/acknowledge', async (req, res) => {
  try {
    res.json(await proxyClone(`/api/compliance-alerts/${req.params.id}/acknowledge`, { method: 'POST' }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/demo/publish-amendment', async (_req, res) => {
  try {
    res.json(await proxyClone('/api/demo/publish-amendment', { method: 'POST' }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/citizen/profile', async (_req, res) => {
  try {
    res.json(await proxyClone('/api/citizen/profile'));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/gold/profile', async (_req, res) => {
  try { res.json(await proxyClone('/api/gold/profile')); }
  catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/lab/profile', async (_req, res) => {
  try { res.json(await proxyClone('/api/lab/profile')); }
  catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/enforcement/profile', async (_req, res) => {
  try { res.json(await proxyClone('/api/enforcement/profile')); }
  catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/academic/profile', async (_req, res) => {
  try { res.json(await proxyClone('/api/academic/profile')); }
  catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/industry/profile/:orgId', async (req, res) => {
  try {
    res.json(await proxyClone(`/api/org/${encodeURIComponent(req.params.orgId)}`));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post(
  '/api/clusters/:clusterId/warehouse/upload',
  upload.single('file'),
  (req, res) => {
    const store = getStore();
    const cluster = store.clusters.find(c => c.id === req.params.clusterId);
    if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

    const domain = req.body.domain;
    const note = req.body.note || '';
    let fileName = req.body.fileName;
    let buffer;

    if (req.file) {
      buffer = req.file.buffer;
      fileName = fileName || req.file.originalname;
    } else if (req.body.content) {
      buffer = Buffer.from(req.body.content, 'utf8');
      fileName = fileName || 'upload.json';
    } else {
      return res.status(400).json({ error: 'file or content required' });
    }

    try {
      const item = saveUpload(store, req.params.clusterId, domain, fileName, buffer, note);
      updateClusterFileCounts(store);
      saveStore(store);
      res.status(201).json({ item });
      runPostIngestTransform(store, req.params.clusterId, [item.id], 'upload')
        .then(() => saveStore(store))
        .catch(err => console.error('[upload→transform]', err.message));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.post('/api/store/reset', (_req, res) => {
  const store = resetStore();
  res.json({ message: 'Store reset', clusters: store.clusters.length, plans: store.plans.length });
});

app.get('/api/clusters', (_req, res) => {
  const store = getStore();
  updateClusterFileCounts(store);
  res.json(store.clusters);
});

app.post('/api/clusters', (req, res) => {
  const store = getStore();
  try {
    const cluster = createCluster(store, req.body || {});
    updateClusterFileCounts(store);
    saveStore(store);
    res.status(201).json(cluster);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.patch('/api/clusters/:clusterId', (req, res) => {
  const store = getStore();
  try {
    const cluster = renameCluster(store, req.params.clusterId, req.body || {});
    saveStore(store);
    res.json(cluster);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.delete('/api/clusters/:clusterId', (req, res) => {
  const store = getStore();
  try {
    const out = deleteCluster(store, req.params.clusterId);
    updateClusterFileCounts(store);
    saveStore(store);
    res.json(out);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.post('/api/clusters/:clusterId/clear-data', (req, res) => {
  const store = getStore();
  try {
    const out = clearClusterData(store, req.params.clusterId);
    updateClusterFileCounts(store);
    saveStore(store);
    res.json(out);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.get('/api/clusters/:clusterId', (req, res) => {
  const store = getStore();
  const cluster = store.clusters.find(c => c.id === req.params.clusterId);
  if (!cluster) return res.status(404).json({ error: 'Cluster not found' });
  updateClusterFileCounts(store);
  res.json(cluster);
});

app.patch('/api/clusters/:clusterId/publish', (req, res) => {
  const store = getStore();
  const target = store.clusters.find(c => c.id === req.params.clusterId);
  if (!target) return res.status(404).json({ error: 'Cluster not found' });
  const published = req.body.published === undefined ? true : !!req.body.published;
  let indexPromoted = null;
  if (published) {
    for (const c of store.clusters) {
      c.published = c.id === req.params.clusterId;
    }
    try {
      indexPromoted = promoteIndexToLive(req.params.clusterId);
    } catch {
      indexPromoted = null;
    }
  } else {
    target.published = false;
  }
  saveStore(store);
  res.json({
    message: published ? 'Published' : 'Unpublished',
    clusters: store.clusters,
    indexPromoted,
  });
});

registerTransformRoutes(app);

app.get('/api/clusters/:clusterId/plans', (req, res) => {
  const store = getStore();
  const snaps = store.snapshots || [];
  const plans = store.plans
    .filter(p => p.clusterId === req.params.clusterId)
    .map(p => decoratePlan({
      ...p,
      canRollback: snaps.some(s => s.planId === p.id),
    }));
  res.json(plans);
});

app.get('/api/clusters/:clusterId/warehouse', (req, res) => {
  const store = getStore();
  let items = store.warehouse.filter(w => w.clusterId === req.params.clusterId);
  const { domain, type } = req.query;
  if (domain) items = items.filter(i => i.domain === domain);
  if (type) items = items.filter(i => i.type === type);
  res.json(items.map(enrichWarehouseItem));
});

app.get('/api/clusters/:clusterId/freshness', (req, res) => {
  const store = getStore();
  res.json(sectionFreshness(store, req.params.clusterId));
});

app.get('/api/warehouse/:itemId', (req, res) => {
  const store = getStore();
  const item = store.warehouse.find(w => w.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(enrichWarehouseItem(item));
});

app.get('/api/warehouse/:itemId/lineage', (req, res) => {
  const store = getStore();
  const lineage = getLineage(store, req.params.itemId);
  if (!lineage) return res.status(404).json({ error: 'Item not found' });
  res.json(lineage);
});

app.get('/api/clusters/:clusterId/quarantine', (req, res) => {
  res.json({ items: listQuarantine(req.params.clusterId) });
});

app.get('/api/clusters/:clusterId/trust', (req, res) => {
  const store = getStore();
  res.json(getTrustSummary(store, req.params.clusterId));
});

app.get('/api/clusters/:clusterId/fetches', (req, res) => {
  const store = getStore();
  const limit = parseInt(req.query.limit || '20', 10);
  const rows = (store.fetches || [])
    .filter(f => f.clusterId === req.params.clusterId)
    .slice(0, limit);
  res.json({ fetches: rows });
});

app.delete('/api/warehouse/:itemId', (req, res) => {
  const store = getStore();
  const idx = store.warehouse.findIndex(w => w.id === req.params.itemId);
  if (idx < 0) return res.status(404).json({ error: 'Item not found' });
  const removed = store.warehouse[idx];
  store.warehouse.splice(idx, 1);
  if (removed.storagePath) {
    const diskPath = path.join(__dirname, '..', 'data', removed.storagePath);
    if (fs.existsSync(diskPath)) {
      try {
        fs.unlinkSync(diskPath);
      } catch {
        /* best effort */
      }
    }
  }
  updateClusterFileCounts(store);
  saveStore(store);
  res.json({ deleted: removed.id });
});

app.get('/api/clusters/:clusterId/history', (req, res) => {
  const store = getStore();
  const history = store.history
    .filter(h => h.clusterId === req.params.clusterId)
    .sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt));
  res.json(history);
});

app.get('/api/plans/:planId', (req, res) => {
  const store = getStore();
  const plan = store.plans.find(p => p.id === req.params.planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const history = store.history.filter(h => h.planId === plan.id).slice(0, 10);
  res.json({ plan: decoratePlan(plan), history });
});

app.patch('/api/plans/:planId', (req, res) => {
  const store = getStore();
  const plan = store.plans.find(p => p.id === req.params.planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const { method, schedule, queries, kind } = req.body;
  try {
    if (method !== undefined) {
      applyMethodToPlan(plan, method);
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (schedule !== undefined) {
    if (typeof schedule === 'object') {
      plan.schedule = {
        enabled: !!schedule.enabled,
        frequency: schedule.frequency || plan.schedule?.frequency || 'daily',
        time: schedule.time || plan.schedule?.time || '02:00',
        dayOfWeek: schedule.dayOfWeek ?? plan.schedule?.dayOfWeek ?? 1,
        dayOfMonth: schedule.dayOfMonth ?? plan.schedule?.dayOfMonth ?? 1,
        lastFiredKey: schedule.resetFire ? null : (plan.schedule?.lastFiredKey ?? null),
      };
    } else {
      plan.schedule = schedule;
    }
  }
  if (queries !== undefined) plan.queries = queries;
  if (kind !== undefined) plan.kind = kind;
  saveStore(store);
  res.json(decoratePlan(plan));
});

app.patch('/api/plans/bulk', (req, res) => {
  const store = getStore();
  const { planIds, method, schedule } = req.body;
  if (!planIds?.length) return res.status(400).json({ error: 'planIds required' });
  const methodId = method && method !== 'keep' ? normalizeFetchMethod(method) : null;
  for (const id of planIds) {
    const plan = store.plans.find(p => p.id === id);
    if (!plan) continue;
    if (methodId) {
      try {
        applyMethodToPlan(plan, methodId);
      } catch {
        /* skip plans that cannot use this method (e.g. no Playwright pattern) */
      }
    }
    if (schedule && schedule !== 'keep') {
      if (typeof schedule === 'object') {
        plan.schedule = {
          enabled: schedule.enabled !== undefined ? !!schedule.enabled : plan.schedule?.enabled,
          frequency: schedule.frequency || plan.schedule?.frequency || 'daily',
          time: schedule.time || plan.schedule?.time || '02:00',
          dayOfWeek: schedule.dayOfWeek ?? plan.schedule?.dayOfWeek ?? 1,
          dayOfMonth: schedule.dayOfMonth ?? plan.schedule?.dayOfMonth ?? 1,
          lastFiredKey: null,
        };
      }
    }
  }
  saveStore(store);
  res.json({ updated: planIds.length });
});

app.post('/api/plans/:planId/rollback', (req, res) => {
  const store = getStore();
  try {
    const out = rollbackPlan(store, req.params.planId);
    updateClusterFileCounts(store);
    saveStore(store);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/plans/:planId/queries', (req, res) => {
  const store = getStore();
  const plan = store.plans.find(p => p.id === req.params.planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'query required' });
  if (!plan.queries.includes(query.trim())) plan.queries.push(query.trim());
  saveStore(store);
  res.json(plan);
});

app.delete('/api/plans/:planId/queries/:index', (req, res) => {
  const store = getStore();
  const plan = store.plans.find(p => p.id === req.params.planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  plan.queries.splice(parseInt(req.params.index, 10), 1);
  saveStore(store);
  res.json(plan);
});

async function transformAfterIngest(store, plan) {
  if (plan.kind !== 'ingest') return null;
  try {
    return await runPostIngestTransform(store, plan.clusterId, [], 'manual_fetch');
  } catch (err) {
    console.error('[fetch→transform]', err.message);
    return null;
  }
}

app.get('/api/automation/status', (req, res) => {
  const store = getStore();
  res.json(getAutomationStatus(store));
});

app.get('/api/automation/events', (req, res) => {
  const store = getStore();
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 80);
  res.json({ events: (store.automationEvents || []).slice(0, limit) });
});

app.patch('/api/automation', (req, res) => {
  const store = getStore();
  const cfg = { ...defaultAutomationConfig(), ...(store.automation || {}) };
  const body = req.body || {};
  if (typeof body.enabled === 'boolean') cfg.enabled = body.enabled;
  if (typeof body.autoTransform === 'boolean') cfg.autoTransform = body.autoTransform;
  if (typeof body.promoteOnPublished === 'boolean') cfg.promoteOnPublished = body.promoteOnPublished;
  if (body.pollIntervalMs) cfg.pollIntervalMs = Math.max(10000, parseInt(body.pollIntervalMs, 10));
  if (Array.isArray(body.targetClusterIds)) cfg.targetClusterIds = body.targetClusterIds;
  if (Array.isArray(body.autofetchClusterIds)) cfg.autofetchClusterIds = body.autofetchClusterIds;
  store.automation = cfg;
  saveStore(store);
  res.json(getAutomationStatus(store));
});

app.post('/api/automation/run-now', async (req, res) => {
  const store = getStore();
  try {
    const summary = await runAutoSync(store, {
      reason: 'manual',
      clusterId: req.body?.clusterId || null,
    });
    updateClusterFileCounts(store);
    saveStore(store);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/plans/:planId/run', async (req, res) => {
  const store = getStore();
  const plan = store.plans.find(p => p.id === req.params.planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const selectedQueries = req.body.queries || plan.queries;
  const runAt = new Date().toISOString();

  try {
    const out = await runPlanInternal(store, plan.id, selectedQueries);
    if (store.history.length > 200) store.history = store.history.slice(0, 200);
    updateClusterFileCounts(store);
    const transform = await transformAfterIngest(store, plan);
    saveStore(store);
    res.json({ ...out, transform });
  } catch (err) {
    plan.lastStatus = 'failed';
    plan.lastRunAt = runAt;
    const historyEntry = {
      id: `h-${Date.now()}`,
      planId: plan.id,
      planName: plan.name,
      clusterId: plan.clusterId,
      section: sectionForPlan(plan) || '—',
      kind: plan.kind,
      status: 'failed',
      fetchedAt: runAt,
      storedInWarehouse: false,
      error: err.message,
    };
    store.history.unshift(historyEntry);
    saveStore(store);
    res.status(500).json({ error: err.message, historyEntry });
  }
});

app.post('/api/clusters/:clusterId/prefetch', async (req, res) => {
  try {
    const out = await prefetchCluster(req.params.clusterId, { skipScript: !!req.body?.skipScript });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/plans/run-bulk', async (req, res) => {
  const { planIds, queriesByPlan } = req.body;
  if (!planIds?.length) return res.status(400).json({ error: 'planIds required' });
  const store = getStore();
  const results = [];
  for (const id of planIds) {
    try {
      results.push(await runPlanInternal(store, id, queriesByPlan?.[id]));
    } catch (e) {
      results.push({ planId: id, error: e.message });
    }
  }
  updateClusterFileCounts(store);
  saveStore(store);
  res.json({ results });
});

const server = app.listen(PORT, () => {
  console.log(`Admin API running on http://localhost:${PORT}`);
  const skipBackground = process.env.DISABLE_BACKGROUND_JOBS === '1'
    || process.env.RENDER === 'true'
    || Boolean(process.env.RAILWAY_ENVIRONMENT);
  if (skipBackground) {
    console.log('Background scheduler / alerts / auto-sync disabled (hosted deploy or DISABLE_BACKGROUND_JOBS=1).');
  } else {
    startScheduler(15000);
    startAlertScanner({ intervalMs: 20000 });
    const store = getStore();
    const pollMs = store.automation?.pollIntervalMs || 30000;
    startAutoSyncWatcher(getStore, saveStore, pollMs);
  }
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Free it with:\n  lsof -ti :${PORT} | xargs kill -9\n`);
    process.exit(1);
  }
  throw err;
});

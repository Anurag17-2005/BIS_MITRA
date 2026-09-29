import { GLOBAL_PLAN_TEMPLATES } from '../plan-templates.js';

let connectorMap = {};
let agentSchemas = [];
let ragTools = new Set();

/** Called once from tools.js after TOOL_CONNECTOR / AGENT_TOOLS are defined. */
export function finalizeToolRegistry({ TOOL_CONNECTOR, AGENT_TOOLS, RAG_TOOLS }) {
  connectorMap = TOOL_CONNECTOR || {};
  agentSchemas = AGENT_TOOLS || [];
  ragTools = RAG_TOOLS || new Set();
  registryCache = null;
}

/** Internal agent tools — not backed by fetch-config probe connectors. */
export const INTERNAL_TOOLS = {
  run_deterministic_rule: {
    kind: 'internal',
    category: 'rules',
    capability: 'validation_engine',
    description: 'Execute a deterministic BIS validation/status rule',
    executor: 'rules_engine',
  },
  get_workflow_status: {
    kind: 'internal',
    category: 'workflow',
    capability: 'workflow_engine',
    description: 'Look up eBIS workflow/application status by record ID',
    executor: 'workflow_status',
  },
  discover_ebis_service: {
    kind: 'internal',
    category: 'workflow',
    capability: 'workflow_engine',
    description: 'Discover which eBIS service matches a user goal',
    executor: 'ebis_discover',
  },
  get_ebis_service: {
    kind: 'internal',
    category: 'workflow',
    capability: 'workflow_engine',
    description: 'Get eBIS service details, steps, and required documents',
    executor: 'ebis_service',
  },
  search_knowledge: {
    kind: 'internal',
    category: 'retrieval',
    capability: 'retrieval',
    description: 'Search published knowledge cluster index',
    executor: 'rag_index',
  },
  search_knowledge_base: {
    kind: 'internal',
    category: 'retrieval',
    capability: 'retrieval',
    description: 'Hybrid knowledge search (RAG + standards catalog)',
    executor: 'knowledge_base',
  },
  submit_portal_form: {
    kind: 'internal',
    category: 'workflow',
    capability: 'workflow_engine',
    description: 'Submit a portal form (complaint, application)',
    executor: 'portal_form',
  },
  list_user_alerts: {
    kind: 'internal',
    category: 'alerts',
    capability: 'alert_engine',
    description: 'List alerts for the current user session',
    executor: 'alert_store',
  },
  get_alert_details: {
    kind: 'internal',
    category: 'alerts',
    capability: 'alert_engine',
    description: 'Get details for one user alert',
    executor: 'alert_store',
  },
  get_session_context: {
    kind: 'internal',
    category: 'context',
    capability: 'context_engine',
    description: 'Read lightweight session context (entities, active workflow)',
    executor: 'context_store',
  },
};

function schemaByName() {
  return new Map(agentSchemas.map(t => [t.function.name, t]));
}

function toolsForConnector(connector) {
  return Object.entries(connectorMap)
    .filter(([, c]) => c === connector)
    .map(([name]) => name);
}

function buildProbeRegistry() {
  const byConnector = new Map();
  for (const plan of GLOBAL_PLAN_TEMPLATES.filter(t => t.kind === 'probe')) {
    const toolNames = toolsForConnector(plan.connector);
    byConnector.set(plan.connector, {
      planId: plan.baseId,
      planName: plan.name,
      connector: plan.connector,
      method: plan.method,
      toolNames,
    });
  }
  return byConnector;
}

const PROBE_PLANS = buildProbeRegistry();

function buildRegistry() {
  const tools = new Map();
  const schemas = schemaByName();

  for (const [name, connector] of Object.entries(connectorMap)) {
    const plan = PROBE_PLANS.get(connector);
    const schema = schemas.get(name);
    tools.set(name, {
      name,
      kind: ragTools.has(name) ? 'internal' : 'probe',
      category: plan?.planName ? 'bis_probe' : 'bis_api',
      connector,
      planId: plan?.planId || null,
      planName: plan?.planName || null,
      capability: schema?.function?.description ? inferCapability(name) : 'data_retrieval',
      description: schema?.function?.description || `Probe via ${connector}`,
      source: ragTools.has(name) ? 'knowledge-index' : 'clone-api',
      schema: schema || null,
    });
  }

  for (const [name, meta] of Object.entries(INTERNAL_TOOLS)) {
    if (tools.has(name)) {
      const existing = tools.get(name);
      tools.set(name, { ...existing, ...meta, kind: 'internal' });
    } else {
      tools.set(name, {
        name,
        ...meta,
        connector: connectorMap[name] || null,
        schema: schemas.get(name) || null,
        source: 'admin-internal',
      });
    }
  }

  return tools;
}

function inferCapability(toolName) {
  if (/workflow|ebis|portal/.test(toolName)) return 'workflow_engine';
  if (/rule|verify|validation/.test(toolName)) return 'validation_engine';
  if (/alert|freshness|fingerprint/.test(toolName)) return 'alert_engine';
  if (/fee|compensation|calculate/.test(toolName)) return 'calculator';
  return 'data_retrieval';
}

let registryCache = null;

export function getToolRegistry() {
  if (!registryCache) registryCache = buildRegistry();
  return registryCache;
}

export function getTool(name) {
  return getToolRegistry().get(name) || null;
}

export function listRegistryTools({ kind, category, capability } = {}) {
  let items = [...getToolRegistry().values()];
  if (kind) items = items.filter(t => t.kind === kind);
  if (category) items = items.filter(t => t.category === category);
  if (capability) items = items.filter(t => t.capability === capability);
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export function getProbePlanTools() {
  return listRegistryTools({ kind: 'probe' });
}

export function getInternalTools() {
  return listRegistryTools({ kind: 'internal' });
}

export function resolveToolForRouter(toolName) {
  const tool = getTool(toolName);
  if (!tool) return null;
  return {
    name: tool.name,
    kind: tool.kind,
    connector: tool.connector,
    capability: tool.capability,
    planId: tool.planId,
    executor: tool.executor || tool.connector,
  };
}

/** Invalidate cache when tool definitions change (tests). */
export function resetToolRegistry() {
  registryCache = null;
}

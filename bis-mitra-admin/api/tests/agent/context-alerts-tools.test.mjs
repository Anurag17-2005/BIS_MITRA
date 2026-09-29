/**
 * Agent tools registry, session context, and alert engine tests.
 */
import { resetSessionDbForTests, closeSessionDb } from '../../agent/session-db.js';
import {
  updateContext,
  getContext,
  clearContext,
  setRecordSnapshot,
} from '../../context/context-store.js';
import {
  loadSessionContext,
  resolveQueryWithSessionContext,
  persistChatTurn,
} from '../../context/context-service.js';
import { createAlert, listAlerts, getUnreadCount } from '../../alerts/alert-store.js';
import { scanRecordForAlerts } from '../../alerts/alert-engine.js';
import { executeAgentTool, listAgentTools, getToolRegistry } from '../../agent/tools.js';
import { routeQuery } from '../../agent/router/router.js';
import { resetToolRegistry } from '../../agent/tool-registry.js';

let passed = 0;
let failed = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}${detail ? `: ${detail}` : ''}`);
    failed++;
  }
}

const suffix = `test-${Date.now()}`;
resetSessionDbForTests(suffix);
resetToolRegistry();

// --- Tool registry ---
const registry = getToolRegistry();
assert('Tool registry loads', registry.size > 40, `size=${registry.size}`);
assert('Probe tool registered', registry.has('search_standards'));
assert('Internal workflow tool registered', registry.get('get_workflow_status')?.kind === 'internal');
assert('Internal alert tool registered', registry.get('list_user_alerts')?.kind === 'internal');
const listed = listAgentTools();
assert('listAgentTools includes kind metadata', listed.some(t => t.kind === 'probe'));
assert('listAgentTools includes probe plan link', listed.some(t => t.planId === 'probe_kys_search'));

// --- Probe execution (requires clone API) ---
try {
  const probe = await executeAgentTool('search_standards', { query: 'helmet' });
  assert('Agent can call probe tool', probe.source === 'clone-api' || probe.data);
} catch (err) {
  assert('Agent can call probe tool', false, err.message);
}

// --- Internal tools ---
const sessionA = 'sess-a';
const sessionB = 'sess-b';
updateContext(sessionA, { activeService: 'SVC-CERT-001', activeRecordId: 'BIS-APP-CERT-DEMO-001' }, { userId: 'industry' });
const alertsTool = await executeAgentTool('list_user_alerts', { sessionId: sessionA, userId: 'industry' });
assert('list_user_alerts tool works', Array.isArray(alertsTool.data?.alerts));

createAlert({
  sessionId: sessionA,
  userId: 'industry',
  type: 'action_required',
  title: 'Test alert A',
  message: 'Demo message',
  relatedRecordId: 'BIS-APP-CERT-DEMO-001',
});
createAlert({
  sessionId: sessionB,
  userId: 'citizen',
  type: 'complaint_status_changed',
  title: 'Test alert B',
  message: 'Other session',
});
assert('Alerts stored per session', listAlerts({ sessionId: sessionA }).length >= 1);
assert('Context isolation between sessions', listAlerts({ sessionId: sessionB }).length >= 1
  && listAlerts({ sessionId: sessionA }).every(a => a.session_id === sessionA));

// --- Context persistence ---
const ctx = loadSessionContext(sessionA, { userId: 'industry', history: [] });
assert('Context loads active service', ctx.activeService === 'SVC-CERT-001');
assert('Context loads active record', ctx.activeRecordId === 'BIS-APP-CERT-DEMO-001');

const followUp = resolveQueryWithSessionContext('What documents do I need?', [], ctx);
assert('Follow-up uses session service context', followUp.workflowContext?.serviceId === 'SVC-CERT-001');

const statusFollowUp = resolveQueryWithSessionContext('What is the status?', [], ctx);
assert('Status follow-up inherits record from session', !!statusFollowUp.workflowContext?.recordId);

persistChatTurn(sessionA, {
  userMessage: 'I want to apply for certification',
  assistantResult: {
    answer: 'Certification service found',
    router: { intent: 'task', uiMode: 'workflow' },
    workflow: { service_id: 'SVC-CERT-001', record_id: 'BIS-APP-CERT-DEMO-001' },
  },
  router: { intent: 'task', entities: { appIds: ['BIS-APP-CERT-DEMO-001'] } },
  userId: 'industry',
  persona: 'industry',
});
const after = getContext(sessionA);
assert('Context updated after chat turn', after.activeRecordId === 'BIS-APP-CERT-DEMO-001');

clearContext(sessionA);
assert('clearContext removes session data', !getContext(sessionA));

// --- Router session alert preference ---
updateContext(sessionB, { watchedRecords: ['CMP-DEMO-001'] }, { userId: 'citizen' });
const alertRoute = routeQuery('Show my alerts', {
  history: [],
  sessionContext: loadSessionContext(sessionB, { userId: 'citizen' }),
});
assert('Router routes my alerts to list_user_alerts', alertRoute.tool === 'list_user_alerts');

// --- Alert engine snapshot diff (requires clone for live fetch) ---
updateContext(sessionA, {
  activeRecordId: 'BIS-APP-CERT-DEMO-001',
  watchedRecords: ['BIS-APP-CERT-DEMO-001'],
}, { userId: 'industry' });
setRecordSnapshot(sessionA, 'BIS-APP-CERT-DEMO-001', {
  status: 'Submitted',
  serviceId: 'SVC-CERT-001',
});
try {
  const created = await scanRecordForAlerts(sessionA, 'BIS-APP-CERT-DEMO-001', { userId: 'industry' });
  assert('Status change generates alert', created.length >= 1, `created=${created.length}`);
  if (created.length) {
    assert('Alert has evidence', !!created[0].evidence?.new_status);
    assert('Unread count increments', getUnreadCount({ sessionId: sessionA }) >= 1);
  }
} catch (err) {
  assert('Status change generates alert', false, err.message);
}

closeSessionDb();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

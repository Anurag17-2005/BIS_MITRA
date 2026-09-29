import { resolveClusterId } from '../retrieval/search-knowledge.js';
import { retrieve } from '../retrieval/unified.js';
import { routeQuery } from './router/router.js';
import { executeAgentTool } from './tools.js';
import {
  runDeterministicRule,
  formatRuleAnswer,
  ruleResultToProbe,
  ruleResultToSources,
} from './rules-bridge.js';
import {
  pickWorkflowTool,
  discoverEbisService,
  getEbisService,
  getWorkflowStatus,
  formatWorkflowAnswer,
  workflowResultToProbe,
  workflowResultToSources,
  extractWorkflowContext,
} from '../workflows/common/workflow-bridge.js';
import { expandQueryTerms } from '../retrieval/regulatory/synonym-expander.js';
import { bestEnforcementForIsList } from '../retrieval/regulatory/qco-matcher.js';
import { applyTruthShield, extractVerifiedFacts } from './truth-shield.js';
import { shouldRunLiveProbe, runLivePlaywrightProbe } from './live-probe.js';
import { resolvePersonaMode, formatForPersona, formatPersonaPlaybook } from './persona.js';
import { composeWithLlm, llmConfigured, llmProvider } from './llm.js';
import { enrichProofPanel, mergeProofPanel } from './proof-panels.js';
import {
  wantsApplication,
  wantsCertApplication,
  CERT_PERSONAS,
  handleCertificationTurn,
  handleComplaintTurn,
  wantsComplaintFiling,
  buildConfirmTable,
  confirmAnswer,
  rememberFacts,
  runConfirmedSubmit,
  APPLICATIONS_URL,
} from './confirm-flow.js';
import {
  metaAnswer,
  cleanPreview,
} from './intent.js';
import {
  loadSessionContext,
  persistChatTurn,
  getRecentConversation,
  getContext,
  updateContext,
} from '../context/context-service.js';
import { WRITE_TOOLS } from './tools.js';
import { TRANSACTIONAL_INTENTS } from './router/intents.js';
import { scanSessionAlerts } from '../alerts/alert-engine.js';
import { getUnreadCount } from '../alerts/alert-store.js';
import { notifyApplicationSubmitted } from '../alerts/notify-application.js';
import { resolvePortalUrl } from '../retrieval/portal-provenance.js';
import { capUiSources } from './source-cap.js';

const LIVE_PROBE_PATTERNS = [
  // Everyday Citizen — specific patterns first (order matters)
  { re: /\b(plastic\s+toy|toy.*3[\s-]?year|9873|toxin\s+limit|safety\s+mark.*toy|choking\s+hazard)/i, tool: 'search_knowledge_base' },
  { re: /\b(surveillance|SURV-DEMO|market\s+surveillance|sample\s+failed|non-conform)/i, tool: 'search_surveillance' },
  { re: /\b(enforcement\s+case|ENF-DEMO|inspection\s+case|seizure|raid\s+evidence|factory\s+inspection)/i, tool: 'search_enforcement_cases' },
  { re: /\b(CMP-DEMO|consumer\s+complaint\s+ticket|complaint\s+lookup)/i, tool: 'search_consumer_complaints' },
  { re: /\b(action\s+(taken|on)|enforcement\s+team|complaint\s+i\s+filed|CON-GRP|yesterday|track.*complaint|taken\s+any\s+action)/i, tool: 'grievance_status' },
  { re: /\b(extension\s+board.*(fire|caught)|caught\s+fire|file\s+(an?\s+)?(official\s+)?complaint|store\s+bill)/i, tool: 'submit_portal_form' },
  { re: /\b(derive|mathematical\s+steps|breakdown\s+threshold|formula.*insulation)/i, tool: 'derive_formula_limits' },
  { re: /\b(dielectric|2000\s*v|high[\s-]?voltage\s+insulation|room\s+heater\s+box)/i, tool: 'translate_technical_jargon' },
  { re: /\b(shopkeeper|refund|merchant|legal\s+clause|not\s+mandatory|geyser.*certif)/i, tool: 'get_dispute_leverage' },
  { re: /\b(emergency\s+factory|emergency\s+seal|sealing\s+order|raid\s+site.*non-compliance|section\s+29)/i, tool: 'execute_emergency_seal' },
  { re: /\b(8830112|background\s+check.*licen[cs]e|factory\s+licen[cs]e.*suspended)/i, tool: 'verify_license_index' },
  { re: /\b(8504\.40\.90|HS\s+Code|customs\s+clearance|incoming\s+cargo|port\s+lists)/i, tool: 'check_border_exemption' },
  { re: /\b(rogue\s+factory|evidence\s+entry|uncertified\s+cement|fake\s+ISI\s+logo)/i, tool: 'log_raid_evidence' },
  { re: /\b(CM\/L-?4151999|4151999|counterfeit.*helmet|fake\s+helmet|license\s+stamp)/i, tool: 'verify_registry_id' },
  { re: /\b(gold\s+ring|hallmark.*hindi|simple\s+hindi|हिन्दी|checking\s+rights)/i, tool: 'get_bilingual_educational_data' },
  { re: /\b(baby\s+feeding|toxic\s+plastic|immediate\s+hazard|flag\s+this|unbranded.*bottle)/i, tool: 'trigger_hazard_alert' },
  // Gold Buyer — before generic hallmark pattern
  { re: /\b(22K916|stamp.*triangle|how\s+pure|bangle\s+stamped)/i, tool: 'decode_hallmark' },
  { re: /\b(unhallmarked|without\s+(any\s+)?HUID|without\s+hallmark|report\s+them|selling\s+gold\s+chains)/i, tool: 'report_hallmark_violation' },
  { re: /\b(verify.*HUID|HUID\s+code|A1B2C3|when\s+was\s+it\s+stamped)/i, tool: 'verify_huid_code' },
  { re: /\b(carat\s+deficit|compensation|lab\s+test\s+report.*18K|paid\s+₹|1,40,000|140000)/i, tool: 'calculate_gold_compensation' },
  // Lab Tech — before generic lab pattern
  { re: /\b(room\s+temperature|humidity\s+limit|environmental|IS\s*1786|mechanical\s+stress\s+test.*steel)/i, tool: 'get_lab_environmental_specs' },
  { re: /\b(log\s+this\s+report|finished\s+the\s+test|Sample\s+ID|CERT-|tensile\s+strength.*MPa)/i, tool: 'log_test_certificate' },
  { re: /\b(bulk\s+data\s+upload|validation\s+bounds|upload\s+fail)/i, tool: 'get_validation_delta' },
  { re: /\b(blind\s+cross|proficiency|BLIND-X1|cross-testing)/i, tool: 'initialize_cross_testing' },
  // Academic
  { re: /\b(un-?truncated|stress-?strain|yield\s+point|IS\s*2062|material\s+matrix)/i, tool: 'fetch_untruncated_table' },
  { re: /\b(semester|gazette\s+notification|published\s+during)/i, tool: 'get_semester_updates' },
  { re: /\b(revision\s+diff|1993.*2018|mutated\s+between|structural\s+diff\s+matrix)/i, tool: 'generate_revision_diff' },
  { re: /\b(submit|form-?i|fill\s+out|application\s+right\s+now)/i, tool: 'submit_portal_form' },
  { re: /\b(roadmap|step[\s-]by[\s-]step|fastest\s+way|how\s+much\s+will\s+it\s+cost|simplified\s+procedure)/i, tool: 'get_certification_roadmap' },
  { re: /\b(variant|endorsement|inclusion|shell\s+size|new\s+model)/i, tool: 'search_variant_guidance' },
  { re: /\b(critical\s+alert|what\s+changed|overnight|amendment|fingerprint|freshness)/i, tool: 'check_system_freshness' },
  { re: /\b(clause\s*[\d.]+|what\s+exact\s+numbers|deceleration|threshold)/i, tool: 'search_amendments' },
  { re: /\b(surprise\s+audit|inspection\s+readiness|mock\s+inspection|audit\s+failure)/i, tool: 'run_mock_inspection' },
  { re: /\b(near\s+(Pune|Mumbai|Delhi|Bengaluru)|shortest\s+queue|waiting\s+queue|send\s+my\s+sample)/i, tool: 'suggest_testing_labs' },
  { re: /\b(launch\s+on\s+amazon|legally\s+mandatory|voluntary|break\s+the\s+law)/i, tool: 'check_qco_enforcement' },
  { re: /\b(my\s+licen[cs]e|org\s+profile|submission\s+tracker|DEMO_MSME)/i, tool: 'get_user_profile' },
  { re: /\bindustrial\s+safety\s+helmets?\b/i, tool: 'search_standards' },
  { re: /\b(IS\s*DEMO|STD-DEMO)/i, tool: 'search_standards' },
  { re: /\b(IS\s*\d+|standard\s+for|find\s+standard|search\s+standard)/i, tool: 'search_standards' },
  { re: /\b(marking\s+fee|licence\s+fee|annual\s+fee|kharcha)/i, tool: 'search_marking_fees' },
  { re: /\b(compulsory|mandatory\s+cert)/i, tool: 'search_compulsory_products' },
  { re: /\b(application\s+status|BIS-APP-|ISI-)/i, tool: 'search_applications' },
  { re: /\b(hallmark|AHC|assaying|gold\s+ring|shudhata)/i, tool: 'search_hallmarking_centres' },
  { re: /\b(LRS|testing\s+lab\b)/i, tool: 'search_labs' },
  { re: /\b(consumer\s+guidance|verify\s+isi)\b/i, tool: 'search_consumer_guidance' },
  { re: /\b(QCO|quality\s+control\s+order|gazette)/i, tool: 'search_qco_orders' },
  { re: /\b(SIT|STI|testing\s+machinery|factory\s+floor|factory\s+test|inspection\s+and\s+testing)/i, tool: 'search_sit_manuals' },
  { re: /\b(geyser|milk\s+packet|kharcha|nakli|shudhata|built\s+a\s+home)/i, tool: 'expand_layman_terms' },
  { re: /\b(news|announcement|notification)/i, tool: 'search_bis_news' },
];

function pickLiveProbe(message) {
  for (const p of LIVE_PROBE_PATTERNS) {
    if (p.re.test(message)) return p;
  }
  return null;
}

/** Isolate LLM + server memory per browser session, persona, and chat thread. */
function threadStorageKey(sessionId, { userId, conversationId } = {}) {
  if (!sessionId) return null;
  const parts = [sessionId, userId || 'anon', conversationId || 'default'].filter(Boolean);
  return parts.join('::');
}

function collectIsFromHits(hits) {
  const out = new Set();
  for (const h of hits) {
    for (const isn of h.isNumbers || []) out.add(isn);
    const m = (h.metadata?.is_number || h.citation?.citation_anchor || '');
    const found = String(m).match(/IS\s*(?:DEMO\s*)?\d[\d\s().:]*/i);
    if (found) out.add(found[0].trim());
  }
  return [...out];
}

/**
 * Enforcement facts from the authoritative QCO line. Registry fields are kept only when they
 * describe the same standard — never mix two products into one enforcement record.
 */
function authoritativeEnforcement(authLine, registry) {
  const field = (label) => authLine.match(new RegExp(`${label}:\\s*([^|]+)`, 'i'))?.[1]?.trim() || null;
  const isNumber = authLine.match(/IS\s*(?:DEMO\s*)?\d{1,5}(?::\d{4})?/i)?.[0] || null;
  const squash = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const sameStandard = registry?.is_number && isNumber
    && squash(registry.is_number).startsWith(squash(isNumber.split(':')[0]));
  return {
    ...(sameStandard ? registry : {}),
    enforcement_status: field('Status') || 'MANDATORY',
    is_number: isNumber || registry?.is_number || null,
    scheme: field('Scheme') || (sameStandard ? registry.scheme : null),
    effective_date: field('Effective') || (sameStandard ? registry.effective_date : null),
    notifying_gazette_id: authLine.match(/QCO[\s-]*DEMO[\s-]*\d+/i)?.[0] || (sameStandard ? registry.notifying_gazette_id : null),
    legal_caveat: authLine,
    authoritative: authLine,
  };
}

function chunksToHits(chunks) {
  return (chunks || []).map(c => ({
    chunkId: c.chunkId,
    title: c.title,
    section: c.section,
    score: c.score,
    text: c.text,
    textPreview: c.textPreview,
    label: c.label,
    record_id: c.record_id,
    evidence: c.evidence,
    portalUrl: c.portalUrl || null,
    domain: c.domain || null,
    metadata: {
      demo_id: c.demo_id,
      record_id: c.record_id,
      source_file: c.source_file,
      storage_uri: c.storage_uri,
      source_reference: c.source_reference,
      source_url: c.sourceUrl || c.portalUrl || null,
      source_type: c.sourceType || c.source_type || null,
      domain: c.domain || null,
      is_number: c.is_number || c.provenance?.is_number,
      mandatory_status: c.provenance?.mandatory_status,
      evidence: c.evidence,
      page_number: c.page_number,
      page_number_confidence: c.page_number_confidence,
    },
    citation: c.citation || null,
    isNumbers: c.provenance?.is_number ? [c.provenance.is_number] : (c.is_number ? [c.is_number] : []),
  }));
}

function capSources(rows) {
  return capUiSources(rows);
}

function probeHasResults(probe) {
  if (!probe) return false;
  const d = probe.data;
  if (!d || d._offline) return false;
  if (d.found === true) return true;
  if (Array.isArray(d.results) && d.results.length) return true;
  if (Array.isArray(d) && d.length) return true;
  if (d.demo_id || d.status || d.outcome || d.is_number) return true;
  return false;
}

/**
 * Enforce: evidence must resolve to a BIS origin + content before answer/UI.
 * Reconstruct portal URLs here (not at the UI) so HTML/JSON get Open on BIS.
 */
function assertAnswerSourceContract(chunks = [], records = [], probe = null) {
  const hasRagEvidence = chunks.length > 0 || records.length > 0;
  const hasProbe = probeHasResults(probe);
  const hasEvidence = hasRagEvidence || hasProbe;

  const validated = [];
  for (const c of chunks) {
    const portalUrl = c.portalUrl || resolvePortalUrl(c);
    const hasOrigin = !!(portalUrl || c.storage_uri || c.source_file);
    const hasContent = !!(c.evidence?.length || c.textPreview || c.record_id || c.text);
    if (hasOrigin && hasContent) {
      validated.push({ ...c, portalUrl: portalUrl || c.portalUrl || null });
    }
  }
  for (const r of records) {
    const portalUrl = r.portalUrl || resolvePortalUrl({
      ...r,
      domain: r.domain || r.section,
      source_type: r.source_type,
    });
    const hasContent = !!(r.title || r.recordId || r.demo_id || r.data);
    if ((portalUrl || r.source_file) && hasContent) {
      validated.push({
        ...r,
        portalUrl,
        textPreview: r.title || r.recordId,
        evidence: r.evidence || [],
        score: typeof r.score === 'number' ? r.score : undefined,
      });
    }
  }

  return {
    hasEvidence,
    hasRagEvidence,
    hasProbe,
    validatedCount: validated.length,
    pipelineBug: hasRagEvidence && validated.length === 0,
    validated,
  };
}

function buildModuleTags(router, retrievalResult, probe, toolName, llmMeta) {
  const tags = [];
  if (router?.useRag && retrievalResult?.retrieval_type) {
    tags.push({ id: 'knowledge', label: 'Knowledge', detail: retrievalResult.retrieval_type });
  }
  if (probe?.tool || toolName) {
    tags.push({ id: 'bis_api', label: 'BIS data', detail: probe?.tool || toolName });
  }
  if (llmMeta?.used) {
    tags.push({ id: 'synthesis', label: 'MITRA synthesis', detail: llmMeta.provider || 'llm' });
  }
  if (router?.dataSource === 'rules_engine') {
    tags.push({ id: 'verification', label: 'Verification', detail: router.capability || 'rules' });
  }
  if (router?.dataSource === 'ebis_workflow') {
    tags.push({ id: 'workflow', label: 'Applications', detail: router.tool || 'workflow' });
  }
  return tags;
}

function sourcesFromProbe(probe, toolName) {
  const tool = probe?.tool || toolName;
  const results = probe?.data?.results;
  const BIS = process.env.BIS_WEB || 'http://localhost:3001';
  if (!Array.isArray(results) || !results.length) {
    if (tool === 'search_surveillance' && probe?.data?.results === undefined && probe?.data?.length) {
      return probe.data.slice(0, 5).map((r, i) => ({
        score: 0.9 - i * 0.02,
        title: r.product || r.title || r.demo_id || 'Surveillance record',
        sourceUrl: `${BIS}/regulatory-hub`,
        portalUrl: `${BIS}/regulatory-hub`,
        textPreview: r.finding || r.summary || JSON.stringify(r).slice(0, 120),
        label: r.demo_id || r.surveillance_id || null,
        evidence: [r.finding || r.status || ''].filter(Boolean),
        storage_uri: 'knowledge/pdfs/demo/surveillance_demo.pdf',
        source_type: 'bis_api',
      }));
    }
    return [];
  }
  const portalUrl = resolvePortalUrl({ source_type: 'compulsory_portal' });

  if (tool === 'search_standards') {
    return results.slice(0, 5).map((r, i) => ({
      score: 0.96 - i * 0.02,
      title: `${r.is_number || 'Indian Standard'} — ${r.title || 'Standard record'}`,
      sourceUrl: `${BIS}/regulatory-hub`,
      portalUrl: `${BIS}/regulatory-hub`,
      textPreview: r.description || `${r.status || 'Active'} · ${r.mandatory_voluntary || 'See applicability'}`,
      label: r.demo_id || r.is_number || null,
      evidence: [r.certification_applicability, r.qco_reference].filter(Boolean),
      storage_uri: r.pdf_path
        ? `knowledge/pdfs/${r.pdf_path}`
        : (r.source_file ? `knowledge/pdfs/demo/${r.source_file}` : null),
      source_file: r.source_file || null,
      source_reference: r.source_reference || null,
      demo_id: r.demo_id || null,
      source_type: 'bis_api',
    }));
  }

  if (tool === 'search_compulsory_products') {
    return results.slice(0, 5).map((r) => ({
      score: 0.94,
      title: r.product_name || r.title || r.is_number,
      sourceUrl: portalUrl,
      portalUrl,
      textPreview: `${r.is_number || ''} — ${r.status || 'Mandatory'}`.trim(),
      label: [r.is_number, r.product_name || r.title].filter(Boolean).join(' · ').slice(0, 80),
      evidence: [`${(r.is_number || '').trim()} ${r.status || 'Mandatory'}`.trim()],
      storage_uri: null,
      source_type: 'compulsory_portal',
    }));
  }
  if (tool === 'search_surveillance') {
    return results.slice(0, 5).map((r, i) => ({
      score: 0.88 - i * 0.02,
      title: r.product || r.title || r.demo_id || 'Surveillance case',
      sourceUrl: `${BIS}/regulatory-hub`,
      portalUrl: `${BIS}/regulatory-hub`,
      textPreview: (r.finding || r.summary || `${r.demo_id || ''} ${r.status || ''}`).trim(),
      label: r.demo_id || r.surveillance_id || null,
      evidence: [(r.finding || r.status || '').trim()].filter(Boolean),
      storage_uri: 'knowledge/pdfs/demo/surveillance_demo.pdf',
      source_type: 'bis_api',
    }));
  }
  return [];
}

function mapSources(hits, retrievalSources = []) {
  const rows = retrievalSources?.length
    ? retrievalSources.map(s => ({
      chunkId: s.chunkId,
      recordId: s.recordId,
      title: s.title,
      section: s.section,
      score: s.score,
      textPreview: s.textPreview,
      demo_id: s.demo_id,
      source_file: s.source_file,
      storage_uri: s.storage_uri || null,
      chunkIndex: s.chunkIndex ?? null,
      passage: s.passage || null,
      source_reference: s.source_reference,
      sourceUrl: s.sourceUrl || s.source_reference || null,
      retrievalMethod: s.retrievalMethod,
      type: s.type || s.sourceType || null,
      page_number: s.page_number ?? null,
      page_number_confidence: s.page_number_confidence ?? null,
      record_id: s.record_id ?? null,
      evidence: s.evidence || [],
      label: s.label || null,
      portalUrl: s.portalUrl || null,
      domain: s.domain || null,
    }))
    : hits.map(h => ({
      chunkId: h.chunkId,
      title: h.title,
      section: h.section,
      score: h.score,
      textPreview: cleanPreview(h.text || h.textPreview, 140),
      citationAnchor: h.citation?.citation_anchor || h.metadata?.citation_anchor,
      legalStatus: h.citation?.legal_status || h.metadata?.mandatory_status,
      demo_id: h.metadata?.demo_id || null,
      source_file: h.metadata?.source_file || null,
      source_reference: h.metadata?.source_reference || null,
      sourceUrl: h.citation?.source_url || h.metadata?.source_url || h.metadata?.source_reference || null,
      storage_uri: h.metadata?.storage_uri || h.metadata?.source_file || null,
      type: h.metadata?.source_type || null,
      page_number: h.metadata?.page_number ?? null,
      page_number_confidence: h.metadata?.page_number_confidence ?? null,
      record_id: (h.record_id || h.metadata?.record_id) ?? h.metadata?.demo_id ?? null,
      evidence: h.evidence || h.metadata?.evidence || [],
      label: h.label || null,
    }));

  return rows.map((s) => {
    const portalUrl = resolvePortalUrl(s);
    return {
      ...s,
      portalUrl,
      sourceUrl: portalUrl || s.sourceUrl || s.source_reference || null,
    };
  });
}

function buildUiSources(hits, retrievalSources, probe, toolName) {
  return capSources([
    ...sourcesFromProbe(probe, toolName),
    ...mapSources(hits, retrievalSources),
  ]);
}

function probePayloadUiMode(router, probe, queryText) {
  const extra = enrichProofPanel(queryText, probe, probe?.tool || router.tool);
  return extra?.uiMode || router.uiMode;
}

function argsRunIdFromQuery(q) {
  const explicit = String(q || '').match(/(?:run[\s_-]?id|evidence[\s_-]?id)[\s:=]+([A-Z0-9-]+)/i)?.[1];
  if (explicit) return explicit;
  return `EVD-PA10-${Date.now().toString().slice(-8)}`;
}

function buildCapabilityPanel(router, probe, retrieval, query = '') {
  const base = {
    uiMode: router.uiMode,
    intent: router.intent,
    capability: router.capability,
    confidence: router.confidence,
  };
  if (router.uiMode === 'verification' && probe?.data) {
    const d = probe.data;
    return mergeProofPanel({
      ...base,
      ruleId: d.rule_id,
      status: d.outcome || d.status || (d.found ? 'FOUND' : 'not_found'),
      evidence: d.evidence || d,
      source: d.source || probe.source || 'rules_engine',
    }, enrichProofPanel(query, probe, probe?.tool));
  }
  if (router.uiMode === 'calculation' && probe?.data) {
    return mergeProofPanel({
      ...base,
      inputs: probe.data.inputs || probe.data,
      result: probe.data.total_inr || probe.data.compensation_inr || probe.data.amount || probe.data,
      formula: probe.data.formula || probe.data.note,
      source: probe.source || 'clone_rules',
    }, enrichProofPanel(query, probe, probe?.tool));
  }
  if (router.uiMode === 'alert' && probe?.data) {
    const alerts = probe.data.alerts || probe.data.results || [];
    return { ...base, alerts, source: 'compliance_alerts' };
  }
  if (router.uiMode === 'comparison' && probe?.data) {
    const d = probe.data;
    return mergeProofPanel({
      ...base,
      ruleId: d.rule_id,
      comparison: d.evidence || d,
      outcome: d.outcome,
      source: d.source || 'rules_engine',
    }, enrichProofPanel(query, probe, probe?.tool));
  }
  if (router.uiMode === 'workflow' && probe?.data) {
    const d = probe.data;
    return mergeProofPanel({
      ...base,
      status: d.current_status || d.status,
      next_action: d.next_action,
      current_step: d.current_step,
      record_id: d.record_id || d.application_id,
      service_id: d.service_id,
      service_name: d.service_name,
      required_documents: d.required_documents,
      steps: d.steps || d.lifecycle_states,
      status_history: d.status_history || [],
      evidence: d.evidence_refs || d.form,
      source: d.source || 'ebis_workflow',
    }, enrichProofPanel(query, probe, probe?.tool));
  }
  const standardRows = probe?.tool === 'search_standards' ? probe?.data?.results : null;
  const helmet = Array.isArray(standardRows)
    ? standardRows.find((row) => row.demo_id === 'STD-DEMO-001'
      || /industrial safety helmet/i.test(`${row.title || ''} ${row.description || ''}`))
    : null;
  if (helmet) {
    const description = String(helmet.description || '');
    const section = (label) => {
      const match = description.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n\\n[A-Z][^:]+:|$)`, 'i'));
      return match?.[1]?.split(';').map((item) => item.trim()).filter(Boolean) || [];
    };
    return {
      ...base,
      compliance: {
        product_category: 'Industrial Safety Helmet',
        standard_number: helmet.is_number,
        status: helmet.status || 'Active',
        applicability: helmet.certification_applicability || helmet.mandatory_voluntary,
        qco_reference: helmet.qco_reference || null,
        requirements: section('Key requirements'),
        tests: section('Testing requirements'),
        documents: section('Documentation required'),
        source: helmet.source_reference || helmet.demo_id || 'STD-DEMO-001',
        demo_notice: 'Synthetic BIS MITRA demonstration record — not an official BIS standard.',
      },
      action: {
        id: 'start-certification',
        label: 'Start Certification',
        prompt: `I want to apply for certification for my industrial safety helmet under ${helmet.is_number}.`,
      },
      retrieval_type: retrieval?.retrieval_type,
    };
  }
  if (retrieval) {
    return mergeProofPanel({
      ...base,
      retrieval_type: retrieval.retrieval_type,
      confidence: retrieval.confidence,
      insufficient_evidence: retrieval.insufficient_evidence,
    }, enrichProofPanel(query, probe, probe?.tool));
  }
  return mergeProofPanel(base, enrichProofPanel(query, probe, probe?.tool));
}

/** Advisory next-step button from the model. It only pre-fills a chat prompt; nothing executes. */
function withSuggestedAction(panel, cta) {
  if (panel.action || !cta?.label || !cta?.prompt) return panel;
  return {
    ...panel,
    action: { id: 'suggested', label: cta.label.slice(0, 40), prompt: cta.prompt.slice(0, 240), advisory: true },
  };
}

function formatAlertListAnswer(data) {
  const alerts = data?.alerts || [];
  if (!alerts.length) {
    return 'You have no active alerts right now. I will notify you when your application or complaint status changes.';
  }
  const lines = alerts.slice(0, 5).map(a => {
    const unread = a.read ? '' : ' [NEW]';
    return `• ${a.title}${unread} — ${a.message}`;
  });
  const tail = data.unread_count > alerts.length
    ? `\n(${data.unread_count} unread total)`
    : '';
  return `Here are your alerts:\n${lines.join('\n')}${tail}`;
}

/**
 * RAG + optional LLM + Truth Shield + Playwright live probe + persona + multi-turn history.
 */
export async function agentChat(message, {
  clusterId,
  topK = 8,
  personaMode = 'auto',
  liveProbe = 'auto',
  history = [],
  sessionId = null,
  userId = null,
  userPersona = null,
  language = 'en',
  userProfile = null,
  agentProfile = null,
  conversationId = null,
  confirmSubmit = false,
  confirmFields = null,
  chatModule = 'knowledge',
} = {}) {
  const cluster = resolveClusterId(clusterId);
  if (!cluster) {
    throw new Error('No cluster selected and no cluster is published to the agent');
  }
  if (!message?.trim()) {
    throw new Error('message required');
  }

  const clientHistory = Array.isArray(history)
    ? history.filter(m => m?.role && m?.text).slice(-8)
    : [];
  const storageKey = threadStorageKey(sessionId, { userId, conversationId });
  const prior = clientHistory;

  const sessionContext = storageKey
    ? loadSessionContext(storageKey, { userId, persona: userPersona, history: prior })
    : null;

  const profilePatch = rememberFacts(storageKey || sessionId, {
    userId,
    persona: userPersona,
    text: message,
    profile: userProfile || {},
  });

  const llmExtras = {
    language,
    portalPersona: userPersona,
    userProfile: { ...(userProfile || {}), ...profilePatch, ...(sessionContext?.userInfo || {}) },
  };

  const pending = storageKey ? getContext(storageKey)?.pendingAction : null;
  if (pending?.tool && WRITE_TOOLS[pending.tool]) {
    const text = message.trim();
    const confirmed = confirmSubmit || /^(confirm|yes|proceed|go ahead|हाँ|हां|पुष्टि)\b/i.test(text);
    const cancelled = /^(cancel|no|stop|never mind|रद्द)\b/i.test(text);
    if (confirmed || cancelled) {
      updateContext(storageKey, { pendingAction: null }, { userId, persona: userPersona });
      let answer;
      let probe = null;
      if (confirmed) {
        probe = await executeAgentTool(pending.tool, { ...pending.args, confirm: true });
        answer = formatPersonaPlaybook(pending.tool, probe?.data, pending.args?.query || text)
          || probe?.data?.message
          || `Done — ${WRITE_TOOLS[pending.tool]}.`;
      } else {
        answer = 'Okay, I have not done anything. The action was cancelled.';
      }
      const payload = {
        clusterId: cluster,
        query: text,
        answer,
        sources: [],
        personaMode: userPersona || 'citizen',
        uiMode: 'chat',
        panel: { status: confirmed ? 'Completed' : 'Cancelled', action: pending.tool, result: probe?.data || null },
        probe: probe ? { tool: pending.tool, query: pending.args?.query } : null,
        router: { intent: 'task', uiMode: 'chat', tool: pending.tool },
        llm: { used: false, configured: llmConfigured(), skipped: 'deterministic_action' },
        answered_at: new Date().toISOString(),
      };
      persistChatTurn(storageKey, { userMessage: text, assistantResult: payload, router: payload.router, userId, persona: userPersona });
      return payload;
    }
    updateContext(storageKey, { pendingAction: null }, { userId, persona: userPersona });
  }

  const complaintCandidate = wantsComplaintFiling(message)
    || (sessionContext?.currentTask === 'complaint_collect');
  if (complaintCandidate && sessionContext?.currentTask !== 'certification_collect') {
    const complaint = await handleComplaintTurn({
      personaId: userPersona,
      message,
      sessionId: storageKey || sessionId,
      portalSessionId: sessionId,
      userId,
      language,
      confirmSubmit,
      confirmFields,
    });
    if (complaint.handled) {
      const panel = {
        confirmTable: complaint.table,
        status: complaint.submitted ? 'Submitted' : (complaint.table ? 'Awaiting confirmation' : 'Collecting'),
        record_id: complaint.submitted?.ticket_id || complaint.submitted?.tracking_id || null,
      };
      persistChatTurn(storageKey || sessionId, {
        userMessage: message,
        assistantResult: { answer: complaint.answer, uiMode: complaint.uiMode, panel },
        router: { intent: 'task', uiMode: complaint.uiMode, serviceId: 'SVC-GRIEV-001' },
        userId,
        persona: userPersona,
      });
      return {
        clusterId: cluster,
        query: message.trim(),
        answer: complaint.answer,
        sources: [],
        personaMode: userPersona || 'citizen',
        uiMode: complaint.uiMode,
        panel,
        profilePatch,
        router: { intent: 'task', uiMode: complaint.uiMode, tool: 'file_consumer_complaint', serviceId: 'SVC-GRIEV-001' },
        llm: { used: false, configured: llmConfigured(), skipped: 'deterministic_workflow' },
        answered_at: new Date().toISOString(),
      };
    }
  }

  if (CERT_PERSONAS.has(userPersona) && (
    confirmSubmit
    || wantsCertApplication(message)
    || sessionContext?.currentTask === 'certification_collect'
  )) {
    const intake = await handleCertificationTurn({
      personaId: userPersona,
      message,
      profile: { ...(userProfile || {}), ...profilePatch, ...(confirmFields || {}) },
      history: prior,
      sessionId: storageKey || sessionId,
      portalSessionId: sessionId,
      userId,
      language,
      confirmSubmit,
      confirmFields,
    });
    if (intake.handled) {
      if (intake.submitted?.reference_id || intake.submitted?.tracking_id) {
        await notifyApplicationSubmitted({
          referenceId: intake.submitted.reference_id || intake.submitted.tracking_id,
          sessionId,
          userId,
          persona: userPersona,
          product: intake.facts?.product,
          status: intake.submitted.status || 'Submitted',
        });
      }
      persistChatTurn(storageKey || sessionId, {
        userMessage: message,
        assistantResult: {
          answer: intake.answer,
          uiMode: intake.uiMode,
          panel: {
            confirmTable: intake.table,
            bisApplicationsUrl: APPLICATIONS_URL,
            status: intake.submitted ? 'Submitted' : (intake.table ? 'Awaiting confirmation' : 'Collecting'),
            record_id: intake.submitted?.reference_id || intake.submitted?.tracking_id || null,
          },
        },
        router: { intent: 'task', uiMode: intake.uiMode },
        userId,
        persona: userPersona,
      });
      return {
        clusterId: cluster,
        query: message.trim(),
        answer: intake.answer,
        sources: [],
        personaMode: userPersona || 'industry',
        uiMode: intake.uiMode,
        panel: {
          confirmTable: intake.table,
          bisApplicationsUrl: APPLICATIONS_URL,
          status: intake.submitted ? 'Submitted' : (intake.table ? 'Awaiting confirmation' : 'Collecting'),
          record_id: intake.submitted?.reference_id || intake.submitted?.tracking_id || null,
        },
        profilePatch: intake.facts || profilePatch,
        router: { intent: 'task', uiMode: intake.uiMode },
        answered_at: new Date().toISOString(),
      };
    }
  }

  if (confirmSubmit || wantsApplication(message)) {
    const table = buildConfirmTable({
      personaId: userPersona,
      query: message,
      profile: { ...(userProfile || {}), ...profilePatch, ...(confirmFields || {}) },
      history: prior,
    });
    if (confirmFields) table.fields = { ...table.fields, ...confirmFields };
    let answer = confirmAnswer(table, language);
    let submitted = null;
    if (confirmSubmit && !table.missing.length) {
      submitted = await runConfirmedSubmit(table);
      answer = language === 'hi'
        ? `आवेदन जमा हो गया। क्रमांक ${submitted.reference_id || submitted.tracking_id || submitted.ticket_id || 'BIS-APP'}।`
        : `Application submitted. Reference ${submitted.reference_id || submitted.tracking_id || submitted.ticket_id || 'BIS-APP'}.`;
    } else if (confirmSubmit && table.missing.length) {
      answer = confirmAnswer(table, language);
    }
    return {
      clusterId: cluster,
      query: message.trim(),
      answer,
      sources: [],
      personaMode: userPersona || 'industry',
      uiMode: 'confirm',
      panel: {
        confirmTable: submitted ? null : table,
        bisApplicationsUrl: APPLICATIONS_URL,
        status: submitted ? 'Submitted' : 'Awaiting confirmation',
        record_id: submitted?.reference_id || submitted?.tracking_id || null,
      },
      profilePatch,
      router: { intent: 'task', uiMode: 'confirm' },
      answered_at: new Date().toISOString(),
    };
  }

  const router = routeQuery(message.trim(), { history: prior, sessionContext });
  const query = router.query;
  const persona = resolvePersonaMode(personaMode || userPersona, query, []);

  // User session alerts
  if (router.tool === 'list_user_alerts' || router.tool === 'get_alert_details') {
    const probe = await executeAgentTool(router.tool, {
      query,
      sessionId,
      session_id: sessionId,
      userId,
      user_id: userId,
      alert_id: router.entities?.alertIds?.[0],
      unread_only: /\bunread\b/i.test(query),
    });
    const draft = router.tool === 'get_alert_details'
      ? (probe.data?.message || probe.data?.title || 'Alert details retrieved.')
      : formatAlertListAnswer(probe.data);

    const result = {
      clusterId: cluster,
      query,
      answer: draft,
      sources: [],
      enforcement: null,
      expandedTerms: [],
      personaMode: persona,
      truthShield: { status: 'skip', reason: 'user_alerts' },
      verifiedFacts: [],
      hybrid: false,
      llm: { used: false, configured: llmConfigured() },
      probe: { tool: router.tool, query },
      liveProbe: null,
      intent: router.intent,
      alerts: probe.data?.alerts || (probe.data ? [probe.data] : []),
      unreadCount: probe.data?.unread_count ?? getUnreadCount({ sessionId, userId }),
      router: {
        intent: router.intent,
        capability: router.capability,
        tool: router.tool,
        dataSource: router.dataSource,
        uiMode: router.uiMode,
        confidence: router.confidence,
        isFollowUp: router.isFollowUp,
      },
      uiMode: 'alert',
      capability: router.capability,
      panel: buildCapabilityPanel(router, probe, null, query),
      retrievalStage: null,
      mode: `intent:${router.intent}+user_alerts`,
      answered_at: new Date().toISOString(),
    };

    if (sessionId) {
      persistChatTurn(storageKey || sessionId, {
        userMessage: message.trim(),
        assistantResult: result,
        router,
        userId,
        persona: userPersona,
      });
    }
    return result;
  }

  // Deterministic rules engine — no RAG
  if (router.useRulesEngine) {
    const ruleResult = await runDeterministicRule(router, query, router.entities);
    const probe = ruleResultToProbe(ruleResult);
    let draft = formatRuleAnswer(ruleResult);
    let llmMeta = { used: false, provider: llmProvider(), configured: llmConfigured() };

    const llmResult = await composeWithLlm({
      query,
      hits: [],
      intent: router.intent,
      persona,
      history: prior,
      ...llmExtras,
      enforcement: null,
      probe: { tool: 'run_deterministic_rule', data: probe.data },
      live: null,
    });
    if (llmResult?.text) {
      draft = llmResult.text;
      llmMeta = {
        used: true,
        provider: llmResult.provider,
        model: llmResult.model || null,
        configured: true,
      };
    } else if (llmResult?.error) {
      llmMeta.error = llmResult.error;
    }

    const ruleResultPayload = {
      clusterId: cluster,
      query,
      answer: draft,
      sources: ruleResultToSources(ruleResult),
      enforcement: null,
      expandedTerms: [],
      personaMode: persona,
      truthShield: { status: 'skip', reason: 'deterministic_rule' },
      verifiedFacts: [],
      hybrid: false,
      llm: llmMeta,
      probe: { tool: 'run_deterministic_rule', query, rule_id: ruleResult.rule_id },
      liveProbe: null,
      intent: router.intent,
      rule: ruleResult,
      router: {
        intent: router.intent,
        capability: router.capability,
        tool: router.tool,
        ruleId: ruleResult.rule_id,
        dataSource: router.dataSource,
        uiMode: router.uiMode,
        confidence: router.confidence,
        isFollowUp: router.isFollowUp,
        classification: router.classification,
      },
      uiMode: router.uiMode,
      capability: router.capability,
      panel: buildCapabilityPanel(router, probe, null, query),
      retrievalStage: null,
      mode: [
        llmMeta.used ? `llm:${llmMeta.provider}` : 'template',
        `intent:${router.intent}`,
        `rule:${ruleResult.rule_id}`,
        `persona:${persona}`,
      ].join('+'),
      answered_at: new Date().toISOString(),
    };
    if (sessionId) {
      persistChatTurn(storageKey || sessionId, {
        userMessage: message.trim(),
        assistantResult: ruleResultPayload,
        router,
        userId,
        persona: userPersona,
      });
      await scanSessionAlerts(sessionId, { userId });
    }
    return ruleResultPayload;
  }

  // eBIS Workflow engine — probe tools, no RAG
  if (
    (router.useWorkflowEngine || (!router.useRag && router.useProbe && !router.useRulesEngine && router.uiMode === 'workflow'))
    && !WRITE_TOOLS[router.tool]
  ) {
    const extracted = extractWorkflowContext(prior);
    const wfCtx = {
      ...extracted,
      serviceId: router.serviceId || extracted.serviceId || router.workflowContext?.lastServiceId,
      recordId: extracted.recordId || router.workflowContext?.lastRecordId,
      product: extracted.product || router.workflowContext?.lastProduct,
    };
    const toolName = pickWorkflowTool(query, router, wfCtx);
    let wfResult = null;

    try {
      if (toolName === 'discover_ebis_service') {
        wfResult = await discoverEbisService(query, wfCtx);
      } else if (toolName === 'get_ebis_service') {
        const sid = router.serviceId || wfCtx.serviceId;
        wfResult = sid ? await getEbisService(sid) : await discoverEbisService(query, wfCtx);
      } else if (toolName === 'get_workflow_status') {
        const ids = router.entities || {};
        const recordId = ids.appIds?.[0] || ids.caseIds?.[0] || wfCtx.recordId || wfCtx.workflowId;
        wfResult = await getWorkflowStatus(recordId, wfCtx);
      } else {
        const probe = await executeAgentTool(toolName, { query, clusterId: cluster, ...wfCtx });
        wfResult = { ok: true, ...probe.data, source: probe.source };
      }
    } catch (err) {
      wfResult = { ok: false, error: err.message };
    }

    const probe = workflowResultToProbe(toolName, wfResult);
    let draft = formatWorkflowAnswer(wfResult, query);
    let llmMeta = { used: false, provider: llmProvider(), configured: llmConfigured() };

    const llmResult = await composeWithLlm({
      query,
      hits: [],
      intent: router.intent,
      persona,
      history: prior,
      ...llmExtras,
      enforcement: null,
      probe: { tool: toolName, data: probe.data },
      live: null,
    });
    if (llmResult?.text) {
      draft = llmResult.text;
      llmMeta = { used: true, provider: llmResult.provider, model: llmResult.model || null, configured: true };
    } else if (llmResult?.error) {
      llmMeta.error = llmResult.error;
    }

    const workflowPayload = {
      clusterId: cluster,
      query,
      answer: draft,
      sources: workflowResultToSources(wfResult),
      enforcement: null,
      expandedTerms: [],
      personaMode: persona,
      truthShield: { status: 'skip', reason: 'ebis_workflow' },
      verifiedFacts: [],
      hybrid: false,
      llm: llmMeta,
      probe: { tool: toolName, query },
      liveProbe: null,
      intent: router.intent,
      workflow: wfResult,
      router: {
        intent: router.intent,
        capability: router.capability,
        tool: toolName,
        serviceId: wfResult.service_id || router.serviceId,
        dataSource: router.dataSource,
        uiMode: router.uiMode,
        confidence: router.confidence,
        isFollowUp: router.isFollowUp,
        classification: router.classification,
      },
      uiMode: router.uiMode,
      capability: router.capability,
      panel: buildCapabilityPanel(router, probe, null, query),
      retrievalStage: null,
      mode: [
        llmMeta.used ? `llm:${llmMeta.provider}` : 'template',
        `intent:${router.intent}`,
        `workflow:${toolName}`,
        `persona:${persona}`,
      ].join('+'),
      answered_at: new Date().toISOString(),
      unreadCount: sessionId ? getUnreadCount({ sessionId, userId }) : 0,
    };
    if (sessionId) {
      persistChatTurn(storageKey || sessionId, {
        userMessage: message.trim(),
        assistantResult: workflowPayload,
        router,
        userId,
        persona: userPersona,
      });
      await scanSessionAlerts(sessionId, { userId });
    }
    return workflowPayload;
  }

  // Clone probe tools without RAG (registry, HUID, revision diff, FMCS lookup, etc.)
  if (!router.useRag && router.useProbe && router.tool && !router.useWorkflowEngine && !router.useRulesEngine) {
    let probe = null;
    try {
      probe = await executeAgentTool(router.tool, { query, clusterId: cluster });
    } catch {
      probe = { tool: router.tool, data: { query, _offline: true }, source: 'fallback' };
    }
    if (probe?.data?.awaiting_confirmation && probe.data.action && WRITE_TOOLS[probe.data.action] && storageKey) {
      const caseId = query.match(/ENF-DEMO-\d+/i)?.[0] || 'ENF-DEMO-001';
      const runId = argsRunIdFromQuery(query);
      updateContext(storageKey, {
        pendingAction: {
          tool: probe.data.action,
          args: { query, case_id: caseId, run_id: runId },
          requestedAt: new Date().toISOString(),
        },
      }, { userId, persona: userPersona });
      const evidenceTable = probe.data.action === 'log_raid_evidence'
        ? {
            kind: 'evidence',
            columns: ['Case ID', 'Evidence', 'Officer'],
            rows: [[caseId, 'Sealed sample reference and inspection photographs', 'FIELD-OFFICER-01']],
            missing: [],
            fields: { case_id: caseId, run_id: runId, product_description: 'Sealed sample and inspection photographs' },
          }
        : null;
      const answer = language === 'hi'
        ? `मैं यह कार्य कर सकता हूँ: ${WRITE_TOOLS[probe.data.action]}। आगे बढ़ने के लिए “confirm” लिखें, या “cancel”।`
        : `I can do this for you: **${WRITE_TOOLS[probe.data.action]}**.\n\nNothing has been done yet. Reply **confirm** to proceed or **cancel** to stop.`;
      return {
        clusterId: cluster,
        query,
        answer,
        sources: [],
        personaMode: persona,
        uiMode: 'confirm',
        panel: { status: 'Awaiting confirmation', action: probe.data.action, confirmTable: evidenceTable },
        probe: { tool: probe.data.action, query },
        router: { intent: 'task', uiMode: 'confirm', tool: probe.data.action },
        llm: { used: false, configured: llmConfigured(), skipped: 'awaiting_confirmation' },
        answered_at: new Date().toISOString(),
      };
    }
    let draft = formatPersonaPlaybook(router.tool, probe?.data, query)
      || probe?.data?.message
      || 'Verified details are shown in the panel below.';
    let llmMeta = { used: false, provider: llmProvider(), configured: llmConfigured() };
    const llmResult = await composeWithLlm({
      query,
      hits: [],
      intent: router.intent,
      persona,
      history: prior,
      ...llmExtras,
      enforcement: null,
      probe: { tool: router.tool, data: probe?.data },
      live: null,
    });
    if (llmResult?.text) {
      draft = llmResult.text;
      llmMeta = { used: true, provider: llmResult.provider, model: llmResult.model || null, configured: true };
    } else if (llmResult?.error) {
      llmMeta.error = llmResult.error;
    }
    const probePayload = {
      clusterId: cluster,
      query,
      answer: draft,
      sources: sourcesFromProbe(probe, router.tool),
      enforcement: null,
      expandedTerms: [],
      personaMode: persona,
      truthShield: { status: 'skip', reason: 'probe_no_rag' },
      verifiedFacts: [],
      hybrid: false,
      llm: llmMeta,
      probe: { tool: router.tool, query },
      liveProbe: null,
      intent: router.intent,
      router: {
        intent: router.intent,
        capability: router.capability,
        tool: router.tool,
        dataSource: router.dataSource,
        uiMode: router.uiMode,
        confidence: router.confidence,
        isFollowUp: router.isFollowUp,
        classification: router.classification,
      },
      uiMode: probePayloadUiMode(router, probe, query),
      capability: router.capability,
      panel: buildCapabilityPanel(router, probe, null, query),
      retrievalStage: null,
      mode: [
        llmMeta.used ? `llm:${llmMeta.provider}` : 'template',
        `intent:${router.intent}`,
        `probe:${router.tool}`,
        'no-rag',
        `persona:${persona}`,
      ].join('+'),
      answered_at: new Date().toISOString(),
    };
    if (sessionId) {
      persistChatTurn(storageKey || sessionId, {
        userMessage: message.trim(),
        assistantResult: probePayload,
        router,
        userId,
        persona: userPersona,
      });
    }
    return probePayload;
  }

  // Meta / greeting — no vector search
  if (!router.useRag) {
    let draft = metaAnswer(router.intent, persona);
    let llmMeta = { used: false, provider: llmProvider(), configured: llmConfigured() };
    const llmResult = await composeWithLlm({
      query,
      hits: [],
      intent: router.intent,
      persona,
      history: prior,
      ...llmExtras,
      enforcement: null,
      probe: null,
      live: null,
    });
    if (llmResult?.text) {
      draft = llmResult.text;
      llmMeta = {
        used: true,
        provider: llmResult.provider,
        model: llmResult.model || null,
        configured: true,
      };
    } else if (llmResult?.error) {
      llmMeta.error = llmResult.error;
    }

    const metaPayload = {
      clusterId: cluster,
      query,
      answer: draft,
      sources: [],
      enforcement: null,
      expandedTerms: [],
      personaMode: persona,
      truthShield: { status: 'skip', reason: 'meta_no_rag' },
      verifiedFacts: [],
      hybrid: false,
      llm: llmMeta,
      probe: null,
      liveProbe: null,
      intent: router.intent,
      router,
      uiMode: router.uiMode,
      capability: router.capability,
      panel: buildCapabilityPanel(router, null, null, query),
      retrievalStage: null,
      mode: [
        llmMeta.used ? `llm:${llmMeta.provider}` : 'template',
        `intent:${router.intent}`,
        'no-rag',
        `persona:${persona}`,
      ].join('+'),
      answered_at: new Date().toISOString(),
    };
    if (sessionId) {
      persistChatTurn(storageKey || sessionId, {
        userMessage: message.trim(),
        assistantResult: metaPayload,
        router,
        userId,
        persona: userPersona,
      });
    }
    return metaPayload;
  }

  const retrievalResult = await retrieve(query, {
    clusterId: cluster,
    topK,
    history: prior,
    // Carry prior IS/QCO/CML only for genuine follow-ups ("what about it?"), never into a new topic.
    contextEntities: router.isFollowUp ? router.contextEntities : {},
  });

  let probe = null;
  // Registry probe hints may refine knowledge lookups, but never override a transactional route.
  const skipLiveProbe = TRANSACTIONAL_INTENTS.has(router.intent)
    || (router.classification === 'rules' && router.tool);
  const probeHint = skipLiveProbe ? null : pickLiveProbe(query);
  const toolName = probeHint?.tool || router.tool;
  if (toolName && router.useProbe) {
    try {
      probe = await executeAgentTool(toolName, { query, clusterId: cluster });
    } catch {
      probe = { tool: toolName, data: { query, _offline: true }, source: 'fallback' };
    }
  }

  if (probe?.data?.awaiting_confirmation && probe.data.action && WRITE_TOOLS[probe.data.action] && storageKey) {
    const caseId = query.match(/ENF-DEMO-\d+/i)?.[0] || 'ENF-DEMO-001';
    const runId = argsRunIdFromQuery(query);
    updateContext(storageKey, {
      pendingAction: {
        tool: probe.data.action,
        args: { query, case_id: caseId, run_id: runId },
        requestedAt: new Date().toISOString(),
      },
    }, { userId, persona: userPersona });
    const evidenceTable = probe.data.action === 'log_raid_evidence'
      ? {
          kind: 'evidence',
          columns: ['Case ID', 'Evidence', 'Officer'],
          rows: [[caseId, 'Sealed sample reference and inspection photographs', 'FIELD-OFFICER-01']],
          missing: [],
          fields: { case_id: caseId, run_id: runId, product_description: 'Sealed sample and inspection photographs' },
        }
      : null;
    const answer = language === 'hi'
      ? `मैं यह कार्य कर सकता हूँ: ${WRITE_TOOLS[probe.data.action]}। आगे बढ़ने के लिए “confirm” लिखें, या “cancel”।`
      : `I can do this for you: **${WRITE_TOOLS[probe.data.action]}**.\n\nNothing has been done yet. Reply **confirm** to proceed or **cancel** to stop.`;
    const payload = {
      clusterId: cluster,
      query,
      answer,
      sources: [],
      personaMode: persona,
      uiMode: 'confirm',
      panel: {
        status: 'Awaiting confirmation',
        action: probe.data.action,
        confirmTable: evidenceTable,
      },
      probe: { tool: probe.data.action, query },
      router: { intent: 'task', uiMode: 'confirm', tool: probe.data.action },
      llm: { used: false, configured: llmConfigured(), skipped: 'awaiting_confirmation' },
      answered_at: new Date().toISOString(),
    };
    persistChatTurn(storageKey, { userMessage: message.trim(), assistantResult: payload, router, userId, persona: userPersona });
    return payload;
  }

  const contract = assertAnswerSourceContract(
    retrievalResult.chunks,
    retrievalResult.records,
    probe,
  );
  if (contract.pipelineBug) {
    console.error('[chat] PIPELINE BUG: evidence exists but no source resolved a BIS origin');
  }

  // Only feed validated evidence to the LLM (provenance contract).
  const hits = chunksToHits(contract.validated.length ? contract.validated : retrievalResult.chunks).slice(0, 4);

  const apiCount = Array.isArray(probe?.data?.results) ? probe.data.results.length : (probe ? 1 : 0);
  const forceLive = liveProbe === true || liveProbe === 'always';
  const skipLive = liveProbe === false || liveProbe === 'off';
  let live = null;
  if (router.useLive && !skipLive && shouldRunLiveProbe(query, { force: forceLive, apiResultCount: apiCount })) {
    live = await runLivePlaywrightProbe(query, { toolHint: probeHint?.tool || toolName });
  }

  // Enforcement status must belong to the product asked about: query IS first, else the top evidence only.
  const exp = expandQueryTerms(query);
  const queryIs = router.entities?.isNumbers || [];
  const hitIs = collectIsFromHits(hits.filter((h) => h.isNumbers?.length || h.metadata?.is_number).slice(0, 2));
  const isList = queryIs.length
    ? [...queryIs]
    : (hitIs.length ? hitIs : exp.expandedTerms.filter((t) => /^IS\s/i.test(t)));
  const enforcement = isList.length ? bestEnforcementForIsList(isList) : null;
  const authLine = retrievalResult.answer_context?.authoritativeEnforcement;
  const enforcementForLlm = authLine
    ? authoritativeEnforcement(authLine, enforcement)
    : enforcement;
  const verifiedFacts = extractVerifiedFacts(hits);
  const personaFinal = resolvePersonaMode(personaMode, query, hits);

  let draft;
  let llmMeta = { used: false, provider: llmProvider(), configured: llmConfigured() };
  let llmContract = null;

  // NO EVIDENCE → NO ANSWER (skip LLM inventing from empty context)
  if (!contract.hasEvidence && !live?.ok) {
    draft = retrievalResult.answer_context?.message
      || 'Insufficient evidence in the published knowledge index to answer this confidently.';
    llmMeta = { used: false, provider: llmProvider(), configured: llmConfigured(), skipped: 'no_evidence' };
  } else {
    const llmResult = await composeWithLlm({
      query,
      hits,
      intent: router.intent,
      probe: probe ? { tool: toolName, data: probe.data || probe } : null,
      live,
      enforcement: enforcementForLlm,
      persona: personaFinal,
      history: prior,
      ...llmExtras,
    });

    if (llmResult?.text) {
      draft = llmResult.text;
      llmMeta = {
        used: true,
        provider: llmResult.provider,
        model: llmResult.model || null,
        fallbackModel: llmResult.fallbackModel || undefined,
        configured: true,
        structured: !!llmResult.structured,
        citedEvidence: llmResult.citedEvidence || [],
        missingData: llmResult.contract?.missing_data || [],
        latency_ms: llmResult.latency_ms,
      };
      llmContract = llmResult.contract || null;
    } else {
      if (llmResult?.error) {
        llmMeta.error = llmResult.error;
        llmMeta.errorKind = llmResult.errorKind;
      }
      if (llmResult?.model) llmMeta.model = llmResult.model;
      const playbookAnswer = formatPersonaPlaybook(toolName, probe?.data || probe, query);
      draft = playbookAnswer || formatForPersona(personaFinal, {
        message: query,
        hits,
        probe,
        live,
        enforcement: enforcementForLlm,
        expanded: exp,
        verifiedFacts,
      });
      if (retrievalResult.insufficient_evidence && !probe && !playbookAnswer && !contract.validatedCount) {
        draft = retrievalResult.answer_context?.message
          || 'Insufficient evidence in the published knowledge index to answer this confidently.';
      }
    }
  }

  // Evidence existed but model refused — treat as pipeline issue, not empty corpus.
  // A structured answer is never overridden: citing evidence or declaring missing_data is an honest answer.
  const refusalText = llmContract ? llmContract.summary : draft;
  const refusedNoData = !llmMeta.structured
    && !(llmMeta.citedEvidence?.length)
    && /(?:don'?t|do not|does not|doesn't)\s+have\s+(?:specific\s+)?data|insufficient evidence|no (?:relevant )?information|not (?:available|found|listed) in (?:the )?(?:current )?(?:data|information set)|standard(?:\s*&?\s*qco)?\s*[–—-]\s*not listed|does not list a standard or qco/i
      .test(String(refusalText || ''));
  if (contract.validatedCount > 0 && refusedNoData) {
    const qTokens = String(query || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [];
    const ranked = [...hits].sort((a, b) => {
      const blob = (h) => `${h.title || ''} ${h.text || ''} ${h.textPreview || ''} ${h.metadata?.demo_id || ''}`.toLowerCase();
      const score = (h) => qTokens.reduce((n, t) => n + (blob(h).includes(t) ? 1 : 0), 0) + (h.score || 0);
      return score(b) - score(a);
    });
    const best = ranked[0] || hits[0];
    if (best?.textPreview || best?.text) {
      console.warn('[chat] LLM refused while validated evidence exists — grounding from best matching evidence');
      const body = String(best.text || best.textPreview).replace(/\s+/g, ' ').trim().slice(0, 700);
      const id = best.record_id || best.metadata?.demo_id || best.label || best.title || 'knowledge record';
      draft = `Based on the available BIS knowledge evidence for your question:\n\n**${id}**\n\n${body}`
        + (enforcementForLlm?.enforcement_status
          ? `\n\nEnforcement: **${enforcementForLlm.enforcement_status}** (${enforcementForLlm.is_number || 'see source'}).`
          : '');
      llmMeta = { ...llmMeta, groundedFallback: true };
    }
  }

  const shielded = applyTruthShield(draft, {
    hits,
    probe: live?.ok ? { data: live } : probe,
    extraCorpus: { query, enforcement: enforcementForLlm, verifiedFacts, expandedTerms: exp.expandedTerms },
  });
  draft = shielded.answer;

  let uiSources = buildUiSources(hits, retrievalResult.sources, probe, toolName);
  // EVIDENCE → keep diversified validated sources if the cap wiped them
  if (contract.validatedCount > 0 && uiSources.length < 2) {
    const restorable = contract.validated.slice(0, 5);
    const restored = mapSources(chunksToHits(restorable), restorable.map((top) => ({
      ...top,
      type: 'chunk',
      sourceUrl: top.portalUrl || top.sourceUrl,
    })));
    const merged = capSources([...uiSources, ...restored]);
    if (merged.length > uiSources.length) {
      console.warn('[chat] restoring diversified validated sources after aggressive cap');
      uiSources = merged;
    }
  }

  const ragPayload = {
    clusterId: cluster,
    query,
    answer: draft,
    sources: uiSources,
    chatModule: chatModule === 'advice' ? 'advice' : 'knowledge',
    modules: buildModuleTags(router, retrievalResult, probe, toolName, llmMeta),
    profilePatch,
    enforcement: enforcementForLlm,
    expandedTerms: exp.expandedTerms,
    personaMode: personaFinal,
    truthShield: shielded.shield,
    verifiedFacts,
    hybrid: !!retrievalResult.hybrid,
    llm: llmMeta,
    probe: probe ? { tool: probe.tool || toolName, query } : (toolName ? { tool: toolName, query } : null),
    liveProbe: live,
    intent: router.intent,
    router: {
      intent: router.intent,
      capability: router.capability,
      tool: router.tool,
      dataSource: router.dataSource,
      uiMode: router.uiMode,
      confidence: router.confidence,
      isFollowUp: router.isFollowUp,
      classification: router.classification,
    },
    uiMode: chatModule === 'advice' ? 'advice' : router.uiMode,
    capability: router.capability,
    panel: withSuggestedAction({
      ...buildCapabilityPanel(router, probe, retrievalResult, query),
      noVerifiedSources: chatModule !== 'advice' && !uiSources.length,
      missingData: llmContract?.missing_data?.length ? llmContract.missing_data : undefined,
    }, llmContract?.suggested_cta),
    retrieval: {
      type: retrievalResult.retrieval_type,
      methods: retrievalResult.methods_used,
      confidence: retrievalResult.confidence,
      latency_ms: retrievalResult.latency_ms,
      insufficient_evidence: retrievalResult.insufficient_evidence,
      provenance: retrievalResult.provenance,
    },
    retrievalStage: retrievalResult.stage,
    mode: [
      llmMeta.used ? `llm:${llmMeta.provider}` : 'template',
      `intent:${router.intent}`,
      retrievalResult.retrieval_type,
      probe ? 'api-probe' : null,
      live?.ok ? 'playwright-live' : (live && !live.ok && !live.skipped ? 'live-failed' : null),
      `persona:${personaFinal}`,
      `shield:${shielded.shield.status}`,
    ].filter(Boolean).join('+'),
    answered_at: new Date().toISOString(),
    unreadCount: sessionId ? getUnreadCount({ sessionId, userId }) : 0,
  };

  if (sessionId) {
    persistChatTurn(storageKey || sessionId, {
      userMessage: message.trim(),
      assistantResult: ragPayload,
      router,
      userId,
      persona: userPersona,
    });
    await scanSessionAlerts(sessionId, { userId });
  }

  return ragPayload;
}

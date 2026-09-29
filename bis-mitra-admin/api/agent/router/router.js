import { classifyIntent } from '../intent.js';
import { extractIdentifiers } from '../../retrieval/identifiers.js';
import { resolveQueryWithContext } from './context.js';
import { resolveQueryWithSessionContext } from '../../context/context-service.js';
import { ROUTE_CONFIG, ROUTE_RULES } from './config.js';
import { routeConfigForIntent, getCapability } from './capabilities.js';

/**
 * Rule-based intent classification (no giant prompt).
 */
function classifyByRules(query, identifiers) {
  for (const rule of ROUTE_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(query)) {
        const base = routeConfigForIntent(rule.intent);
        return {
          ...base,
          tool: rule.tool || base.tool,
          ruleId: rule.ruleId || base.ruleId,
          serviceId: rule.serviceId || base.serviceId,
          confidence: 0.82,
          matchedRule: pat.source,
        };
      }
    }
  }

  if (identifiers.hasExactId) {
    const isVerify = /\b(verify|active|status|check|valid)\b/i.test(query);
    if (identifiers.huidCodes?.length || identifiers.cmlIds?.length || isVerify) {
      const cfg = routeConfigForIntent(identifiers.huidCodes?.length ? 'validation' : 'status');
      return {
        ...cfg,
        tool: 'run_deterministic_rule',
        ruleId: identifiers.huidCodes?.length ? 'VAL-HUID-001' : 'STATUS-CML-001',
        confidence: 0.88,
        matchedRule: 'exact_id_verification',
      };
    }
    const cfg = routeConfigForIntent('knowledge');
    return { ...cfg, confidence: 0.85, matchedRule: 'exact_id_knowledge' };
  }

  return null;
}

/**
 * Central agent router: LLM classification hooks + rules + context + capability registry.
 */
export function routeQuery(message, { history = [], sessionContext = null } = {}) {
  const resolved = sessionContext
    ? resolveQueryWithSessionContext(message, history, sessionContext)
    : resolveQueryWithContext(message, history);
  const { query, originalQuery, contextEntities, identifiers, isFollowUp, workflowContext } = resolved;

  const meta = classifyIntent(query);
  if (!meta.useRag && (meta.intent === 'greeting' || meta.intent === 'about' || meta.intent === 'empty')) {
    const cfg = routeConfigForIntent(meta.intent === 'empty' ? 'greeting' : meta.intent);
    return {
      ...cfg,
      query,
      originalQuery,
      entities: identifiers,
      contextEntities,
      workflowContext,
      isFollowUp,
      confidence: 0.95,
      classification: 'meta',
      capabilityInfo: getCapability(cfg.capability),
    };
  }

  const ruled = classifyByRules(query, identifiers);
  const route = ruled || {
    ...routeConfigForIntent('knowledge'),
    confidence: 0.65,
    matchedRule: 'default_knowledge',
  };

  const finalRoute = {
    ...route,
    query,
    originalQuery,
    entities: identifiers,
    contextEntities,
    workflowContext,
    isFollowUp,
    classification: ruled ? 'rules' : 'default',
    capabilityInfo: getCapability(route.capability),
    dataSource: route.dataSource,
    responseMode: route.responseType,
    uiMode: route.uiMode,
  };

  if (finalRoute.intent === 'alert' && sessionContext?.sessionId) {
    const wantsCompliance = /\b(compliance|fingerprint|what\s+changed|overnight|standard\s+amendment)\b/i.test(query);
    if (!wantsCompliance && finalRoute.tool === 'check_system_freshness') {
      finalRoute.tool = 'list_user_alerts';
      finalRoute.dataSource = 'user_alerts';
    }
  }

  return finalRoute;
}

export { ROUTE_CONFIG, ROUTE_RULES };

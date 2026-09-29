import { ROUTE_CONFIG } from './config.js';
import { TOOL_CONNECTOR } from '../tools.js';

/**
 * Capability registry — maps capability name to execution metadata.
 */
export const CAPABILITY_REGISTRY = {
  meta: {
    name: 'meta',
    description: 'Greetings and capability intros',
    execute: 'template',
  },
  retrieval: {
    name: 'retrieval',
    description: 'Knowledge/RAG retrieval from published index',
    execute: 'retrieve',
    dataSources: ['rag_index', 'clone_api'],
  },
  verification_engine: {
    name: 'verification_engine',
    description: 'Deterministic licence/HUID/registry verification',
    execute: 'rules_engine',
    dataSources: ['rules_engine', 'clone_api'],
  },
  validation_engine: {
    name: 'validation_engine',
    description: 'Deterministic validation against BIS registries',
    execute: 'rules_engine',
    dataSources: ['rules_engine', 'clone_api'],
  },
  status_engine: {
    name: 'status_engine',
    description: 'Deterministic status checks (licence, lab)',
    execute: 'rules_engine',
    dataSources: ['rules_engine', 'clone_api'],
  },
  eligibility_engine: {
    name: 'eligibility_engine',
    description: 'QCO and certification eligibility checks',
    execute: 'rules_engine',
    dataSources: ['rules_engine', 'clone_api'],
  },
  calculator: {
    name: 'calculator',
    description: 'Fee and compensation calculations',
    execute: 'probe',
    dataSources: ['clone_rules', 'clone_api'],
  },
  comparison_engine: {
    name: 'comparison_engine',
    description: 'Standard amendment and revision comparison',
    execute: 'rules_engine',
    dataSources: ['rules_engine', 'clone_api'],
  },
  alert_engine: {
    name: 'alert_engine',
    description: 'Compliance and system alerts',
    execute: 'probe',
    dataSources: ['compliance_alerts'],
  },
  workflow_engine: {
    name: 'workflow_engine',
    description: 'eBIS service discovery, applications, complaints, and status tracking',
    execute: 'workflow_engine',
    dataSources: ['ebis_workflow', 'clone_api'],
  },
  document_engine: {
    name: 'document_engine',
    description: 'Template and document generation',
    execute: 'probe',
    dataSources: ['clone_templates'],
  },
  translation: {
    name: 'translation',
    description: 'Hindi/multilingual educational content',
    execute: 'probe',
    dataSources: ['bilingual_api'],
  },
  analysis_engine: {
    name: 'analysis_engine',
    description: 'Formula derivation and engineering analysis',
    execute: 'probe',
    dataSources: ['rag_index', 'clone_api'],
  },
};

export function getCapability(name) {
  return CAPABILITY_REGISTRY[name] || null;
}

export function resolveToolConnector(toolName) {
  return TOOL_CONNECTOR[toolName] || null;
}

export function routeConfigForIntent(intent) {
  return ROUTE_CONFIG[intent] || ROUTE_CONFIG.knowledge;
}

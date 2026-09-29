import { planIdForCluster, stripClusterPrefix } from './clusters.js';

/** Fixed warehouse sections — agent chunk tags match domain id */
export const SECTIONS = [
  { id: 'news', title: 'News', tag: 'chunk:news', ingestPlanBase: 'ingest_bis_news' },
  { id: 'fees', title: 'Fees', tag: 'chunk:fees', ingestPlanBase: 'ingest_marking_fees' },
  { id: 'manuals', title: 'Manuals', tag: 'chunk:manuals', ingestPlanBase: 'ingest_product_manuals' },
  { id: 'standards', title: 'Standards', tag: 'chunk:standards', ingestPlanBase: 'ingest_all_standards' },
  { id: 'process', title: 'Process', tag: 'chunk:process', ingestPlanBase: 'ingest_process_pdfs' },
  { id: 'schemes', title: 'Schemes & QCOs', tag: 'chunk:schemes', ingestPlanBase: 'ingest_schemes_docs' },
  { id: 'hallmarking', title: 'Hallmarking', tag: 'chunk:hallmarking', ingestPlanBase: 'ingest_hallmarking_docs' },
  { id: 'labs', title: 'Labs & LRS', tag: 'chunk:labs', ingestPlanBase: 'ingest_labs_docs' },
  { id: 'consumer', title: 'Consumer affairs', tag: 'chunk:consumer', ingestPlanBase: 'ingest_consumer_docs' },
];

export const CONNECTOR_SECTION = {
  news_api: 'news',
  standards_api: 'standards',
  manuals_api: 'manuals',
  fees_api: 'fees',
  process_api: 'process',
  schemes_api: 'schemes',
  hallmarking_api: 'hallmarking',
  labs_docs_api: 'labs',
  consumer_docs_api: 'consumer',
  demo_standards_api: 'standards',
  demo_qco_api: 'schemes',
  demo_certification_api: 'schemes',
  demo_laboratories_api: 'labs',
  demo_hallmarking_huid_api: 'hallmarking',
  demo_consumer_complaints_api: 'consumer',
  demo_enforcement_api: 'schemes',
  demo_surveillance_api: 'schemes',
};

export const CONNECTOR_BY_BASE = {
  ingest_bis_news: 'news_api',
  ingest_all_standards: 'standards_api',
  ingest_product_manuals: 'manuals_api',
  ingest_marking_fees: 'fees_api',
  ingest_process_pdfs: 'process_api',
  ingest_schemes_docs: 'schemes_api',
  ingest_hallmarking_docs: 'hallmarking_api',
  ingest_labs_docs: 'labs_docs_api',
  ingest_consumer_docs: 'consumer_docs_api',
  ingest_demo_standards: 'demo_standards_api',
  ingest_demo_qco: 'demo_qco_api',
  ingest_demo_certification: 'demo_certification_api',
  ingest_demo_laboratories: 'demo_laboratories_api',
  ingest_demo_hallmarking_huid: 'demo_hallmarking_huid_api',
  ingest_demo_consumer_complaints: 'demo_consumer_complaints_api',
  ingest_demo_enforcement: 'demo_enforcement_api',
  ingest_demo_surveillance: 'demo_surveillance_api',
  probe_kys_search: 'standards_search',
  probe_marking_fee: 'fees_search',
  probe_fetch_orgdata: 'fetch_orgdata',
  probe_standard_detail: 'standard_detail',
  probe_compulsory_search: 'compulsory_search',
  probe_certification_search: 'certification_search',
  probe_manual_search: 'manuals_search',
  probe_news_search: 'news_search',
  probe_application_search: 'application_search',
  probe_licence_search: 'licence_search',
  probe_hallmarking_search: 'hallmarking_search',
  probe_labs_search: 'labs_search',
  probe_consumer_search: 'consumer_search',
  probe_qco_search: 'qco_search',
};

export { stripClusterPrefix };

export function planBaseId(planId, clusterId) {
  return stripClusterPrefix(planId, clusterId);
}

export function sectionForPlan(plan) {
  if (plan.section) return plan.section;
  if (plan.connector && CONNECTOR_SECTION[plan.connector]) {
    return CONNECTOR_SECTION[plan.connector];
  }
  const base = stripClusterPrefix(plan.id, plan.clusterId);
  const sec = SECTIONS.find(s => s.ingestPlanBase === base);
  return sec?.id || null;
}

export function ingestPlanIdForSection(clusterId, sectionId) {
  const sec = SECTIONS.find(s => s.id === sectionId);
  if (!sec?.ingestPlanBase) return null;
  return planIdForCluster(clusterId, sec.ingestPlanBase);
}

export { ingestPlanIdForSection as ingestPlanIdForCluster };

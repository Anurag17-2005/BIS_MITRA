import { planIdForCluster, stripClusterPrefix } from './clusters';

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

export function ingestPlanIdForCluster(clusterId, sectionId) {
  const sec = SECTIONS.find(s => s.id === sectionId);
  if (!sec?.ingestPlanBase) return null;
  return planIdForCluster(clusterId, sec.ingestPlanBase);
}

export function sectionForPlan(plan) {
  if (!plan) return '—';
  if (plan.section) return plan.section;
  if (plan.kind === 'probe') return '—';
  const base = stripClusterPrefix(plan.id, plan.clusterId);
  const sec = SECTIONS.find(s => s.ingestPlanBase === base);
  return sec?.id || '—';
}

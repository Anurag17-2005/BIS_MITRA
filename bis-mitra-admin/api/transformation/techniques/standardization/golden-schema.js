import { sectionTag } from '../../config/sections.js';

/**
 * Build a golden record from warehouse item + processed draft.
 */
export function toGoldenRecord(item, draft, { contentHash, duplicateOf }) {
  const title = draft.title
    || item.meta?.title
    || item.meta?.is_number
    || item.name
    || item.id;

  return {
    id: `golden-${item.id}`,
    warehouseItemId: item.id,
    clusterId: item.clusterId,
    section: item.domain,
    sectionTag: sectionTag(item.domain),
    source: item.source || 'unknown',
    protected: !!item.protected,
    title: String(title).trim(),
    text: draft.text || '',
    isNumbers: draft.isNumbers || [],
    contentHash,
    duplicateOf: duplicateOf || null,
    language: draft.language || 'en',
    meta: {
      originalName: item.name,
      warehouseType: item.type,
      planId: item.planId || null,
      knowledgeFolder: item.meta?.knowledgeFolder || null,
      rawFormat: draft.rawMeta?.format || null,
      pageCount: draft.rawMeta?.pageCount ?? null,
      pageMap: draft.rawMeta?.pageMap || null,
      sourcePath: draft.rawMeta?.sourcePath || null,
      ocrPending: draft.rawMeta?.ocrPending || false,
    },
    quality: draft.quality || { status: 'ok', warnings: [] },
    catalog: item.catalog || null,
    regulatory: draft.regulatory || item.regulatory || null,
    layman_synonyms: draft.layman_synonyms || [],
    related_standards: draft.related_standards || [],
    testing_machinery: draft.testing_machinery || [],
    provenance: {
      updatedAt: item.updatedAt || null,
      fetchMethod: item.fetchMethod || null,
      processedAt: new Date().toISOString(),
      fetchId: item.catalog?.fetch_id || null,
      canonicalUrl: item.catalog?.canonical_url || null,
      contentSha256: item.catalog?.content_sha256 || null,
      licenseClass: item.catalog?.license_class || 'public',
    },
  };
}

export function validateGoldenRecord(record) {
  const warnings = [];
  if (!record.warehouseItemId) warnings.push('missing warehouseItemId');
  if (!record.clusterId) warnings.push('missing clusterId');
  if (!record.section) warnings.push('missing section');
  if (!record.text && record.quality?.status !== 'duplicate') {
    warnings.push('empty text');
  }
  return warnings;
}

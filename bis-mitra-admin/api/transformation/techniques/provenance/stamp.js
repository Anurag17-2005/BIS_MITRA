function inferSourceType(item, canonicalUrl) {
  if (canonicalUrl) {
    if (canonicalUrl.includes('/product-certification/compulsory')) return 'compulsory_portal';
    if (canonicalUrl.includes('/product-certification/')) return 'process_portal';
    if (canonicalUrl.includes('/consumer')) return 'consumer_portal';
    if (canonicalUrl.includes('bis.gov.in') || canonicalUrl.includes('localhost:3001')) return 'bis_portal';
  }
  const existing = item.catalog?.source_type || item.content?.source_type || null;
  if (existing) return existing;
  const fmt = item.meta?.rawFormat || item.type || '';
  if (/pdf/i.test(String(fmt)) || /\.pdf$/i.test(String(item.name || ''))) return 'pdf';
  if (/json|sqlite/i.test(String(fmt)) || /\.json$/i.test(String(item.name || ''))) return 'json';
  return item.fetchMethod === 'db' ? 'sqlite' : 'json';
}

function cleanDomain(raw) {
  if (!raw) return null;
  return String(raw).replace(/^chunk:/i, '').trim() || null;
}

export function stampProvenance(item, record) {
  const cat = item.catalog || record.catalog;
  const canonicalUrl = cat?.canonical_url || record.provenance?.canonicalUrl || null;
  const inferredType = inferSourceType(item, canonicalUrl);
  const domain = cleanDomain(record.metadata?.domain || item.domain || record.section);

  return {
    ...record,
    catalog: cat,
    metadata: {
      ...(record.metadata || {}),
      source_url: canonicalUrl || record.metadata?.source_url || null,
      source_type: inferredType || record.metadata?.source_type || null,
      domain: domain || record.metadata?.domain || null,
    },
    provenance: {
      ...record.provenance,
      warehouseSource: item.source,
      warehouseUpdatedAt: item.updatedAt,
      protected: !!item.protected,
      pipelineVersion: 2,
      artifactId: cat?.artifact_id || item.id,
      fetchId: cat?.fetch_id || null,
      canonicalUrl,
      sourceType: inferredType,
      contentSha256: cat?.content_sha256 || record.contentHash || null,
      licenseClass: cat?.license_class || 'public',
      fetchedAt: cat?.fetched_at || item.updatedAt,
    },
  };
}

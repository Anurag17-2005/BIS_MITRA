/**
 * Resolve warehouse item → browser-openable URL.
 * - uploads → /api/uploads/...
 * - clone public PDFs → /api/clone-files/...
 * - Playwright fetched PDFs → /api/files/...
 */
export function warehouseViewUrl(item) {
  if (!item) return null;
  if (item.viewUrl) return item.viewUrl;

  if (item.source === 'upload' || item.storagePath) {
    const rel = String(item.storagePath || '')
      .replace(/^uploads[/\\]/, '')
      .replace(/\\/g, '/');
    if (rel) return `/api/uploads/${rel}`;
    if (item.clusterId && item.domain && item.name) {
      return `/api/uploads/${item.clusterId}/${item.domain}/${item.name}`;
    }
  }

  if (!item.filePath) return null;

  const raw = String(item.filePath).replace(/\\/g, '/');
  const fetchedIdx = raw.indexOf('/fetched/');
  if (item.fileSource === 'fetched' || fetchedIdx >= 0) {
    const rel = fetchedIdx >= 0
      ? raw.slice(fetchedIdx + '/fetched/'.length)
      : raw.replace(/^[/]+/, '');
    return `/api/files/${rel}`;
  }

  const rel = raw.replace(/^[/]+/, '');
  const remapped = {
    'manuals/IS-4151-2015.pdf': 'knowledge/pdfs/manuals/PM-IS-4151-helmet-2024.pdf',
    'manuals/IS-623-2025.pdf': 'knowledge/pdfs/manuals/PM-IS-623-bicycle-frame-2024.pdf',
    'manuals/IS-3055-1994.pdf': 'knowledge/pdfs/manuals/PM-IS-3055-clinical-thermometer.pdf',
    'manuals/IS-170-2020.pdf': 'knowledge/pdfs/manuals/PM-IS-269-portland-cement-2023.pdf',
    'manuals/IS-1-1968.pdf': 'knowledge/pdfs/manuals/PM-IS-10613-bicycle-safety-bilingual.pdf',
    'process/certification-process-guidelines.pdf': 'knowledge/pdfs/process/grant-of-licence-guidelines-2026.pdf',
    'process/scheme-1-additional.pdf': 'knowledge/pdfs/schemes/scheme-1-notification-2024.pdf',
    'process/non-conformity-guidelines.pdf': 'knowledge/pdfs/process/dealing-with-non-conformity-2026.pdf',
  }[rel] || rel;
  return `/api/clone-files/${remapped}`;
}

export function enrichWarehouseItem(item) {
  if (!item) return item;
  const viewUrl = warehouseViewUrl(item);
  return viewUrl ? { ...item, viewUrl } : { ...item };
}

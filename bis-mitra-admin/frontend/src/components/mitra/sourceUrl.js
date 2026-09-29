/** Resolve agent source citation to a browser-openable PDF URL on the admin API. */
export function sourceToPdfUrl(source) {
  if (!source) return null;
  const file = source.source_file || source.sourceFile || source.storage_uri;
  if (!file) return null;
  const raw = String(file).replace(/\\/g, '/').replace(/^\/+/, '');
  let base;
  if (raw.startsWith('http')) base = raw;
  else if (raw.startsWith('knowledge/')) base = `/api/clone-files/${raw}`;
  else if (raw.includes('/')) base = `/api/clone-files/knowledge/pdfs/${raw}`;
  else base = `/api/clone-files/knowledge/pdfs/manuals/${raw}`;

  const page = source.page || source.pageNumber || parsePageFromSection(source.section);
  if (page && !base.includes('#')) return `${base}#page=${page}`;
  return base;
}

function parsePageFromSection(section) {
  if (!section) return null;
  const m = String(section).match(/page\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function sourceDisplayTitle(source) {
  return source?.title || source?.citationAnchor || source?.source_file || source?.chunkId || 'Source';
}

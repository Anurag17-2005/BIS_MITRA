import { openOnBisUrl, SOURCE_MIN_SCORE, SOURCE_RELATIVE_FLOOR, SOURCE_MAX } from './bisUrls';

export { openOnBisUrl };

/** @deprecated use openOnBisUrl */
export function publicBisUrl(source) {
  return openOnBisUrl(source);
}

export function hasPdfFile(source) {
  const file = source?.storage_uri || source?.source_file || source?.file || '';
  return /\.pdf($|\?|#)/i.test(String(file)) || String(file).includes('knowledge/pdfs');
}

function prettyFile(source) {
  const raw = source?.storage_uri || source?.source_file || '';
  if (!raw) return null;
  const base = String(raw).split('/').pop().replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function titleFromUrl(url) {
  if (!url) return null;
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean).pop();
    if (!seg) return null;
    return decodeURIComponent(seg).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return null;
  }
}

function groupTitle(source) {
  const fromFile = prettyFile(source);
  if (fromFile) return fromFile;
  const t = source.title;
  if (t && !/^source$/i.test(String(t).trim())) return t;
  return titleFromUrl(source.sourceUrl || source.source_reference) || null;
}

function badLabel(label) {
  const s = String(label || '').trim();
  if (!s) return true;
  if (/^passage \d+$/i.test(s)) return true;
  if (/^\s*\{/.test(s) && /"demo_id"/.test(s)) return true;
  return false;
}

function passageLabel(source) {
  if (source.label && !badLabel(source.label)) return source.label;
  if (source.passage && !badLabel(source.passage)) return source.passage;
  if (source.section) return source.section;
  const raw = String(source.textPreview || '').replace(/\s+/g, ' ').trim();
  if (raw.length > 24 && !/^\s*\{/.test(raw)) return raw.slice(0, 90);
  return null;
}

function isAuthoritative(source) {
  if (source.retrievalMethod === 'qco_join') return true;
  if (source.retrievalMethod === 'exact_identifier') return true;
  if (source.source_type === 'compulsory_portal') return true;
  if (source.authoritative === true) return true;
  return typeof source.score === 'number' && source.score >= 0.95;
}

function identityKey(source) {
  const file = String(source.storage_uri || source.source_file || '')
    .split('/').pop()?.toLowerCase() || '';
  const record = String(source.record_id || source.demo_id || '').toLowerCase();
  if (file && record) return `file:${file}|rec:${record}`;
  if (file) return `file:${file}`;
  if (record) return `rec:${record}`;
  const url = String(source.sourceUrl || source.source_reference || '').toLowerCase();
  if (url) return `url:${url}`;
  return `title:${String(source.title || 'x').toLowerCase()}`;
}

function filterForDisplay(sources = []) {
  const sorted = [...sources].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (!sorted.length) return [];

  // Relative floor from hybrid scores only — ignore QCO 0.99 injects
  let hybridTop = 0;
  for (const s of sorted) {
    if (isAuthoritative(s)) continue;
    if (typeof s.score === 'number' && s.score > hybridTop) hybridTop = s.score;
  }
  const relMin = hybridTop > 0 ? hybridTop * SOURCE_RELATIVE_FLOOR : SOURCE_MIN_SCORE;
  const min = Math.max(SOURCE_MIN_SCORE, relMin);

  const bestByKey = new Map();
  for (const source of sorted) {
    const key = identityKey(source);
    if (!bestByKey.has(key)) bestByKey.set(key, source);
  }
  const diversify = [...bestByKey.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const filtered = [];
  const seen = new Set();

  for (const source of diversify) {
    if (!isAuthoritative(source)
      && source.retrievalMethod !== 'qco_join'
      && source.source_type !== 'compulsory_portal'
      && source.retrievalMethod !== 'exact_identifier') {
      continue;
    }
    const key = identityKey(source);
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(source);
    if (filtered.length >= SOURCE_MAX) return filtered;
  }

  for (const source of diversify) {
    const key = identityKey(source);
    if (seen.has(key)) continue;
    const exempt = source.source_type === 'compulsory_portal'
      || source.retrievalMethod === 'qco_join'
      || source.retrievalMethod === 'exact_identifier'
      || (source.portalUrl && typeof source.score !== 'number');
    if (!exempt && typeof source.score === 'number' && source.score < min) continue;
    seen.add(key);
    filtered.push(source);
    if (filtered.length >= SOURCE_MAX) break;
  }

  // Guarantee at least one hybrid document when only injects survived
  if (filtered.length && filtered.every(isAuthoritative)) {
    for (const source of diversify) {
      if (isAuthoritative(source)) continue;
      const key = identityKey(source);
      if (seen.has(key)) continue;
      filtered.push(source);
      break;
    }
  }

  return filtered.slice(0, SOURCE_MAX);
}

export function groupSources(sources = []) {
  const filtered = filterForDisplay(sources);

  const groups = [];
  const index = new Map();

  filtered.forEach((source, i) => {
    const label = passageLabel(source);
    const file = source.storage_uri || source.source_file || '';
    const webKey = source.sourceUrl || source.source_reference || '';
    const key = file || (webKey ? `url:${webKey}` : `title:${String(source.title || 'x').toLowerCase()}`);

    const title = groupTitle(source);
    if (!title && !label && !webKey && !file) return;

    let group = index.get(key);
    if (!group) {
      group = {
        key,
        title: title || prettyFile(source) || titleFromUrl(webKey) || null,
        storage_uri: source.storage_uri || null,
        source_file: source.source_file || null,
        sourceUrl: source.sourceUrl || source.source_reference || null,
        bisUrl: openOnBisUrl({ ...source, storage_uri: source.storage_uri || source.source_file }),
        passages: [],
        byRecord: new Map(),
      };
      index.set(key, group);
      groups.push(group);
    }

    const record_id = source.record_id || source.demo_id || null;
    const evidence = Array.isArray(source.evidence) ? source.evidence : [];
    const preview = evidence[0] || source.textPreview || label || '';
    const passage = {
      id: source.chunkId || `${key}-${i}`,
      label: label || (record_id ? record_id : null),
      preview,
      section: source.section || '',
      record_id,
      evidence,
      source,
      page_number: source.page_number || null,
      page_number_confidence: source.page_number_confidence || null,
    };

    if (!passage.label && !passage.preview && !record_id) {
      if (source.textPreview) {
        passage.preview = source.textPreview;
        passage.label = source.title || null;
      } else return;
    }

    if (record_id && group.byRecord.has(record_id)) {
      const prev = group.byRecord.get(record_id);
      if ((evidence.length || 0) > (prev.evidence?.length || 0)) {
        group.byRecord.set(record_id, passage);
        group.passages = group.passages.filter((p) => p.id !== prev.id);
        group.passages.push(passage);
      }
      return;
    }

    if (record_id) group.byRecord.set(record_id, passage);
    group.passages.push(passage);
  });

  for (const g of groups) {
    g.passages.sort((a, b) => (b.evidence?.length || 0) - (a.evidence?.length || 0));
    delete g.byRecord;
  }

  return groups.filter((g) => g.title || g.passages.length > 0 || g.bisUrl);
}

const DEFAULT_SIZE = 1200;
const DEFAULT_OVERLAP = 150;

const CLAUSE_LINE = /^(#{1,3}\s+|(?:clause|section|sub[- ]?clause|subsection)\s+\d)/i;
const MD_H1 = /^#\s+(.+)/;
const MD_H2 = /^##\s+(.+)/;
const MD_H3 = /^###\s+(.+)/;
const NUMBERED_CLAUSE = /^(?:clause\s+)?(\d+(?:\.\d+){0,3})\s*[-–:.)]\s*(.+)$/i;

/**
 * Character splitter with soft paragraph/sentence breaks (fallback).
 */
export function splitText(text, { size = DEFAULT_SIZE, overlap = DEFAULT_OVERLAP } = {}) {
  const src = (text || '').trim();
  if (!src) return [];
  if (src.length <= size) {
    return [{ index: 0, text: src, charStart: 0, charEnd: src.length, clause_path: null }];
  }

  const chunks = [];
  let start = 0;
  let idx = 0;
  while (start < src.length) {
    let end = Math.min(start + size, src.length);
    if (end < src.length) {
      const slice = src.slice(start, end);
      const lastBreak = Math.max(
        slice.lastIndexOf('\n\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf('\n')
      );
      if (lastBreak > size * 0.5) end = start + lastBreak + 1;
    }
    const piece = src.slice(start, end).trim();
    if (piece) {
      chunks.push({ index: idx, text: piece, charStart: start, charEnd: end, clause_path: null });
      idx++;
    }
    if (end >= src.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

/**
 * Split along markdown / clause headers; stitch parent hierarchy into each fragment.
 */
export function extractHierarchySegments(markdownText) {
  const lines = String(markdownText || '').split('\n');
  const segments = [];
  let section = 'Root';
  let clause = 'General';
  let buffer = [];
  let charPos = 0;
  let segStart = 0;

  const flush = () => {
    const body = buffer.join('\n').trim();
    if (!body) {
      buffer = [];
      return;
    }
    const context = `${section} → ${clause}`;
    segments.push({
      context,
      section,
      clause,
      body,
      charStart: segStart,
      charEnd: charPos,
    });
    buffer = [];
  };

  for (const line of lines) {
    const h1 = line.match(MD_H1);
    const h2 = line.match(MD_H2);
    const h3 = line.match(MD_H3);
    const numbered = line.match(NUMBERED_CLAUSE);

    if (h1) {
      flush();
      section = h1[1].trim();
      clause = 'General';
      segStart = charPos + line.length + 1;
    } else if (h2 || (CLAUSE_LINE.test(line) && !h3)) {
      flush();
      clause = (h2 ? h2[1] : line.replace(/^#+\s*/, '')).trim();
      segStart = charPos + line.length + 1;
    } else if (h3 || numbered) {
      flush();
      clause = (h3 ? h3[1] : `${numbered[1]} ${numbered[2]}`).trim();
      segStart = charPos + line.length + 1;
    } else {
      if (!buffer.length) segStart = charPos;
      buffer.push(line);
    }
    charPos += line.length + 1;
  }
  flush();
  return segments;
}

/**
 * Prefer hierarchical split; if a segment is huge, fall back to char split with context prefix.
 */
export function hierarchicalSplit(text, { size = DEFAULT_SIZE, overlap = DEFAULT_OVERLAP, isNumber } = {}) {
  const src = (text || '').trim();
  if (!src) return [];

  const hasStructure = /^#\s|clause\s+\d|^\d+\.\d+/im.test(src);
  if (!hasStructure) {
    return splitText(src, { size, overlap }).map(p => ({
      ...p,
      stitched: p.text,
      clause_path: null,
    }));
  }

  const segments = extractHierarchySegments(src);
  if (segments.length <= 1 && (segments[0]?.body?.length || 0) > size * 2) {
    return splitText(src, { size, overlap }).map(p => ({
      ...p,
      stitched: p.text,
      clause_path: null,
    }));
  }

  const out = [];
  let idx = 0;
  for (const seg of segments) {
    const header = isNumber
      ? `[Context Hierarchy: ${isNumber} → ${seg.context}]`
      : `[Context Hierarchy: ${seg.context}]`;
    const pieces = seg.body.length > size
      ? splitText(seg.body, { size, overlap })
      : [{ text: seg.body, charStart: seg.charStart, charEnd: seg.charEnd }];

    for (const piece of pieces) {
      const body = piece.text || seg.body;
      out.push({
        index: idx,
        text: body,
        stitched: `${header}\n${body}`,
        charStart: piece.charStart ?? seg.charStart,
        charEnd: piece.charEnd ?? seg.charEnd,
        clause_path: seg.context,
        section_title: seg.section,
        clause_title: seg.clause,
      });
      idx++;
    }
  }
  return out;
}

function charToPage(charStart, pageMap = []) {
  if (!pageMap?.length) return null;
  for (const entry of pageMap) {
    if (charStart >= entry.charStart && charStart < entry.charEnd) return entry.page;
  }
  return pageMap[pageMap.length - 1]?.page || 1;
}

function estimatePageNumber(chunkIndex = 0) {
  return Math.max(1, Math.round((chunkIndex * 1.2) / 1.8) + 1);
}

const DEMO_HEAD = /^\s*([A-Z]{2,5}-DEMO-\d{3})\b/;

/**
 * One chunk per DEMO-* record heading (demo PDFs).
 */
export function splitAtDemoRecordHeadings(text) {
  const src = String(text || '');
  if (!src.trim()) return null;
  const lines = src.split('\n');
  const segments = [];
  let buf = [];
  let record_id = null;
  let charPos = 0;
  let segStart = 0;

  const flush = () => {
    const body = buf.join('\n').trim();
    if (!body) {
      buf = [];
      return;
    }
    segments.push({
      text: body,
      stitched: record_id ? `${record_id}\n${body}` : body,
      charStart: segStart,
      charEnd: charPos,
      clause_path: record_id,
      record_id,
    });
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(DEMO_HEAD);
    if (m) {
      flush();
      record_id = m[1];
      segStart = charPos;
      buf.push(line);
    } else {
      if (!buf.length) segStart = charPos;
      buf.push(line);
    }
    charPos += line.length + 1;
  }
  flush();
  if (segments.length <= 1) return null;
  return segments.map((seg, index) => ({ ...seg, index }));
}

function citationAnchor(golden, part) {
  const isn = (golden.isNumbers || [])[0] || golden.meta?.is_number || golden.title;
  const clause = part.clause_path || part.clause_title;
  if (clause) return `${isn}, ${clause}`;
  return `${isn}`;
}

/**
 * Build enriched RAG chunks from a golden record (regulatory metadata + hierarchy).
 */
export function buildChunksFromGolden(golden) {
  if (golden.quality?.status === 'duplicate') return [];

  const isn = (golden.isNumbers || [])[0] || null;
  const sourceFile = golden.catalog?.source_file || golden.meta?.originalName || golden.provenance?.source_file || '';
  const isDemoPdf = /demo.*\.pdf|qco_demo|standards_demo|_demo\.pdf/i.test(String(sourceFile));
  let parts = isDemoPdf ? splitAtDemoRecordHeadings(golden.text) : null;
  if (parts) {
    parts = parts.map((seg, index) => ({
      index,
      text: seg.text,
      stitched: seg.stitched,
      charStart: seg.charStart,
      charEnd: seg.charEnd,
      clause_path: seg.record_id || seg.clause_path,
      record_id: seg.record_id,
    }));
  } else {
    parts = hierarchicalSplit(golden.text, { isNumber: isn });
  }
  const cat = golden.catalog || {};
  const prov = golden.provenance || {};
  const reg = golden.regulatory || {};
  const enforcement = reg.enforcement || {};

  return parts.map(p => {
    const stitched = p.stitched || p.text;
    const clausePath = p.clause_path || null;
    const anchor = citationAnchor(golden, p);
    const mappedPage = charToPage(p.charStart ?? 0, golden.meta?.pageMap || golden.pageMap);
    const page_number = mappedPage ?? estimatePageNumber(p.index);
    const page_number_confidence = mappedPage ? 'high' : 'estimated';
    return {
      id: `chunk-${golden.warehouseItemId}-${p.index}`,
      goldenId: golden.id,
      warehouseItemId: golden.warehouseItemId,
      clusterId: golden.clusterId,
      section: golden.section,
      sectionTag: golden.sectionTag,
      title: golden.title,
      chunkIndex: p.index,
      text: stitched,
      textBody: p.text,
      charStart: p.charStart,
      charEnd: p.charEnd,
      isNumbers: golden.isNumbers || [],
      contentHash: golden.contentHash,
      layman_synonyms: golden.layman_synonyms || [],
      metadata: {
        is_number: isn,
        clause_path: clausePath,
        demo_id: cat.demo_id || prov.demo_id || null,
        source_file: cat.source_file || prov.source_file || null,
        source_reference: cat.source_reference || prov.source_reference || null,
        source_url: cat.canonical_url || prov.canonicalUrl || cat.source_url || null,
        source_type: cat.source_type || prov.sourceType || prov.source_type || null,
        domain: String(golden.section || '').replace(/^chunk:/i, '') || null,
        certification_scheme: reg.scheme_type || null,
        mandatory_status: enforcement.enforcement_status
          ? `${enforcement.enforcement_status}${enforcement.effective_date ? ` (QCO ${enforcement.effective_date})` : ''}`
          : reg.legal_status || null,
        persona_target: reg.persona_target || null,
        related_normative_standards: golden.related_standards || [],
        associated_testing_machinery: golden.testing_machinery || [],
        citation_anchor: anchor,
        gazette_id: enforcement.notifying_gazette_id || null,
        ministry: enforcement.notifying_ministry || null,
        page_number,
        page_number_confidence,
        record_id: p.record_id || null,
      },
      citation: {
        chunk_id: `chunk-${golden.warehouseItemId}-${p.index}`,
        artifact_id: cat.artifact_id || golden.warehouseItemId,
        source_url: cat.canonical_url || prov.canonicalUrl || null,
        document_key: cat.document_key || golden.title,
        fetched_at: cat.fetched_at || prov.fetchedAt || null,
        license_class: cat.license_class || prov.licenseClass || 'public',
        fetch_id: cat.fetch_id || prov.fetchId || null,
        section: golden.section,
        clause_path: clausePath,
        citation_anchor: anchor,
        legal_status: reg.legal_status || null,
        scheme_type: reg.scheme_type || null,
      },
    };
  });
}

/**
 * Unified retrieval / source-display score policy.
 * Keep floors coordinated — do not scatter magic numbers across modules.
 */
export const SCORE_POLICY = {
  /** Index candidate floor (trace-search topCandidates). */
  candidateFloor: 0.05,
  /** Minimum hybrid score to keep as evidence for the agent (topical term overlap is also required). */
  evidenceFloor: 0.12,
  /** Hybrid score high enough to keep a hit without literal term overlap (paraphrase / Hindi). */
  // Hash-trick dense scores sit near 0.35 even for noise, so the bypass must be well above that.
  strongEvidence: 0.5,
  /** UI sources must be >= hybridTop * uiRelativeFloor. */
  uiRelativeFloor: 0.65,
  /** Absolute UI floor. Kept aligned with evidenceFloor so weak chunks are not shown. */
  uiAbsoluteFloor: 0.12,
  uiMax: 5,
  /**
   * Authoritative injects (qco_join) use a fixed high score (0.99).
   * Never use those when computing the relative UI floor or hybrid PDF
   * hits (~0.35–0.60) get wiped.
   */
  authoritativeScoreIgnoreAt: 0.95,
};

/** Rows that must not set the relative UI floor. */
export function isAuthoritativeScoreRow(row = {}) {
  if (row.retrievalMethod === 'qco_join') return true;
  if (row.retrievalMethod === 'exact_identifier') return true;
  if (row.source_type === 'compulsory_portal') return true;
  if (row.authoritative === true) return true;
  const score = Number(row.score);
  return Number.isFinite(score) && score >= SCORE_POLICY.authoritativeScoreIgnoreAt;
}

/** Best hybrid/index score for relative floor (ignores QCO injects). */
export function hybridTopScore(rows = []) {
  let top = 0;
  for (const row of rows) {
    if (isAuthoritativeScoreRow(row)) continue;
    const score = Number(row.score);
    if (Number.isFinite(score) && score > top) top = score;
  }
  return top;
}

export function uiScoreFloor(topScore) {
  const top = Number(topScore) || 0;
  const relative = top > 0 ? top * SCORE_POLICY.uiRelativeFloor : SCORE_POLICY.uiAbsoluteFloor;
  return Math.max(SCORE_POLICY.uiAbsoluteFloor, relative);
}

/** Stable identity for "keep best per document/record". */
export function sourceIdentityKey(row = {}) {
  const file = String(row.storage_uri || row.source_file || '')
    .split('/').pop()?.toLowerCase() || '';
  const record = String(row.record_id || row.demo_id || row.recordId || '').toLowerCase();
  if (file && record) return `file:${file}|rec:${record}`;
  if (file) return `file:${file}`;
  if (record) return `rec:${record}`;
  const url = String(row.portalUrl || row.sourceUrl || row.source_reference || '').toLowerCase();
  if (url) return `url:${url}`;
  return `title:${String(row.title || row.chunkId || 'x').toLowerCase()}`;
}

import {
  SCORE_POLICY,
  uiScoreFloor,
  hybridTopScore,
  isAuthoritativeScoreRow,
  sourceIdentityKey,
} from '../retrieval/score-policy.js';

const SOURCE_MAX = Number(process.env.SOURCE_MAX) || SCORE_POLICY.uiMax;
const SOURCE_MIN = Number(process.env.SOURCE_MIN_SCORE) || SCORE_POLICY.uiAbsoluteFloor;

function passesFloor(row, floor) {
  if (row.source_type === 'compulsory_portal') return true;
  if (row.retrievalMethod === 'qco_join') return true;
  if (row.retrievalMethod === 'exact_identifier') return true;
  if (row.portalUrl && typeof row.score !== 'number') return true;
  if (typeof row.score !== 'number') return true;
  return row.score >= floor;
}

/**
 * Cap UI sources without letting authoritative 0.99 injects erase hybrid PDF hits.
 * - Relative floor is computed from hybrid/index scores only
 * - Always keep the best row per file/record identity
 */
export function capUiSources(rows) {
  if (!rows?.length) return [];
  const sorted = [...rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const hybridTop = hybridTopScore(sorted);
  const floorBase = hybridTop > 0 ? hybridTop : (sorted.find((r) => !isAuthoritativeScoreRow(r))?.score ?? 0);
  const floor = Math.max(SOURCE_MIN, uiScoreFloor(floorBase));

  // Best row per identity (so STD-DEMO-003 cannot be deleted by QCO 0.99)
  const bestByKey = new Map();
  for (const row of sorted) {
    const key = sourceIdentityKey(row);
    if (!bestByKey.has(key)) bestByKey.set(key, row);
  }
  const diversify = [...bestByKey.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const kept = [];
  const seen = new Set();

  // 1) Always keep authoritative / exempt rows (QCO join, portal API)
  for (const row of diversify) {
    if (!isAuthoritativeScoreRow(row) && row.retrievalMethod !== 'qco_join'
      && row.source_type !== 'compulsory_portal'
      && row.retrievalMethod !== 'exact_identifier') {
      continue;
    }
    const key = sourceIdentityKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
    if (kept.length >= SOURCE_MAX) return kept;
  }

  // 2) Keep hybrid rows that pass the hybrid-relative floor
  for (const row of diversify) {
    const key = sourceIdentityKey(row);
    if (seen.has(key)) continue;
    if (!passesFloor(row, floor)) continue;
    seen.add(key);
    kept.push(row);
    if (kept.length >= SOURCE_MAX) return kept;
  }

  // 3) Guarantee at least one hybrid PDF/record if we only have injects so far
  if (kept.every((r) => isAuthoritativeScoreRow(r))) {
    for (const row of diversify) {
      if (isAuthoritativeScoreRow(row)) continue;
      const key = sourceIdentityKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(row);
      break;
    }
  }

  return kept.slice(0, SOURCE_MAX);
}

export { SOURCE_MAX, SOURCE_MIN };

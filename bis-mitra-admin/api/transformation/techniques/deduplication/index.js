import { hashContent } from './content-hash.js';

/**
 * Per-cluster content hash registry. Returns duplicateOf warehouse id if seen before.
 */
export function createDedupRegistry() {
  const byHash = new Map();
  return {
    register(contentHash, warehouseItemId) {
      if (!contentHash) return null;
      if (byHash.has(contentHash)) {
        return byHash.get(contentHash);
      }
      byHash.set(contentHash, warehouseItemId);
      return null;
    },
    snapshot() {
      return Object.fromEntries(byHash);
    },
  };
}

export function computeContentHash(text) {
  return hashContent(text);
}

import { runGoldenPipeline } from './run-golden.js';
import { runChunksPipeline } from './run-chunks.js';
import { runIndexPipeline } from './run-index.js';

/**
 * Full pipeline: warehouse → golden → chunks → draft index.
 */
export async function runFullPipeline({ clusterId, all = false, skipGolden = false } = {}) {
  const out = { golden: null, chunks: null, index: null };

  if (!skipGolden) {
    out.golden = await runGoldenPipeline({ clusterId, all });
  }
  out.chunks = runChunksPipeline({ clusterId, all });
  out.index = runIndexPipeline({ clusterId, all });
  return out;
}

/**
 * Live Playwright probes — refresh fees/labs/manuals/news from Clone portals
 * when the user asks for "today" / "live" / "near me", or when API probe is thin.
 */
import { runPlaywrightPattern } from '../playwright-runner.js';

const LIVE_HINT = /\b(today|live|real[- ]?time|near\s+me|currently|right\s+now|latest|open\s+now)\b/i;

/** Map user intent → Playwright pattern letter */
export function pickPlaywrightPattern(query, toolHint = null) {
  const q = String(query || '').toLowerCase();
  if (toolHint === 'search_marking_fees' || /fee|kharcha|licence\s+fee/.test(q)) return 'E';
  if (toolHint === 'search_product_manuals' || /manual|sit|sti|product\s+manual/.test(q)) return 'D';
  if (toolHint === 'search_standards' || /know\s+your\s+standard|find\s+standard/.test(q)) return 'A';
  if (toolHint === 'search_compulsory_products' || /compulsory|mandatory\s+list/.test(q)) return 'C';
  if (toolHint === 'search_bis_news' || /news|announcement/.test(q)) return 'G';
  if (toolHint === 'search_labs' || /lab|lrs|testing\s+lab/.test(q)) return 'C';
  if (/hallmark|ahc/.test(q)) return 'C';
  return null;
}

export function shouldRunLiveProbe(query, { force = false, apiResultCount = 0 } = {}) {
  if (force) return true;
  if (LIVE_HINT.test(query)) return true;
  // Thin API result on lab/fee questions → try live scrape
  if (apiResultCount === 0 && /\b(lab|fee|manual|news|compulsory)\b/i.test(query)) return true;
  return false;
}

/**
 * Run Playwright with a soft timeout. Returns structured live payload or null.
 */
export async function runLivePlaywrightProbe(query, { toolHint = null, timeoutMs = 28000 } = {}) {
  const pattern = pickPlaywrightPattern(query, toolHint);
  if (!pattern) {
    return { ok: false, skipped: true, reason: 'no_pattern_for_intent' };
  }

  const run = runPlaywrightPattern(pattern, query);
  const timed = Promise.race([
    run.then(r => ({ ok: true, ...r })),
    new Promise(resolve => setTimeout(() => resolve({ ok: false, timeout: true, pattern }), timeoutMs)),
  ]);

  try {
    const result = await timed;
    if (!result.ok) {
      return {
        ok: false,
        pattern,
        timeout: !!result.timeout,
        error: result.timeout ? `Playwright pattern ${pattern} timed out` : 'failed',
      };
    }
    return {
      ok: true,
      via: 'playwright',
      pattern: result.pattern,
      fetched_at: result.payload?.fetched_at || new Date().toISOString(),
      source_url: result.payload?.source_url,
      description: result.payload?.description,
      scraped: result.payload?.scraped,
      fileCount: result.files?.length || 0,
      files: (result.files || []).slice(0, 5).map(f => f.name),
      summary: summarizeScraped(result.payload),
    };
  } catch (err) {
    return {
      ok: false,
      pattern,
      error: err.message,
    };
  }
}

function summarizeScraped(payload) {
  if (!payload) return null;
  const scraped = payload.scraped || {};
  const lines = [];
  if (payload.description) lines.push(payload.description);
  if (typeof scraped === 'string') lines.push(scraped.slice(0, 400));
  else if (scraped && typeof scraped === 'object') {
    const text = scraped.text || scraped.body || scraped.results || scraped.table;
    if (typeof text === 'string') lines.push(text.slice(0, 400));
    else if (Array.isArray(text)) {
      text.slice(0, 5).forEach(row => {
        lines.push(typeof row === 'string' ? row : JSON.stringify(row).slice(0, 120));
      });
    } else {
      lines.push(JSON.stringify(scraped).slice(0, 400));
    }
  }
  return lines.filter(Boolean).join('\n');
}

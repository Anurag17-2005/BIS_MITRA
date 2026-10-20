import { ensureEnvLoaded } from './env.js';
import {
  resolveBisWebUrl,
  resolveManakWebUrl,
} from './clone-files-proxy.js';

function cloneApiBase() {
  return (process.env.CLONE_API || process.env.CLONE_PUBLIC_URL || 'http://localhost:4000')
    .replace(/\/$/, '');
}

function standardsWebUrl() {
  ensureEnvLoaded();
  const u = process.env.URL_STANDARDS || process.env.STANDARDS_URL || process.env.STANDARDS_WEB;
  return (u || 'http://localhost:3003').replace(/\/$/, '');
}

function portalUrls() {
  ensureEnvLoaded();
  return {
    cloneApi: cloneApiBase(),
    bis: resolveBisWebUrl() || process.env.BIS_URL || 'http://localhost:3001',
    manak: resolveManakWebUrl() || process.env.MANAK_URL || 'http://localhost:3002',
    standards: standardsWebUrl(),
  };
}

async function ping(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return { ok: res.ok || res.status < 500, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(t);
  }
}

export async function serviceStatus() {
  const { cloneApi, bis, manak, standards } = portalUrls();
  const [api, bisPing, manakPing, standardsPing] = await Promise.all([
    ping(`${cloneApi}/api/health`),
    ping(bis),
    ping(manak),
    ping(standards),
  ]);
  return {
    cloneApi: { url: cloneApi, ...api },
    bis: { url: bis, ...bisPing },
    manak: { url: manak, ...manakPing },
    standards: { url: standards, ...standardsPing },
  };
}

/** Script method needs the portals that the pattern actually hits. */
export async function assertScriptReady(pattern) {
  const letter = String(pattern || '').toUpperCase();
  const status = await serviceStatus();
  const need = [];
  if (['B', 'D', 'G'].includes(letter)) need.push(['bis', status.bis]);
  if (['C', 'E', 'N'].includes(letter)) need.push(['manak', status.manak]);
  if (['A', 'F'].includes(letter)) need.push(['standards', status.standards]);
  if (!need.length) need.push(['bis', status.bis]);
  const down = need.filter(([, s]) => !s.ok).map(([name]) => name);
  if (down.length) {
    throw new Error(
      `Playwright pattern ${letter} needs Clone portals running. Down: ${down.join(', ')}. Start with: cd bis-clone && npm start`
    );
  }
}

export async function assertApiReady() {
  const s = await serviceStatus();
  if (!s.cloneApi.ok) {
    const detail = s.cloneApi.error || `HTTP ${s.cloneApi.status ?? '?'}`;
    throw new Error(
      `Clone API unreachable at ${s.cloneApi.url} (${detail}). Set CLONE_API to your live clone URL (e.g. Railway) and redeploy admin.`,
    );
  }
}

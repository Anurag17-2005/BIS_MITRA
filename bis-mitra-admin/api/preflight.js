const CLONE_API = process.env.CLONE_API || 'http://localhost:4000';
const BIS = process.env.BIS_URL || 'http://localhost:3001';
const MANAK = process.env.MANAK_URL || 'http://localhost:3002';
const STANDARDS = process.env.STANDARDS_URL || 'http://localhost:3003';

async function ping(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 1500);
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
  const [api, bis, manak, standards] = await Promise.all([
    ping(`${CLONE_API}/api/health`),
    ping(BIS),
    ping(MANAK),
    ping(STANDARDS),
  ]);
  return {
    cloneApi: { url: CLONE_API, ...api },
    bis: { url: BIS, ...bis },
    manak: { url: MANAK, ...manak },
    standards: { url: STANDARDS, ...standards },
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
    throw new Error('Clone API is not running on :4000. Start with: cd bis-clone && npm start');
  }
}

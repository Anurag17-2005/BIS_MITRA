#!/usr/bin/env node
/**
 * Light post-deploy smoke checks. Set ADMIN_API and optionally CLONE_API.
 *
 *   ADMIN_API=https://admin.example.com CLONE_API=https://clone.example.com node scripts/smoke-deploy.mjs
 */

const ADMIN = (process.env.ADMIN_API || process.env.REND_ADMIN_API || '').replace(/\/$/, '');
const CLONE = (process.env.CLONE_API || process.env.REND_CLONE_API || '').replace(/\/$/, '');

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { _raw: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, data };
}

function pass(label, detail = '') {
  console.log(`OK  ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail = '') {
  console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

let failed = 0;

async function main() {
  if (!ADMIN) {
    console.error('Set ADMIN_API (or REND_ADMIN_API) to the admin public URL.');
    process.exit(1);
  }

  const health = await getJson(`${ADMIN}/api/health`);
  if (health.ok) {
    pass('admin /api/health', JSON.stringify(health.data).slice(0, 120));
    if (CLONE && health.data?.cloneApi && !String(health.data.cloneApi).includes('localhost')) {
      pass('health.cloneApi wired', health.data.cloneApi);
    } else if (CLONE) {
      pass('health (cloneApi)', health.data?.cloneApi || 'not set');
    }
  } else {
    fail('admin /api/health', `status ${health.status}`);
    failed += 1;
  }

  const portal = await getJson(`${ADMIN}/api/portal/config`);
  if (portal.ok) {
    const pid = portal.data?.publishedClusterId;
    pass('portal /api/portal/config', `publishedClusterId=${pid ?? 'null'}`);
  } else {
    fail('portal config', `status ${portal.status}`);
    failed += 1;
  }

  const clusters = await getJson(`${ADMIN}/api/clusters`);
  if (clusters.ok && Array.isArray(clusters.data)) {
    pass('GET /api/clusters', `${clusters.data.length} cluster(s)`);
  } else if (clusters.status === 401) {
    console.log('SKIP GET /api/clusters (maintainer auth required — use admin UI for cluster CRUD)');
  } else {
    fail('GET /api/clusters', `status ${clusters.status}`);
    failed += 1;
  }

  if (CLONE) {
    const cloneHealth = await getJson(`${CLONE}/api/health`);
    if (cloneHealth.ok) {
      pass('clone /api/health');
    } else {
      fail('clone /api/health', `status ${cloneHealth.status}`);
      failed += 1;
    }

    const verify = await getJson(`${CLONE}/api/registry/verify?cml=CML-DEMO-61003`);
    if (verify.ok) {
      pass('clone registry verify (CML-DEMO-61003)');
    } else {
      fail('clone registry verify', `status ${verify.status}`);
      failed += 1;
    }
  } else {
    console.log('SKIP clone checks (set CLONE_API to enable)');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

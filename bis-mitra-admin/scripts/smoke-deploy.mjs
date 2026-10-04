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
    const extras = [
      portal.data?.bisWebUrl ? `bisWeb=${portal.data.bisWebUrl}` : null,
      portal.data?.cloneFilesBase ? 'cloneFiles=set' : null,
    ].filter(Boolean).join(' ');
    pass('portal /api/portal/config', `publishedClusterId=${pid ?? 'null'}${extras ? ` ${extras}` : ''}`);
    if (portal.data?.bisWebUrl && /localhost/i.test(portal.data.bisWebUrl)) {
      fail('portal bisWebUrl', 'still localhost — set URL_BIS on Railway admin');
      failed += 1;
    }
    if (pid === 'test') {
      console.log('WARN published cluster is "test" — prefer proof-actions-sandbox for demo proofs');
    }
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

    const filesBase = (portal.ok && portal.data?.cloneFilesBase)
      ? String(portal.data.cloneFilesBase).replace(/\/$/, '')
      : `${CLONE}/files`;
    const pdfUrl = `${filesBase}/knowledge/pdfs/demo/qco.pdf`;
    try {
      const head = await fetch(pdfUrl, { method: 'HEAD' });
      if (head.ok) pass('clone demo PDF HEAD', pdfUrl.slice(0, 80));
      else {
        const get = await fetch(pdfUrl, { method: 'GET' });
        if (get.ok) pass('clone demo PDF GET', 'HEAD not supported');
        else {
          fail('clone demo PDF', `status ${head.status} ${pdfUrl}`);
          failed += 1;
        }
      }
    } catch (err) {
      fail('clone demo PDF', err.message);
      failed += 1;
    }
  } else {
    console.log('SKIP clone checks (set CLONE_API to enable)');
  }

  if (process.env.SMOKE_CHAT === '1') {
    const pid = portal.ok ? portal.data?.publishedClusterId : null;
    if (!pid) {
      console.log('SKIP SMOKE_CHAT (no published cluster — publish in admin first)');
    } else {
      const helmetPrompt =
        'I manufacture industrial safety helmets. What BIS standard applies to my product, is certification mandatory, and what tests and documents do I need?';
      const chatRes = await fetch(`${ADMIN}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: helmetPrompt,
          clusterId: pid,
          personaMode: 'industry',
          userPersona: 'industry',
          sessionId: `smoke-${Date.now()}`,
          userId: 'industry',
          language: 'en',
        }),
      });
      const chatBody = await chatRes.json().catch(() => ({}));
      const compliance = chatBody.panel?.compliance;
      if (!chatRes.ok) {
        fail('SMOKE_CHAT', chatBody.error || `status ${chatRes.status}`);
        failed += 1;
      } else if (!compliance?.standard_number) {
        fail(
          'SMOKE_CHAT compliance panel',
          `missing panel.compliance (probe/RAG only?). cluster=${pid} probe=${chatBody.probe?.tool || 'none'}`,
        );
        failed += 1;
      } else if (!/IS DEMO 1001/i.test(String(compliance.standard_number))) {
        fail('SMOKE_CHAT standard', `got ${compliance.standard_number}`);
        failed += 1;
      } else {
        pass('SMOKE_CHAT', `${compliance.standard_number} tests=${compliance.tests?.length ?? 0}`);
      }
      if (chatRes.ok && chatBody.answer && /\{"dataset"\s*:/.test(chatBody.answer)) {
        fail('SMOKE_CHAT answer leak', 'raw JSON in user-visible answer — redeploy admin sanitize');
        failed += 1;
      }
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

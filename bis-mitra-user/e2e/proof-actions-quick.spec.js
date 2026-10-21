import { test, expect } from '@playwright/test';
import { preparePortalChat, sendAndWaitForTestId } from './helpers/portal-chat.mjs';

const HELMET =
  'I manufacture industrial safety helmets. What BIS standard applies to my product, is certification mandatory, and what tests and documents do I need?';

const FMCS =
  'I manufacture induction cooking appliances outside India and want to sell them in India. What BIS requirements apply, which standard and QCO should I check, and what AIR, factory inspection, documents and testing evidence do I need?';

const LAB =
  'I need to test my induction cooking appliance against IS DEMO 1003:2025. Which BIS-recognised laboratory should I use?';

const CML = 'Verify CML-DEMO-61003 — is this product certified under BIS?';

test.describe('Proof actions — response cards', () => {
  test('Action 1 — helmet compliance card', async ({ page }) => {
    await preparePortalChat(page, 'industry');
    await sendAndWaitForTestId(page, HELMET, 'portal-compliance-card');
    await expect(page.getByTestId('portal-compliance-card')).toContainText('IS DEMO 1001');
  });

  test('Action 4 — FMCS checklist (foreign exporter)', async ({ page }) => {
    await preparePortalChat(page, 'foreign_exporter');
    await sendAndWaitForTestId(page, FMCS, 'portal-checklist-card');
    await expect(page.getByTestId('portal-checklist-card')).toContainText('1003');
  });

  test('Action 5 — lab matching', async ({ page }) => {
    await preparePortalChat(page, 'industry');
    await sendAndWaitForTestId(page, LAB, 'portal-matching-card');
    await expect(page.getByTestId('portal-matching-card')).toContainText(/lab|Apex|LAB/i);
  });

  test('Action 6 — CML verification', async ({ page }) => {
    await preparePortalChat(page, 'citizen');
    await sendAndWaitForTestId(page, CML, 'portal-verify-card');
    await expect(page.getByTestId('portal-verify-card')).toContainText(/VERIFIED|MISMATCH|found/i);
  });

  test('Portal config — clone PDF base and BIS shell', async ({ request }) => {
    const admin = process.env.ADMIN_API || process.env.REND_ADMIN_API;
    test.skip(!admin, 'Set ADMIN_API for prod link smoke');
    const cfgRes = await request.get(`${admin.replace(/\/$/, '')}/api/portal/config`);
    expect(cfgRes.ok()).toBeTruthy();
    const cfg = await cfgRes.json();
    expect(cfg.cloneFilesBase).toMatch(/\/files$/);
    expect(cfg.bisWebUrl).toBeTruthy();
    const bis = await request.get(cfg.bisWebUrl);
    expect(bis.status()).toBeLessThan(500);
    const manualPdf = `${cfg.cloneFilesBase}/knowledge/pdfs/manuals/PM-IS-4151-helmet-2024.pdf`;
    const pdfRes = await request.get(manualPdf);
    expect([200, 404]).toContain(pdfRes.status());
  });
});

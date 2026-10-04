import { test, expect } from '@playwright/test';

const HELMET =
  'I manufacture industrial safety helmets. What BIS standard applies to my product, is certification mandatory, and what tests and documents do I need?';

const FMCS =
  'I manufacture induction cooking appliances outside India and want to sell them in India. What BIS requirements apply, which standard and QCO should I check, and what AIR, factory inspection, documents and testing evidence do I need?';

const LAB =
  'I need to test my induction cooking appliance against IS DEMO 1003:2025. Which BIS-recognised laboratory should I use?';

const CML = 'Verify CML-DEMO-61003 — is this product certified under BIS?';

async function sendAndWait(page, prompt, testId, timeout = 90_000) {
  await page.getByTestId('portal-chat-input').fill(prompt);
  await page.getByTestId('portal-send').click();
  await expect(page.getByTestId(testId)).toBeVisible({ timeout });
}

test.describe('Proof actions — response cards', () => {
  test('Action 1 — helmet compliance card', async ({ page }) => {
    await page.goto('/');
    await sendAndWait(page, HELMET, 'portal-compliance-card');
    await expect(page.getByTestId('portal-compliance-card')).toContainText('IS DEMO 1001');
  });

  test('Action 4 — FMCS checklist (foreign exporter)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('portal-persona-select').selectOption('foreign_exporter');
    await sendAndWait(page, FMCS, 'portal-checklist-card');
    await expect(page.getByTestId('portal-checklist-card')).toContainText('1003');
  });

  test('Action 5 — lab matching', async ({ page }) => {
    await page.goto('/');
    await sendAndWait(page, LAB, 'portal-matching-card');
    await expect(page.getByTestId('portal-matching-card')).toContainText(/lab|Apex|LAB/i);
  });

  test('Action 6 — CML verification', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('portal-persona-select').selectOption('citizen');
    await sendAndWait(page, CML, 'portal-verify-card');
    await expect(page.getByTestId('portal-verify-card')).toContainText(/VERIFIED|found/i);
  });
});

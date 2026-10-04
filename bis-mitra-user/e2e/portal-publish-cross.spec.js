import { test, expect } from '@playwright/test';

test('published cluster label and helmet compliance card', async ({ page }) => {
  await page.goto('/');
  const label = page.getByTestId('portal-knowledge-label');
  await expect(label).toBeVisible({ timeout: 15_000 });
  const prompt =
    'I manufacture industrial safety helmets. What BIS standard applies to my product, is certification mandatory, and what tests and documents do I need?';
  await page.getByTestId('portal-chat-input').fill(prompt);
  await page.getByTestId('portal-send').click();
  const card = page.getByTestId('portal-compliance-card');
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card).toContainText('IS DEMO 1001');
});

import { test, expect } from '@playwright/test';

test('theme toggle switches light and dark', async ({ page }) => {
  await page.goto('/');
  const root = page.locator('.bis-portal');
  await expect(root).toHaveClass(/theme-light/);
  await page.getByTestId('portal-theme-toggle').click();
  await expect(root).toHaveClass(/theme-dark/);
  await page.getByTestId('portal-theme-toggle').click();
  await expect(root).toHaveClass(/theme-light/);
});

test('language select and sidebar navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('portal-lang-select').selectOption('hi');
  await page.getByRole('button', { name: /मेरे आवेदन|My Applications/i }).click();
  await expect(page.locator('.bp-page, .bp-chat')).toBeVisible();
  await page.getByRole('button', { name: /होम|Home/i }).click();
  await page.locator('.bp-collapse').click();
  await expect(page.locator('.bp-side.is-rail')).toBeVisible();
});

test('nav pages render', async ({ page }) => {
  await page.goto('/');
  const navIds = [
    [/My Applications|मेरे आवेदन/i, '.bp-page'],
    [/My Alerts|मेरे अलर्ट/i, '.bp-page'],
    [/Documents|दस्तावेज़/i, '.bp-page'],
    [/BIS Services|सेवाएँ/i, '.bp-page, .bp-services'],
    [/Saved|सहेजे/i, '.bp-page'],
  ];
  for (const [name, sel] of navIds) {
    await page.getByRole('button', { name }).click();
    await expect(page.locator(sel).first()).toBeVisible();
  }
});

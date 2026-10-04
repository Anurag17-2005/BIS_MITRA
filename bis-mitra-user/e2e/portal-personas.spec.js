import { test, expect } from '@playwright/test';

const PERSONAS = [
  'industry',
  'foreign_exporter',
  'citizen',
  'gold_investor',
  'lab_testing',
  'academic',
  'enforcement',
  'bis_admin',
];

for (const id of PERSONAS) {
  test(`persona ${id} shows welcome tiles`, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('portal-persona-select').selectOption(id);
    await expect(page.locator('.bp-tiles button')).not.toHaveCount(0);
  });
}

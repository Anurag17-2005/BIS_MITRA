import { test, expect } from '@playwright/test';
import { unpublishAll } from '../../bis-mitra-admin/api/tests/helpers/cluster-api.mjs';

test('shows banner when no cluster is published', async ({ page }) => {
  process.env.ADMIN_API = process.env.ADMIN_API || 'http://127.0.0.1:5050';
  await unpublishAll();
  await page.goto('/');
  await expect(page.getByTestId('portal-error-banner')).toContainText(/No knowledge cluster is published/i, {
    timeout: 15_000,
  });
});

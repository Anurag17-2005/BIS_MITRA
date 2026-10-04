import { test, expect } from '@playwright/test';
import { publishCluster, unpublishAll, TEST_CLUSTER } from '../../bis-mitra-admin/api/tests/helpers/cluster-api.mjs';

test('refetches portal config on window focus after publish', async ({ page, context }) => {
  process.env.ADMIN_API = process.env.ADMIN_API || 'http://127.0.0.1:5050';
  await unpublishAll();
  await page.goto('/');
  await expect(page.getByTestId('portal-error-banner')).toBeVisible({ timeout: 15_000 });

  const admin = await context.newPage();
  await publishCluster(TEST_CLUSTER, true);
  await admin.close();

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('portal-knowledge-label')).toBeVisible({ timeout: 15_000 });
  await publishCluster(TEST_CLUSTER, true);
});

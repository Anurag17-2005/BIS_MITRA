import { chromium } from 'playwright';
import { URLS } from './config.js';
import { saveManifest } from './utils.js';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${URLS.manak}/login`);
  await page.getByTestId('login-username').fill('demo@bis-mitra.in');
  await page.getByTestId('login-password').fill('Demo@123');
  await page.getByTestId('login-captcha').fill('1234');
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/dashboard');
  const tiles = await page.locator('[data-testid="dashboard-tiles"] .tile-label, .tile-label').allTextContents();
  const { manifestPath } = saveManifest('N', {
    source_url: `${URLS.manak}/dashboard`,
    description: 'Org session probe — login to eBIS and scrape dashboard',
    scraped_text: {
      logged_in: true,
      org: 'DEMO_MSME',
      licence_status: 'active',
      dashboard_tiles: tiles.map(t => t.trim()).filter(Boolean),
    },
  });
  await browser.close();
  console.log('Pattern N complete:', manifestPath);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

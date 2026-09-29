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
  await page.goto(`${URLS.manak}/marking-fee`);
  const query = process.env.FETCH_QUERY || 'helmet';
  await page.getByTestId('fee-search-input').fill(query);
  await page.getByTestId('fee-search-btn').click();
  await page.waitForSelector('[data-testid^="fee-result-"]');
  const results = await page.locator('[data-testid^="fee-result-"]').allTextContents();
  await page.locator('[data-testid^="fee-result-"]').first().click();
  const feeAmount = await page.getByTestId('fee-amount').textContent();
  const { manifestPath } = saveManifest('E', {
    source_url: `${URLS.manak}/marking-fee`,
    description: 'Login → search → scrape fee',
    scraped_text: { query, results, fee_amount: feeAmount },
  });
  await browser.close();
  console.log('Pattern E complete:', manifestPath);
}

run().catch(console.error);

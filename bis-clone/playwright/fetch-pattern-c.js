import { chromium } from 'playwright';
import { URLS } from './config.js';
import { saveManifest } from './utils.js';

const url = `${URLS.manak}/standards-under-certification`;

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Login first
  await page.goto(`${URLS.manak}/login`);
  await page.getByTestId('login-username').fill('demo@bis-mitra.in');
  await page.getByTestId('login-password').fill('Demo@123');
  await page.getByTestId('login-captcha').fill('1234');
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/dashboard');
  await page.goto(url);
  const query = process.env.FETCH_QUERY || '';
  if (query) {
    await page.getByTestId('cert-list-search').fill(query);
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('[data-testid="certification-table"]');
  const rows = await page.locator('[data-testid^="cert-row-"]').all();
  const tableData = [];
  for (const row of rows) {
    const cells = await row.locator('td').allTextContents();
    tableData.push({ sno: cells[0], standard_number: cells[1], standard_title: cells[2], mandatory_voluntary: cells[3] });
  }
  const { manifestPath } = saveManifest('C', {
    source_url: url,
    description: 'Static table scrape',
    scraped_text: { query: query || '(all rows)', rows: tableData },
  });
  await browser.close();
  console.log('Pattern C complete:', manifestPath);
}

run().catch(console.error);

import { chromium } from 'playwright';
import { URLS } from './config.js';
import { saveManifest } from './utils.js';

const url = `${URLS.standards}/know-your-standards`;

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  const query = process.env.FETCH_QUERY || 'cycle';
  await page.getByTestId('standard-search').fill(query);
  await page.getByTestId('standard-search-btn').click();
  await page.waitForSelector('[data-testid^="result-"]');
  const results = await page.locator('[data-testid^="result-"]').allTextContents();
  const { dir, manifestPath } = saveManifest('A', {
    source_url: url,
    description: 'Search box → text results',
    scraped_text: { query, results },
  });
  await browser.close();
  console.log('Pattern A complete:', manifestPath);
}

run().catch(console.error);

import { chromium } from 'playwright';
import { URLS } from './config.js';
import { saveManifest } from './utils.js';

const url = `${URLS.bis}/news`;

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForSelector('[data-testid="news-list"]');
  const cards = await page.locator('[data-testid^="news-item-"]').all();
  const items = [];
  for (const card of cards) {
    const title = (await card.locator('[data-testid="news-title"]').textContent().catch(() => ''))?.trim();
    const summary = (await card.locator('[data-testid="news-summary"]').textContent().catch(() => ''))?.trim();
    const published = (await card.locator('[data-testid="news-date"]').textContent().catch(() => ''))?.trim();
    if (title) items.push({ title, summary, published_at: published });
  }
  const { manifestPath } = saveManifest('G', {
    source_url: url,
    description: 'BIS News page — scrape all announcements (no search)',
    scraped_text: { items },
  });
  await browser.close();
  console.log('Pattern G complete:', manifestPath);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

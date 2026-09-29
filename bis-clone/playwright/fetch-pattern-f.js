import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { URLS } from './config.js';
import { saveManifest, saveFile } from './utils.js';

const isNumber = process.env.FETCH_QUERY || process.env.FETCH_IS_NUMBER || 'IS 623:2025';
const url = `${URLS.standards}/standard-details/${encodeURIComponent(isNumber)}`;

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForSelector('[data-testid="standard-title"]');
  const title = await page.getByTestId('standard-title').textContent();
  const description = await page.getByTestId('standard-description').textContent();
  const status = await page.getByTestId('standard-status').textContent();
  await page.getByText('Standards Referred').click();
  await page.waitForSelector('[data-testid="referred-standards-list"]');
  const referred = await page.locator('.referred-item').allTextContents();
  const { dir, manifestPath } = saveManifest('F', {
    source_url: url,
    description: 'Search → detail page → PDF',
    scraped_text: { query: isNumber, title, description, status, referred },
    files: [],
  });
  await page.getByText('Product Manual & SIT').click();
  const downloadBtn = page.getByTestId('download-manual');
  if (await downloadBtn.count() > 0) {
    const href = await downloadBtn.getAttribute('href');
    if (href) {
      const response = await page.request.get(href);
      const buf = await response.body();
      const saved = saveFile(dir, `${isNumber.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`, buf);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.files = [saved];
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
  }
  await browser.close();
  console.log('Pattern F complete:', manifestPath);
}

run().catch(console.error);

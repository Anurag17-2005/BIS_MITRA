import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { URLS } from './config.js';
import { saveManifest, saveFile } from './utils.js';

const url = `${URLS.bis}/product-manuals`;

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  const query = process.env.FETCH_QUERY || '3055';
  await page.getByTestId('manual-search-input').fill(query);
  await page.getByTestId('manual-search-btn').click();
  await page.waitForSelector('[data-testid^="manual-row-"]');
  const rows = await page.locator('[data-testid^="manual-row-"]').all();
  const tableData = [];
  for (const row of rows) {
    const cells = await row.locator('td').allTextContents();
    tableData.push({ sr: cells[0], is_number: cells[1], title: cells[2], size: cells[3] });
  }
  const { dir, manifestPath } = saveManifest('D', {
    source_url: url,
    description: 'Search → table → PDF download',
    scraped_text: { query, rows: tableData },
    files: [],
  });
  const firstRow = page.locator('[data-testid^="manual-row-"]').first();
  const downloadLink = firstRow.locator('a[data-testid^="download-"]');
  if (await downloadLink.count() > 0) {
    const href = await downloadLink.getAttribute('href');
    if (href) {
      const response = await page.request.get(href);
      const buf = await response.body();
      const filename = path.basename(href) || 'manual.pdf';
      const saved = saveFile(dir, filename.includes('.') ? filename : `${filename}.pdf`, buf);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.files = [saved];
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
  }
  await browser.close();
  console.log('Pattern D complete:', manifestPath);
}

run().catch(console.error);

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { URLS } from './config.js';
import { saveManifest, saveFile } from './utils.js';

const url = `${URLS.bis}/product-certification/process`;

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForSelector('[data-testid="process-pdf-list"]');
  const links = await page.locator('[data-testid^="process-pdf-"]').all();
  const scraped = [];
  const { dir, manifestPath } = saveManifest('B', { source_url: url, description: 'Directory → direct PDF links', files: [] });
  for (const link of links) {
    const text = await link.textContent();
    const href = await link.getAttribute('href');
    scraped.push({ title: text?.trim(), href });
    if (href) {
      const response = await page.request.get(href);
      const buf = await response.body();
      const filename = path.basename(href);
      const saved = saveFile(dir, filename, buf);
      scraped[scraped.length - 1].saved_path = saved;
    }
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  Object.assign(manifest, { scraped_text: { documents: scraped }, files: scraped.map(s => s.saved_path).filter(Boolean) });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  await browser.close();
  console.log('Pattern B complete:', manifestPath);
}

run().catch(console.error);

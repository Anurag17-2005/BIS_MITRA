/**
 * Playwright worker — fills and submits Form-I on eBIS (manak-web).
 * Env: MANAK_URL, FORM_FACTORY_NAME, FORM_UDYAM_ID, FORM_LAB_REPORT_REF, FORM_IS_NUMBER
 */
import { chromium } from 'playwright';
import { URLS } from './config.js';

const MANAK = process.env.MANAK_URL || URLS.manak;

async function main() {
  const payload = {
    factory_name: process.env.FORM_FACTORY_NAME || 'Demo Geyser Works Pvt Ltd',
    udyam_id: process.env.FORM_UDYAM_ID || 'UDYAM-MH-12-0012345',
    lab_report_ref: process.env.FORM_LAB_REPORT_REF || 'NTH-9941',
    is_number: process.env.FORM_IS_NUMBER || 'IS 2082:2018',
    product_name: process.env.FORM_PRODUCT_NAME || 'Electric Storage Water Heater',
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${MANAK}/login`, { waitUntil: 'networkidle' });
    await page.getByTestId('login-username').fill('demo@bis-mitra.in');
    await page.getByTestId('login-password').fill('Demo@123');
    await page.getByTestId('login-captcha').fill('1234');
    await page.getByTestId('login-submit').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.goto(`${MANAK}/apply`, { waitUntil: 'networkidle' });
    await page.locator('#factory_name').fill(payload.factory_name);
    await page.locator('#udyam_id').fill(payload.udyam_id);
    await page.locator('#lab_report_ref').fill(payload.lab_report_ref);
    await page.locator('#product_name').fill(payload.product_name);
    await page.locator('#is_number').selectOption(payload.is_number).catch(() => {});
    await page.locator('#btn-submit').click();

    await page.waitForSelector('[data-testid="form-i-success"]', { timeout: 15000 });
    const tracking = await page.getByTestId('form-i-tracking').textContent();

    const result = {
      ok: true,
      method: 'playwright',
      reference_id: tracking?.trim(),
      tracking_id: tracking?.trim(),
      lab_report_ref: payload.lab_report_ref,
      factory_name: payload.factory_name,
      submitted_at: new Date().toISOString(),
    };
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message, method: 'playwright' }));
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();

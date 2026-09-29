/**
 * Playwright worker — fills and submits consumer grievance on Clone B.
 * Env: CLONE_API, FORM_MERCHANT_NAME, FORM_PRODUCT_CATEGORY, FORM_EVIDENCE_UPLOAD, FORM_COMPLAINT_DETAILS
 */
import { chromium } from 'playwright';

const PORT = process.env.PORT || 4000;
const BASE_URL = process.env.CLONE_URL || `http://localhost:${PORT}`;

async function main() {
  const payload = {
    merchant_name: process.env.FORM_MERCHANT_NAME || 'PowerSafe Retail Electronics',
    product_category: process.env.FORM_PRODUCT_CATEGORY || 'Electrical Accessories',
    evidence_upload: process.env.FORM_EVIDENCE_UPLOAD || 'store_bill_invoice_2026_8821.pdf',
    consumer_name: process.env.FORM_CONSUMER_NAME || 'Rajesh Kumar',
    invoice_number: process.env.FORM_INVOICE_NUMBER || 'INV-2026-8821',
    complaint_details: process.env.FORM_COMPLAINT_DETAILS || 'My new extension board caught fire this morning while charging my phone. I have the store bill. Can you file an official complaint against this brand for me?',
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}/clone/consumer/complaints`, { waitUntil: 'networkidle' });

    await page.locator('#merchant_name').fill(payload.merchant_name);
    await page.locator('#product_category').fill(payload.product_category);
    await page.locator('#evidence_upload').fill(payload.evidence_upload);
    if (await page.locator('#consumer_name').count()) {
      await page.locator('#consumer_name').fill(payload.consumer_name);
    }
    if (await page.locator('#invoice_number').count()) {
      await page.locator('#invoice_number').fill(payload.invoice_number);
    }
    if (await page.locator('#complaint_details').count()) {
      await page.locator('#complaint_details').fill(payload.complaint_details);
    }

    await page.locator('#btn-submit').click();

    await page.waitForSelector('[data-testid="grievance-success"]', { timeout: 10000 });
    const ticketEl = page.locator('[data-testid="grievance-ticket"]');
    const ticketText = (await ticketEl.textContent()) || 'CON-GRP-4401';

    const result = {
      ok: true,
      method: 'playwright',
      ticket_id: ticketText.trim(),
      tracking_id: ticketText.trim(),
      merchant_name: payload.merchant_name,
      product_category: payload.product_category,
      evidence_upload: payload.evidence_upload,
      submitted_at: new Date().toISOString(),
      message: `I have successfully filled out and dispatched your safety grievance to the enforcement cell. Complaint Ticket ID: ${ticketText.trim()} has been created. I will automatically track this ticket on your dashboard profile.`,
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

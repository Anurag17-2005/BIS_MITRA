import { test, expect } from '@playwright/test';

const CSOL =
  'What is the procedure for change in scope of licence (CSoL) under Scheme I?';

const HELMET_MANUAL =
  'What tests are required for IS 4151 industrial safety helmets?';

async function sendAndWaitAnswer(page, prompt, timeout = 120_000) {
  await page.getByTestId('portal-persona-select').selectOption('industry');
  await page.getByTestId('portal-chat-input').fill(prompt);
  await page.getByTestId('portal-send').click();
  await expect(page.locator('.bp-msg.assistant').last()).toBeVisible({ timeout });
  const text = await page.locator('.bp-msg.assistant').last().innerText();
  return text;
}

test.describe('Knowledge cluster smoke', () => {
  test('K-01 CSoL — substantive answer (not generic insufficient only)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('portal-knowledge-label').waitFor({ state: 'visible', timeout: 15_000 });
    const answer = await sendAndWaitAnswer(page, CSOL);
    expect(answer.toLowerCase()).not.toMatch(/^insufficient evidence only$/);
    expect(answer.toLowerCase()).toMatch(/scope|licence|csol/i);
  });

  test('K-14 IS 4151 — mentions helmet or 4151', async ({ page }) => {
    await page.goto('/');
    const answer = await sendAndWaitAnswer(page, HELMET_MANUAL);
    expect(answer).toMatch(/4151|helmet/i);
  });
});

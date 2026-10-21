import { test, expect } from '@playwright/test';
import { preparePortalChat, sendAndWaitForAssistant } from './helpers/portal-chat.mjs';

const CSOL =
  'What is the procedure for change in scope of licence (CSoL) under Scheme I?';

const HELMET_MANUAL =
  'What tests are required for IS 4151 industrial safety helmets?';

test.describe('Knowledge cluster smoke', () => {
  test('K-01 CSoL — substantive answer (not generic insufficient only)', async ({ page }) => {
    await preparePortalChat(page, 'industry');
    const answer = await sendAndWaitForAssistant(page, CSOL);
    expect(answer.toLowerCase()).not.toMatch(/^insufficient evidence only$/);
    expect(answer.toLowerCase()).toMatch(/scope|licence|csol/i);
  });

  test('K-14 IS 4151 — mentions helmet or 4151', async ({ page }) => {
    await preparePortalChat(page, 'industry');
    const answer = await sendAndWaitForAssistant(page, HELMET_MANUAL);
    expect(answer).toMatch(/4151|helmet/i);
  });
});

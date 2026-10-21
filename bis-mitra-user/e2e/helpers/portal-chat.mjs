import { expect } from '@playwright/test';

/** Fresh portal session: home, persona, chat input ready (send enables after typing). */
export async function preparePortalChat(page, persona = 'industry') {
  await page.goto('/');
  await page.getByTestId('portal-knowledge-label').waitFor({ state: 'visible', timeout: 20_000 });
  await page.getByTestId('portal-persona-select').selectOption(persona);
  await page.getByTestId('portal-chat-input').waitFor({ state: 'visible', timeout: 15_000 });
}

async function assistantFailedFetch(page) {
  const last = page.locator('.bp-msg.assistant').last();
  if (!(await last.isVisible().catch(() => false))) return false;
  return /failed to fetch/i.test(await last.innerText());
}

export async function sendAndWaitForTestId(page, prompt, testId, timeout = 120_000) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByTestId('portal-chat-input').fill(prompt);
    await page.getByTestId('portal-send').click();
    const card = page.getByTestId(testId);
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await card.isVisible().catch(() => false)) return;
      if (await assistantFailedFetch(page) && attempt === 0) break;
      await page.waitForTimeout(500);
    }
    if (attempt === 0 && (await assistantFailedFetch(page))) continue;
    await expect(card).toBeVisible({ timeout: Math.max(deadline - Date.now(), 5_000) });
    return;
  }
}

export async function sendAndWaitForAssistant(page, prompt, timeout = 120_000) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByTestId('portal-chat-input').fill(prompt);
    await page.getByTestId('portal-send').click();
    await expect(page.locator('.bp-msg.assistant').last()).toBeVisible({ timeout });
    if (!(await assistantFailedFetch(page)) || attempt === 1) {
      return page.locator('.bp-msg.assistant').last().innerText();
    }
  }
  return page.locator('.bp-msg.assistant').last().innerText();
}

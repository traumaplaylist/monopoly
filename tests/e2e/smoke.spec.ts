import { expect, test } from '@playwright/test';

test('партия запускается, кубики бросаются, бот отвечает ходом', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator('[data-testid=bots]').fill('1');
  await page.fill('input[inputmode=numeric]', '2024');
  await page.click('[data-testid=start]');

  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('[data-testid=player-p0]')).toBeVisible();
  await expect(page.locator('[data-testid=player-b1]')).toBeVisible();
  await expect(page.locator('[data-testid=banner]')).toContainText('ТВОЙ ХОД');

  await page.click('[data-testid=roll]');

  // Доигрываем свой ход: покупка (если предложено) и завершение.
  const enabled = (id: string) => page.locator(`[data-testid=${id}]:not([disabled])`);
  for (let i = 0; i < 20; i++) {
    if (await enabled('buy').count()) await enabled('buy').click();
    else if (await enabled('end-turn').count()) {
      await enabled('end-turn').click();
      break;
    } else if (await enabled('roll').count()) await enabled('roll').click();
    else if (await enabled('auction-pass').count()) await enabled('auction-pass').click();
    await page.waitForTimeout(700);
  }

  // Бот должен сделать ход: это видно в журнале (панель «Ещё»).
  await expect(page.locator('[data-testid=banner]')).toContainText('ТВОЙ ХОД', { timeout: 25_000 });
  await page.click('[data-testid=more]');
  await expect(page.locator('[data-testid=log]')).toContainText('Вега бросает');
  await expect(page.locator('[data-testid=log]')).toContainText('Капитан бросает');

  // Сохранение подхватывается после перезагрузки.
  await page.reload();
  await expect(page.locator('[data-testid=continue]')).toBeVisible();
  await page.click('[data-testid=continue]');
  await expect(page.locator('[data-testid=banner]')).toBeVisible();

  expect(errors).toEqual([]);
});

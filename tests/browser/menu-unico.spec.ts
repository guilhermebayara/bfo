import { expect, test } from './fixtures';

test('menu da linha fecha ao abrir outro, clicar fora ou apertar Esc', async ({
  page,
}) => {
  await page.goto('/transacoes/2026-11');
  const menus = page.locator('.sheet-table td:last-child > details.row-menu');
  await expect(menus.nth(1)).toBeVisible();
  await menus.nth(0).locator('summary').click();
  await expect(menus.nth(0)).toHaveAttribute('open', '');
  await menus.nth(1).locator('summary').click();
  await expect(menus.nth(0)).not.toHaveAttribute('open', '');
  await expect(menus.nth(1)).toHaveAttribute('open', '');
  await page.locator('h1').first().click();
  await expect(menus.nth(1)).not.toHaveAttribute('open', '');
  await menus.nth(0).locator('summary').click();
  await page.keyboard.press('Escape');
  await expect(menus.nth(0)).not.toHaveAttribute('open', '');
});

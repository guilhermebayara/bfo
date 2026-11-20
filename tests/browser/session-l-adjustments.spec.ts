import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-15T12:00:00-03:00'));
});

test('resumo do mês se adapta à largura e lembra a escolha', async ({
  page,
}) => {
  await page.goto('/transacoes');

  const summary = page.getByRole('complementary', { name: 'Resumo do mês' });
  const table = page.locator('.sheet-table');
  const collapse = page.getByRole('button', { name: 'Recolher resumo do mês' });
  const expand = page.getByRole('button', { name: 'Expandir resumo do mês' });

  await expect(page).toHaveURL('/transacoes/2026-11');
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await expect(
    summary.getByRole('heading', { name: 'Resumo do mês' }),
  ).toBeVisible();
  const tableBesideSummary = (await table.boundingBox())!;
  const sideSummary = (await summary.boundingBox())!;
  expect(sideSummary.x).toBeGreaterThan(
    tableBesideSummary.x + tableBesideSummary.width,
  );

  await collapse.click();
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toBeHidden();
  expect((await table.boundingBox())!.width).toBeGreaterThan(
    tableBesideSummary.width,
  );
  await page.reload();
  await expect(expand).toBeVisible();

  await page.evaluate(() =>
    localStorage.removeItem('bfo:month-summary-expanded'),
  );
  await page.setViewportSize({ width: 720, height: 900 });
  await page.reload();
  await expect(expand).toBeVisible();
  await expect(summary).toBeHidden();

  await expand.click();
  await expect(summary).toBeVisible();
  const stackedSummary = (await summary.boundingBox())!;
  expect(stackedSummary.y + stackedSummary.height).toBeLessThan(
    (await table.boundingBox())!.y,
  );
  await page.reload();
  await expect(collapse).toBeVisible();
  await expect(summary).toBeVisible();
});

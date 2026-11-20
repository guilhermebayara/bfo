import { expect, test } from './fixtures';


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

test('fatura selecionada e compras do ciclo vêm antes da lista de faturas', async ({
  page,
}) => {
  await page.goto('/cartao?account=card-a');
  const selectedStatement = page.getByRole('region', {
    name: /^Fatura com vencimento em/,
  });
  const invoices = page.getByRole('region', { name: 'Lista de faturas' });
  const purchases = selectedStatement.getByRole('table', {
    name: 'Compras do ciclo',
  });
  await expect(purchases).toBeVisible();

  const previousInvoice = invoices
    .getByRole('table', { name: 'Faturas anteriores' })
    .getByRole('button', { name: '20/10/2026' });
  await previousInvoice.press('Enter');
  await expect(previousInvoice).toHaveAttribute('aria-pressed', 'true');
  await expect(
    selectedStatement.getByRole('heading', {
      name: 'Fatura com vencimento em 27/10/2026',
    }),
  ).toBeFocused();
  await expect(purchases).toContainText('Mesa de trabalho');

  const cycle = (await purchases.boundingBox())!;
  expect(cycle.y + cycle.height).toBeLessThan(
    (await invoices.boundingBox())!.y,
  );
  await expect(
    invoices.and(page.locator('#selected-statement ~ section')),
  ).toBeVisible();
});

test('títulos dos grupos de navegação são estáticos e o Tab percorre os links', async ({
  page,
}) => {
  await page.goto('/fundacoes');
  const navigation = page.getByRole('navigation', {
    name: 'Navegação principal',
  });
  const headings = navigation.getByRole('heading', { level: 2 });
  await expect(headings).toHaveText(['Movimento', 'Cadastros', 'Aplicativo']);
  for (const heading of await headings.all()) {
    await expect(heading).toHaveCSS('text-transform', 'uppercase');
    await expect(heading).toHaveCSS('border-bottom-style', 'solid');
    const appearance = await heading.evaluate((element) => {
      const { backgroundColor, color, cursor } = getComputedStyle(element);
      return { backgroundColor, color, cursor };
    });
    await heading.hover();
    await expect(heading).toHaveCSS(
      'background-color',
      appearance.backgroundColor,
    );
    await expect(heading).toHaveCSS('color', appearance.color);
    expect(appearance.cursor).toBe('auto');
    await heading.click();
    await expect(heading).not.toBeFocused();
    await expect(page).toHaveURL('/fundacoes');
  }

  await page.getByRole('link', { name: 'Pular para o conteúdo' }).focus();
  for (const link of await navigation.getByRole('link').all()) {
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
  }

  await page.setViewportSize({ width: 720, height: 900 });
  for (const heading of await headings.all())
    await expect(heading).toBeVisible();
});

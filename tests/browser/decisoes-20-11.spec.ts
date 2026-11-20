import { test, expect, type APIRequestContext } from '@playwright/test';
test.use({ extraHTTPHeaders: { 'x-bfo-data': '2026-11-15' } });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-15T15:00:00.000Z'));
});
const clock = { 'x-bfo-data': '2026-11-15' };
async function account(request: APIRequestContext) {
  const response = await request.post('/api/accounts', {
    headers: clock,
    data: {
      name: 'Conta padrão navegador',
      kind: 'checking',
      currency: 'BRL',
      institution_id: 'horizonte',
      opening_balance_cents: 80000,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}
test('define, troca e remove o padrão, e a sugestão continua editável', async ({
  page,
  request,
}) => {
  const id = await account(request);
  expect(
    (
      await request.post('/api/transactions', {
        headers: clock,
        data: {
          account_id: id,
          date: '2026-11-15',
          amount_cents: 2200,
          payee: 'Loja padrão navegador',
          category_id: 'groceries',
          tag_ids: ['planned'],
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto('/beneficiarios');
  const row = page
    .getByRole('row')
    .filter({ hasText: 'Loja padrão navegador' });
  await row.getByRole('button', { name: 'Definir padrão' }).click();
  const form = page.getByRole('form', {
    name: 'Padrão de Loja padrão navegador',
  });
  await form.getByLabel('Categoria padrão').selectOption('entertainment');
  await form.getByRole('checkbox', { name: 'Viagem fictícia' }).check();
  await form.getByRole('button', { name: 'Salvar padrão' }).click();
  await expect(page.locator('main p[role="status"]')).toContainText(
    'Padrão salvo',
  );
  await expect(row).toContainText('Entretenimento, Viagem fictícia');
  await row.getByRole('button', { name: 'Trocar padrão' }).click();
  await form.getByLabel('Categoria padrão').selectOption('restaurant');
  await form.getByRole('checkbox', { name: 'Viagem fictícia' }).uncheck();
  await form.getByRole('checkbox', { name: 'Planejado' }).check();
  await form.getByRole('button', { name: 'Salvar padrão' }).click();
  await expect(row).toContainText('Restaurantes, Planejado');
  await page.goto('/transacoes/2026-11');
  await page.getByRole('button', { name: /^Adicionar em / }).click();
  const entry = page.locator('tr[data-new-transaction]');
  await entry
    .getByRole('combobox', { name: 'Conta do novo lançamento' })
    .selectOption(id);
  await entry.getByLabel('Beneficiário').fill('Loja padrão navegador');
  await expect(entry.getByRole('combobox', { name: 'Categoria' })).toHaveValue(
    'restaurant',
  );
  await expect(entry.getByRole('status')).toContainText('Sugestão pelo padrão');
  await entry.getByText('1 tags').click();
  await expect(
    entry.getByRole('checkbox', { name: 'Planejado' }),
  ).toBeChecked();
  await entry
    .getByRole('combobox', { name: 'Categoria' })
    .selectOption('groceries');
  await entry.getByLabel('Valor (BRL)').fill('18,00');
  await entry.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(entry.getByRole('status')).toHaveText('Lançamento salvo.');
  const saved = await (
    await request.get(
      '/api/transactions?month=2026-11&search=Loja%20padr%C3%A3o%20navegador',
      { headers: clock },
    )
  ).json();
  const edited = saved.items.find(
    (t: { amount_cents: number }) => t.amount_cents === 1800,
  );
  expect(edited.category_id).toBe('groceries');
  await page.goto('/beneficiarios');
  await page
    .getByRole('row')
    .filter({ hasText: 'Loja padrão navegador' })
    .getByRole('button', { name: 'Trocar padrão' })
    .click();
  await page.getByRole('button', { name: 'Remover padrão' }).click();
  await expect(page.locator('main p[role="status"]')).toContainText(
    'Padrão removido',
  );
  await expect(
    page.getByRole('row').filter({ hasText: 'Loja padrão navegador' }),
  ).toContainText('Sem padrão');
  await page.goto('/transacoes/2026-11');
  await page.getByRole('button', { name: /^Adicionar em / }).click();
  const again = page.locator('tr[data-new-transaction]');
  await again.getByLabel('Beneficiário').fill('Loja padrão navegador');
  await expect(again.getByRole('combobox', { name: 'Categoria' })).toHaveValue(
    'groceries',
  );
  await expect(again.getByRole('status')).toContainText(
    'Sugestão pelo último lançamento',
  );
});

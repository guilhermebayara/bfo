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
test('lançamento e transferência com data futura ficam em Próximos e fora do saldo', async ({
  page,
  request,
}) => {
  const source = await account(request);
  const dest = await request.post('/api/accounts', {
    headers: clock,
    data: {
      name: 'Destino futuro navegador',
      kind: 'checking',
      currency: 'BRL',
      institution_id: 'horizonte',
      opening_balance_cents: 0,
    },
  });
  expect(dest.status()).toBe(201);
  const destination = (await dest.json()).id as string;
  await page.goto('/transacoes/2026-11');
  await page.getByRole('button', { name: /^Adicionar em / }).click();
  const entry = page.locator('tr[data-new-transaction]');
  await entry.getByLabel('Data').fill('2026-11-20');
  await entry
    .getByRole('combobox', { name: 'Conta do novo lançamento' })
    .selectOption(source);
  await entry.getByLabel('Beneficiário').fill('Boleto futuro navegador');
  await entry.getByLabel('Valor (BRL)').fill('25,00');
  await entry
    .getByRole('combobox', { name: 'Categoria' })
    .selectOption('groceries');
  await entry.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(entry.getByRole('status')).toHaveText('Lançamento salvo.');
  await page
    .getByLabel('Escolher conta para adicionar')
    .selectOption('transfer');
  const transfer = page.locator('[data-new-transfer]');
  await transfer.getByLabel('Conta de origem').selectOption(source);
  await transfer.getByLabel('Conta de destino').selectOption(destination);
  await transfer.getByLabel('Data da transferência').fill('2026-11-21');
  await transfer.getByLabel('Valor da transferência (BRL)').fill('10,00');
  await transfer.getByRole('button', { name: 'Salvar transferência' }).click();
  await expect(transfer.getByRole('status')).toHaveText('Transferência salva.');
  const accounts = await (
    await request.get('/api/accounts', { headers: clock })
  ).json();
  expect(
    accounts.find((a: { id: string }) => a.id === source).balance_cents,
  ).toBe(80000);
  expect(
    accounts.find((a: { id: string }) => a.id === destination).balance_cents,
  ).toBe(0);
  await page.goto('/proximos');
  await expect(page.getByRole('heading', { name: 'Próximos' })).toBeVisible();
  await expect(page.getByText('Boleto futuro navegador')).toBeVisible();
  await expect(
    page.getByText('Transferência → Destino futuro navegador'),
  ).toBeVisible();
  const upcoming = await (
    await request.get('/api/upcoming', { headers: clock })
  ).json();
  expect(
    upcoming.items.filter(
      (i: { label: string }) => i.label === 'Boleto futuro navegador',
    ),
  ).toHaveLength(1);
  expect(
    upcoming.items.filter((i: { label: string }) =>
      i.label.startsWith('Transferência → Destino futuro navegador'),
    ),
  ).toHaveLength(1);
});
test('saldo do cartão em Contas deixa a parcela futura no comprometido', async ({
  page,
  request,
}) => {
  const created = await request.post('/api/accounts', {
    headers: clock,
    data: {
      name: 'Cartão saldo navegador',
      kind: 'credit_card',
      currency: 'BRL',
      institution_id: 'horizonte',
      closing_day: 20,
      due_day: 27,
      credit_limit_cents: 100000,
    },
  });
  expect(created.status()).toBe(201);
  const card = (await created.json()).id as string;
  for (const data of [
    {
      date: '2026-11-15',
      amount_cents: 8000,
      payee: 'Compra à vista navegador',
    },
    {
      date: '2026-11-15',
      amount_cents: 9000,
      payee: 'Compra parcelada navegador',
      installment_count: 3,
    },
    {
      date: '2026-11-18',
      amount_cents: 2500,
      payee: 'Compra ainda não vencida navegador',
    },
  ]) {
    expect(
      (
        await request.post('/api/transactions', {
          headers: clock,
          data: {
            account_id: card,
            category_id: 'groceries',
            tag_ids: [],
            ...data,
          },
        })
      ).status(),
    ).toBe(201);
  }
  const accounts = await (
    await request.get('/api/accounts', { headers: clock })
  ).json();
  expect(
    accounts.find((a: { id: string }) => a.id === card).balance_cents,
  ).toBe(-11000);
  await page.goto('/contas');
  await expect(
    page.getByRole('row').filter({ hasText: 'Cartão saldo navegador' }),
  ).toContainText('110,00');
  await page.goto(`/cartao?account=${card}`);
  await expect(page.getByLabel('Limite do cartão')).toContainText(
    'Comprometido: R$ 195,00',
  );
  await expect(page.getByLabel('Limite do cartão')).toContainText(
    'Disponível: R$ 805,00',
  );
});

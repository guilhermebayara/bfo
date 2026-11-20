import { test, expect, type APIRequestContext } from '@playwright/test';
async function account(
  request: APIRequestContext,
  currency = 'BRL',
  name = 'Conta teste B',
) {
  const response = await request.post('/api/accounts', {
    data: {
      name,
      kind: 'checking',
      currency,
      institution_id: 'horizonte',
      opening_balance_cents: 50000,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}
const today = () => new Date().toISOString().slice(0, 10);
test('lançamento sugere beneficiário, usa fallback manual de câmbio e filtra tags', async ({
  page,
  request,
}) => {
  const id = await account(request, 'USD', 'Exterior teste B');
  expect(
    (
      await request.post('/api/transactions', {
        data: {
          account_id: id,
          date: today(),
          amount_cents: 100,
          payee: 'Café fictício B',
          category_id: 'groceries',
          tag_ids: ['planned'],
          fx_rate: 5,
        },
      })
    ).status(),
  ).toBe(201);
  await page.route('**/api/fx?**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Indisponível' }),
    }),
  );
  await page.goto('/transacoes');
  await page.getByRole('button', { name: /^Filtros/ }).click();
  const filters = page.getByRole('region', { name: 'Filtros de transações' }); // section com nome acessível
  await expect(
    page
      .locator('section[aria-label="Filtros de transações"] select')
      .first()
      .locator('option[value="closed"]'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: /^Adicionar em / }).click();
  const manual = page.locator('tr[data-new-transaction]');
  await manual
    .getByRole('combobox', { name: 'Conta do novo lançamento', exact: true })
    .selectOption(id);
  await manual
    .getByLabel('Beneficiário', { exact: true })
    .fill('Café fictício B');
  await expect(
    manual.getByRole('combobox', { name: 'Categoria', exact: true }),
  ).toHaveValue('groceries');
  await manual.getByText('1 tags', { exact: true }).click();
  await expect(
    manual.getByRole('checkbox', { name: 'Planejado' }),
  ).toBeChecked();
  await manual.getByText('Cotação', { exact: true }).click();
  await expect(
    manual.getByText('PTAX indisponível. Preencha a cotação manualmente.', {
      exact: false,
    }),
  ).toBeVisible();
  await manual.getByLabel('Valor (USD)', { exact: true }).fill('12,34');
  await manual.getByLabel('Cotação para BRL', { exact: false }).fill('5,25');
  await expect(
    manual.getByText('Valor em reais:', { exact: false }),
  ).toContainText('64,79');
  await manual.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(manual.getByRole('status').last()).toHaveText(
    'Lançamento salvo.',
  );
  await page
    .locator('section[aria-label="Filtros de transações"]')
    .getByRole('combobox', { name: 'Conta', exact: true })
    .selectOption(id);
  await page
    .locator('section[aria-label="Filtros de transações"]')
    .getByRole('combobox', { name: 'Tag', exact: true })
    .selectOption('planned');
  await expect(
    page.getByText('2 transações ·', { exact: false }),
  ).toBeVisible();
  const headers = await page.locator('table thead th').allTextContents();
  expect(headers).toEqual([
    '',
    'Data',
    'Conta',
    'Beneficiário',
    'Valor',
    'Categoria',
    'Alocação',
    'Notas',
    'Tags',
    'Origem',
    'Parcelas',
    'Ações',
  ]);
  const data = await (
    await request.get(`/api/transactions?account=${id}`)
  ).json();
  expect(
    data.items.find((t: { amount_cents: number }) => t.amount_cents === 1234),
  ).toMatchObject({
    amount_brl_cents: 6479,
    fx_source: 'manual',
    currency: 'USD',
  });
});
test('contas agrupadas, encerradas recolhidas e conferência com ajuste', async ({
  page,
  request,
}) => {
  const id = await account(request, 'BRL', 'Conferência fictícia B');
  await page.route('**/api/fx?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rate: 5 }),
    }),
  );
  await page.goto('/contas');
  await expect(
    page.getByRole('heading', { name: 'Instituição Horizonte' }),
  ).toBeVisible();
  await expect(
    page.getByText('Conta antiga fictícia', { exact: true }),
  ).toBeHidden();
  await page.getByText('Encerradas (1)', { exact: true }).click();
  await expect(
    page.getByText('Conta antiga fictícia', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Agrupar por', exact: true })
    .selectOption('kind');
  await expect(
    page.getByRole('heading', { name: 'Conta corrente', exact: true }),
  ).toBeVisible();
  const row = page
    .getByRole('row')
    .filter({ hasText: 'Conferência fictícia B' });
  await row.getByRole('button', { name: 'Conferir saldo' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Saldo do banco (BRL)').fill('490,00');
  await modal.getByRole('button', { name: 'Ver diferença' }).click();
  await expect(
    modal.getByText('Ajuste visível:', { exact: false }),
  ).toContainText('10,00');
  await modal.getByRole('button', { name: 'Lançar ajuste e conferir' }).click();
  await expect(modal).toHaveCount(0);
  await expect(row).toContainText('490,00');
  await expect(row).not.toContainText('Ainda não conferida');
  const data = await (
    await request.get(`/api/transactions?account=${id}&origin=adjustment`)
  ).json();
  expect(data.items[0]).toMatchObject({
    amount_cents: 1000,
    origin: 'adjustment',
  });
});
test('edita categorias e tags e unifica beneficiários em lote', async ({
  page,
  request,
}) => {
  await page.goto('/categorias');
  const allocation = page.locator('section').filter({
    has: page.getByRole('heading', {
      name: 'Grupos de alocação',
      exact: true,
    }),
  });
  await allocation
    .getByLabel('Nome', { exact: true })
    .fill('Alocação fictícia B');
  await allocation.getByLabel('Percentual previsto').fill('10');
  await allocation
    .getByRole('button', { name: 'Adicionar', exact: true })
    .click();
  await expect(
    allocation.getByRole('cell', { name: 'Alocação fictícia B', exact: true }),
  ).toBeVisible();
  const groups = page.locator('section').filter({
    has: page.getByRole('heading', {
      name: 'Grupos de categoria',
      exact: true,
    }),
  });
  await groups.getByLabel('Nome', { exact: true }).fill('Grupo fictício B');
  await groups
    .getByRole('combobox', { name: 'Grupo de alocação', exact: true })
    .selectOption({ label: 'Alocação fictícia B' });
  await groups.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(
    groups.getByRole('cell', { name: 'Grupo fictício B', exact: true }),
  ).toBeVisible();
  const cats = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Categorias', exact: true }),
  });
  await cats.getByLabel('Nome', { exact: true }).fill('Categoria fictícia B');
  await cats
    .getByRole('combobox', { name: 'Grupo de categoria', exact: true })
    .selectOption({ label: 'Grupo fictício B' });
  await cats.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(
    cats.getByRole('cell', { name: 'Categoria fictícia B', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Tags', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Evento fictício B');
  await page.getByLabel('Cor', { exact: true }).fill('#123456');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Evento fictício B' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Evento revisado B');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(
    page.getByRole('cell', { name: 'Evento revisado B', exact: true }),
  ).toBeVisible();
  const id = await account(request);
  for (const payee of ['Loja B nome antigo', 'Loja B nome escolhido'])
    expect(
      (
        await request.post('/api/transactions', {
          data: {
            account_id: id,
            date: today(),
            amount_cents: 100,
            payee,
            tag_ids: [],
          },
        })
      ).status(),
    ).toBe(201);
  await page.getByRole('link', { name: 'Beneficiários', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Nome de destino', exact: true })
    .selectOption({ label: 'Loja B nome escolhido' });
  await page
    .getByRole('checkbox', { name: 'Unificar Loja B nome antigo', exact: true })
    .check();
  await page
    .getByRole('button', { name: 'Unificar nomes selecionados' })
    .click();
  await expect(page.locator('main').getByRole('status')).toContainText(
    'Nomes unificados',
  );
  await expect(
    page.getByRole('cell', { name: 'Loja B nome antigo', exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Loja B nome escolhido' })
      .getByRole('cell')
      .nth(2),
  ).toHaveText('2');
});
test('conta criada pela interface nasce ativa', async ({ page }) => {
  await page.goto('/contas');
  await page.getByText('Nova conta', { exact: true }).click();
  const form = page
    .locator('details')
    .filter({ has: page.getByText('Nova conta', { exact: true }) });
  await form
    .getByLabel('Nome da conta', { exact: true })
    .fill('Conta criada na tela B');
  await form
    .getByRole('combobox', { name: 'Instituição', exact: true })
    .selectOption('horizonte');
  await form.getByRole('button', { name: 'Criar conta ativa' }).click();
  await expect(form.getByRole('status')).toHaveText('Conta criada e ativa.');
  await expect(
    page.getByRole('row').filter({ hasText: 'Conta criada na tela B' }),
  ).toContainText('Ativa desde');
});
test('cotação manual não é sobrescrita por resposta automática atrasada', async ({
  page,
  request,
}) => {
  const id = await account(request, 'USD', 'Conta câmbio pendente B');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route('**/api/fx?**', async (route) => {
    requested();
    await gate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rate: 7.77 }),
    });
  });
  await page.goto('/transacoes');
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await page.getByRole('button', { name: /^Adicionar em / }).click();
  const manual = page.locator('tr[data-new-transaction]');
  await manual
    .getByRole('combobox', { name: 'Conta do novo lançamento', exact: true })
    .selectOption(id);
  await started;
  await manual.getByText('Cotação', { exact: true }).click();
  await manual.getByLabel('Cotação para BRL', { exact: false }).fill('5,25');
  await expect(
    manual.getByRole('button', { name: 'Salvar lançamento' }),
  ).toBeEnabled();
  release();
  await expect(
    manual.getByLabel('Cotação para BRL', { exact: false }),
  ).toHaveValue('5,25');
  await manual
    .getByLabel('Beneficiário', { exact: true })
    .fill('Cotação manual fictícia B');
  await manual.getByLabel('Valor (USD)', { exact: true }).fill('10,00');
  await manual.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(manual.getByRole('status').last()).toHaveText(
    'Lançamento salvo.',
  );
  const data = await (
    await request.get(`/api/transactions?account=${id}`)
  ).json();
  expect(data.items[0]).toMatchObject({
    fx_source: 'manual',
    fx_rate: 5.25,
    amount_brl_cents: 5250,
  });
});

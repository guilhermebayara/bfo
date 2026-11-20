import { test, expect, type APIRequestContext } from '@playwright/test';
async function create(request: APIRequestContext, payee: string, extra = {}) {
  const response = await request.post('/api/transactions', {
    data: {
      account_id: 'seed-f-account',
      date: '2026-11-19',
      amount_cents: 12345,
      payee,
      ...extra,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}
test('linhas têm altura única, notas longas são truncadas e editor mantém conteúdo completo', async ({
  page,
  request,
}) => {
  const note =
    'Nota fictícia longa para conferir reticências e edição completa. '.repeat(
      12,
    );
  const id = await create(request, 'Linha longa fictícia H', { note });
  await page.goto('/transacoes/2026-11');
  const rows = page.locator('tr[data-transaction-id]');
  await expect(rows.first()).toBeVisible();
  const heights = await rows.evaluateAll((rows) =>
    rows.map((r) => r.getBoundingClientRect().height),
  );
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
  expect(Math.max(...heights)).toBeLessThanOrEqual(40);
  const row = page.locator(`tr[data-transaction-id="${id}"]`),
    cell = row.locator('[data-sheet-cell="6"]');
  expect(
    await cell
      .locator('.cell-value')
      .evaluate((e) => e.scrollWidth > e.clientWidth),
  ).toBe(true);
  await cell.click();
  await expect(
    row.getByRole('textbox', {
      name: 'Nota de Linha longa fictícia H',
      exact: true,
    }),
  ).toHaveValue(note);
  expect((await row.boundingBox())!.height).toBeLessThanOrEqual(40);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.goto('/transacoes/2026-11');
  await expect(page.locator('tr[data-transaction-id]').first()).toBeVisible();
  await page.screenshot({ path: '/tmp/bfo-transacoes.png', fullPage: true });
});
test('botão insere a linha nas mesmas colunas, Enter salva e prepara a próxima; categoria define sinal', async ({
  page,
  request,
}) => {
  await page.goto('/configuracoes');
  await page
    .getByLabel('Conta padrão para lançamentos')
    .selectOption('seed-f-account');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByRole('status').last()).toHaveText(
    'Configurações salvas.',
  );
  await page.getByRole('link', { name: 'Transações', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Adicionar em Conta de divisão fictícia',
      exact: true,
    })
    .click();
  const row = page.locator('tr[data-new-transaction]');
  await expect(row.locator('td')).toHaveCount(11);
  expect((await row.boundingBox())!.height).toBeLessThanOrEqual(40);
  await expect(row.getByLabel('Conta do novo lançamento')).toHaveValue(
    'seed-f-account',
  );
  await row
    .getByLabel('Beneficiário', { exact: true })
    .fill('Renda na linha fictícia H');
  await row.getByLabel('Beneficiário', { exact: true }).press('ArrowRight');
  await expect(row.getByLabel('Valor (BRL)', { exact: true })).toBeFocused();
  await row.getByLabel('Valor (BRL)', { exact: true }).fill('65,43');
  await row.getByLabel('Categoria', { exact: true }).selectOption('salary');
  await expect(
    row.getByRole('button', { name: 'Inverter sinal do novo lançamento' }),
  ).toHaveText('[+]');
  await row.getByLabel('Valor (BRL)', { exact: true }).press('Enter');
  await expect(row.getByRole('status')).toHaveText('Lançamento salvo.');
  await expect(row.getByLabel('Beneficiário', { exact: true })).toBeFocused();
  await expect(row.getByLabel('Valor (BRL)', { exact: true })).toHaveValue('');
  let items = (
    await (
      await request.get('/api/transactions?search=Renda na linha fictícia H')
    ).json()
  ).items;
  expect(items[0].amount_cents).toBe(-6543);
  await row
    .getByLabel('Beneficiário', { exact: true })
    .fill('Sinal invertido fictício H');
  await row.getByLabel('Valor (BRL)', { exact: true }).fill('10,00');
  await row.getByLabel('Categoria', { exact: true }).selectOption('salary');
  await row
    .getByRole('button', { name: 'Inverter sinal do novo lançamento' })
    .click();
  await row.getByLabel('Valor (BRL)', { exact: true }).press('Enter');
  await expect(
    page
      .locator('tr[data-transaction-id]')
      .filter({ hasText: 'Sinal invertido fictício H' }),
  ).toHaveCount(1);
  items = (
    await (
      await request.get('/api/transactions?search=Sinal invertido fictício H')
    ).json()
  ).items;
  expect(items[0].amount_cents).toBe(1000);
  await row.getByLabel('Beneficiário', { exact: true }).press('Escape');
  await expect(row).toHaveCount(0);
});
test('clique e teclado salvam, sinal acompanha categoria e bloqueio explica motivo uma vez na linha', async ({
  page,
  request,
}) => {
  const id = await create(request, 'Edição e sinal H');
  await page.goto('/transacoes/2026-11');
  const row = page.locator(`tr[data-transaction-id="${id}"]`);
  await row.locator('[data-sheet-cell="4"]').click();
  await row
    .getByRole('combobox', {
      name: 'Categoria de Edição e sinal H',
      exact: true,
    })
    .selectOption('salary');
  await expect(row.locator('[data-sheet-cell="3"]')).toContainText('+');
  await row.locator('[data-sheet-cell="3"]').click();
  await row.getByLabel('Valor (BRL)', { exact: true }).fill('50,00');
  await row.getByLabel('Valor (BRL)', { exact: true }).press('Tab');
  await expect(row.locator('[data-sheet-cell="4"]')).toBeFocused();
  await expect(row.locator('[data-sheet-cell="3"]')).toContainText('50,00');
  await row.locator('[data-sheet-cell="4"]').press('ArrowRight');
  await expect(row.locator('[data-sheet-cell="5"]')).toBeFocused();
  await row.locator('[data-sheet-cell="6"]').click();
  await row
    .getByRole('textbox', { name: 'Nota de Edição e sinal H', exact: true })
    .fill('Cancelar');
  await page.keyboard.press('Escape');
  await expect(row).not.toContainText('Cancelar');
  await page.goto('/transacoes/2025-09?account=checking');
  const locked = page.locator('tr[data-transaction-id="seed-2025-09-rent"]');
  await expect(locked.locator('.row-lock')).toHaveCount(1);
  await locked.locator('[data-sheet-cell="0"]').click();
  await expect(locked.getByRole('alert')).toContainText('Importada:');
});
test('transferência aparece em uma linha neutra e mostra perspectiva de cada conta no filtro', async ({
  page,
}) => {
  await page.goto('/transacoes/2026-11');
  await page
    .getByRole('searchbox', { name: 'Busca rápida' })
    .fill('Transferência fictícia');
  const rows = page.locator('tr[data-transaction-id]');
  await expect(rows).toHaveCount(1);
  await expect(rows.locator('[data-sheet-cell="1"]')).toContainText(
    'Conta de divisão fictícia → Dinheiro fictício H',
  );
  await expect(rows.locator('[data-sheet-cell="3"]')).toHaveText('R$ 150,00');
  await expect(rows.locator('.income')).toHaveCount(0);
  await page.getByRole('button', { name: /^Filtros/ }).click();
  const filters = page.getByRole('region', { name: 'Filtros de transações' });
  await filters
    .getByRole('combobox', { name: 'Conta', exact: true })
    .selectOption('seed-f-account');
  await expect(rows.locator('[data-sheet-cell="3"]')).toContainText('−');
  await filters
    .getByRole('combobox', { name: 'Conta', exact: true })
    .selectOption('seed-h-destination');
  await expect(rows).toHaveCount(1);
  await expect(rows.locator('[data-sheet-cell="3"]')).toContainText('+');
});
test('seleção múltipla mostra total e média, edita em lote e exclui os selecionados', async ({
  page,
  request,
}) => {
  const a = await create(request, 'Lote navegador H A', { amount_cents: 1000 }),
    b = await create(request, 'Lote navegador H B', { amount_cents: 3000 });
  await page.goto('/transacoes/2026-11');
  for (const id of [a, b])
    await page
      .locator(`tr[data-transaction-id="${id}"] input[type="checkbox"]`)
      .check();
  const panel = page.getByRole('region', { name: 'Seleção múltipla' });
  await expect(panel).toContainText('2 selecionadas');
  await expect(panel).toContainText('Total: -R$ 40,00');
  await expect(panel).toContainText('Média: -R$ 20,00');
  await panel.getByLabel('Nova categoria').selectOption('entertainment');
  await panel.getByRole('button', { name: 'Aplicar aos selecionados' }).click();
  await expect(panel).toHaveCount(0);
  for (const id of [a, b]) {
    const row = page.locator(`tr[data-transaction-id="${id}"]`);
    await expect(row.locator('[data-sheet-cell="4"]')).toHaveText(
      'Entretenimento',
    );
    await row.getByRole('checkbox').check();
  }
  await panel.getByLabel('Editar em lote').selectOption('note');
  await panel.getByLabel('Nova nota').fill('Nota do lote H');
  await panel.getByRole('button', { name: 'Aplicar aos selecionados' }).click();
  await expect(panel).toHaveCount(0);
  for (const id of [a, b]) {
    const row = page.locator(`tr[data-transaction-id="${id}"]`);
    await expect(row).toContainText('Nota do lote H');
    await row.getByRole('checkbox').check();
  }
  await panel.getByRole('button', { name: 'Excluir selecionados' }).click();
  await panel.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(panel).toHaveCount(0);
  for (const id of [a, b])
    await expect(page.locator(`tr[data-transaction-id="${id}"]`)).toHaveCount(
      0,
    );
});
test('marcas herdadas aparecem e resumo atualiza ao excluir categoria dos totais', async ({
  page,
  request,
}) => {
  const g = await (
    await request.post('/api/category-groups', {
      data: {
        name: 'Herança fictícia H',
        allocation_group_id: 'essential',
        is_income: 1,
      },
    })
  ).json();
  const cat = await (
    await request.post('/api/categories', {
      data: { name: 'Renda herdada H', category_group_id: g.id },
    })
  ).json();
  await create(request, 'Renda herdada navegador H', {
    category_id: cat.id,
    amount_cents: -50000,
  });
  await page.goto('/categorias');
  const cats = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Categorias', exact: true }),
  });
  await cats.getByRole('button', { name: 'Editar Renda herdada H' }).click();
  await expect(
    cats.getByLabel('Tratar como renda (herdada do grupo)', { exact: true }),
  ).toBeChecked();
  await expect(
    cats.getByLabel('Tratar como renda (herdada do grupo)', { exact: true }),
  ).toBeDisabled();
  await page.goto('/transacoes/2026-11');
  const summary = page.getByRole('region', { name: 'Resumo do mês' });
  await expect(summary).toContainText('Renda herdada H');
  await request.patch(`/api/category-groups/${g.id}`, {
    data: { exclude_totals: 1 },
  });
  await page.reload();
  await expect(summary).not.toContainText('Renda herdada H');
});
test('moeda é uma lista ao criar e editar a conta e conta padrão reaparece após recarga', async ({
  page,
  request,
}) => {
  await page.goto('/contas');
  await page.getByText('Nova conta', { exact: true }).click();
  const form = page
    .locator('details')
    .filter({ has: page.getByText('Nova conta', { exact: true }) });
  await expect(
    form.getByRole('combobox', { name: 'Moeda', exact: true }),
  ).toHaveValue('BRL');
  await form
    .getByLabel('Nome da conta', { exact: true })
    .fill('Conta seletor fictícia H');
  await form
    .getByRole('combobox', { name: 'Instituição', exact: true })
    .selectOption('horizonte');
  await form.getByRole('button', { name: 'Criar conta ativa' }).click();
  await expect(form.getByRole('status')).toHaveText('Conta criada e ativa.');
  const row = page
    .getByRole('row')
    .filter({ hasText: 'Conta seletor fictícia H' });
  await row.getByRole('button', { name: 'Editar conta' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Moeda', { exact: true }).selectOption('USD');
  await modal.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(modal).toHaveCount(0);
  expect(
    (await (await request.get('/api/accounts')).json()).find(
      (a: { name: string }) => a.name === 'Conta seletor fictícia H',
    ).currency,
  ).toBe('USD');
  await page.goto('/configuracoes');
  await page
    .getByLabel('Conta padrão para lançamentos')
    .selectOption('seed-f-card');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByRole('status').last()).toHaveText(
    'Configurações salvas.',
  );
  await page.reload();
  await expect(page.getByLabel('Conta padrão para lançamentos')).toHaveValue(
    'seed-f-card',
  );
});

test('configurações aguardam preferência inicial sem sobrescrever a escolha durante resposta atrasada', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/preferences', async (route) => {
    if (route.request().method() === 'GET') await gate;
    await route.continue();
  });
  await page.goto('/configuracoes');
  const select = page.getByLabel('Conta padrão para lançamentos');
  await expect(select).toBeDisabled();
  release();
  await expect(select).toBeEnabled();
  await select.selectOption('seed-f-account');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByRole('status').last()).toHaveText(
    'Configurações salvas.',
  );
  await page.getByRole('link', { name: 'Transações', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Adicionar em Conta de divisão fictícia',
      exact: true,
    }),
  ).toBeVisible();
});

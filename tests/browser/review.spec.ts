import { test, expect, clockHeaders, type APIRequestContext } from './fixtures';
async function create(request: APIRequestContext, body: object = {}) {
  const response = await request.post('/api/transactions', {
    data: {
      account_id: 'seed-f-account',
      date: '2026-11-18',
      amount_cents: 1234,
      payee: 'Planilha fictícia G',
      ...body,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}
async function transaction(request: APIRequestContext, id: string) {
  const result = await (
    await request.get('/api/transactions?month=2026-11')
  ).json();
  return result.items.find((t: { id: string }) => t.id === id);
}
test('um clique edita cada campo permitido, salva ao sair e mantém alocação e tags atualizadas', async ({
  page,
  request,
}) => {
  const id = await create(request);
  await page.goto('/transacoes/2026-11?account=seed-f-account');
  const row = page.locator(`tr[data-transaction-id="${id}"]`);
  await row.locator('[data-sheet-cell="0"]').click();
  await row.locator('input[type="date"]').fill('2026-11-17');
  await row.locator('input[type="date"]').press('Tab');
  await expect(row.locator('[data-sheet-cell="1"]')).toBeFocused();
  await expect(row).toContainText('17/11/2026');
  await row.locator('[data-sheet-cell="4"]').click();
  await row
    .getByRole('combobox', {
      name: 'Categoria de Planilha fictícia G',
      exact: true,
    })
    .selectOption('groceries');
  await expect(row.locator('[data-sheet-cell="5"]')).toContainText('Essencial');
  await row.locator('[data-sheet-cell="5"]').click();
  await row
    .getByRole('combobox', {
      name: 'Categoria de Planilha fictícia G',
      exact: true,
    })
    .selectOption('entertainment');
  await expect(row.locator('[data-sheet-cell="4"]')).toHaveText(
    'Entretenimento',
  );
  await expect(row.locator('[data-sheet-cell="5"]')).toContainText(
    'Estilo de vida',
  );
  await row.locator('[data-sheet-cell="6"]').click();
  await row
    .getByRole('textbox', { name: 'Nota de Planilha fictícia G', exact: true })
    .fill('Nota salva automaticamente');
  await row.getByRole('textbox', { name: /^Nota de / }).press('Tab');
  await row.locator('[data-sheet-cell="7"]').click();
  await row.getByRole('checkbox', { name: 'Planejado', exact: true }).check();
  await page.getByRole('heading', { name: 'Transações', exact: true }).click();
  await expect(row).toContainText('Nota salva automaticamente');
  await expect(row.locator('[data-sheet-cell="7"]')).toHaveText('Planejado');
  await row.locator('[data-sheet-cell="1"]').click();
  await row
    .getByRole('combobox', {
      name: 'Conta de Planilha fictícia G',
      exact: true,
    })
    .selectOption('seed-f-card');
  await expect(row).toHaveCount(0);
  const saved = await transaction(request, id);
  expect(saved).toMatchObject({
    date: '2026-11-17',
    account_id: 'seed-f-card',
    category_id: 'entertainment',
    note: 'Nota salva automaticamente',
    tags: [{ id: 'planned' }],
  });
});
test('Enter e Tab salvam e avançam, Esc cancela e setas movem a seleção', async ({
  page,
  request,
}) => {
  const a = await create(request, {
    payee: 'Teclado A fictício G',
    date: '2026-11-30',
  });
  const b = await create(request, {
    payee: 'Teclado B fictício G',
    date: '2026-11-29',
  });
  await page.goto('/transacoes/2026-11?account=seed-f-account');
  const rowA = page.locator(`tr[data-transaction-id="${a}"]`),
    rowB = page.locator(`tr[data-transaction-id="${b}"]`);
  await rowA.locator('[data-sheet-cell="3"]').click();
  await rowA.getByLabel('Valor (BRL)', { exact: true }).fill('25,99');
  await rowA.getByLabel('Valor (BRL)', { exact: true }).press('Enter');
  await expect(rowB.locator('[data-sheet-cell="3"]')).toBeFocused();
  await expect(rowA).toContainText('25,99');
  await rowB.locator('[data-sheet-cell="3"]').press('ArrowUp');
  await expect(rowA.locator('[data-sheet-cell="3"]')).toBeFocused();
  await rowA.locator('[data-sheet-cell="3"]').press('ArrowRight');
  await expect(rowA.locator('[data-sheet-cell="4"]')).toBeFocused();
  await rowA.locator('[data-sheet-cell="4"]').press('ArrowLeft');
  await expect(rowA.locator('[data-sheet-cell="3"]')).toBeFocused();
  await rowA.locator('[data-sheet-cell="3"]').press('Enter');
  await rowA.getByLabel('Valor (BRL)', { exact: true }).fill('99,99');
  await rowA.getByLabel('Valor (BRL)', { exact: true }).press('Escape');
  await expect(rowA).toContainText('25,99');
  await rowA.locator('[data-sheet-cell="3"]').press('Shift+Tab');
  await expect(rowA.locator('[data-sheet-cell="2"]')).toBeFocused();
  await rowA.locator('[data-sheet-cell="2"]').click();
  await rowA
    .getByRole('textbox', {
      name: 'Beneficiário de Teclado A fictício G',
      exact: true,
    })
    .fill('Nome corrigido G');
  await rowA
    .getByRole('textbox', {
      name: 'Beneficiário de Teclado A fictício G',
      exact: true,
    })
    .press('Tab');
  await expect(rowA.locator('[data-sheet-cell="3"]')).toBeFocused();
  expect(await transaction(request, a)).toMatchObject({
    amount_cents: 2599,
    payee: 'Nome corrigido G',
  });
});
test('edição atualiza saldo, total da fatura e realizado dos recorrentes sem recarregar a página', async ({
  page,
  request,
}) => {
  const id = await create(request, {
    account_id: 'seed-f-card',
    payee: 'Cobrança variável G',
  });
  const initialAccounts = await (await request.get('/api/accounts')).json();
  const initial = initialAccounts.find(
    (a: { id: string }) => a.id === 'seed-f-card',
  ).balance_cents;
  const t = await transaction(request, id);
  const statements = await (
    await request.get('/api/cards/seed-f-card/statements')
  ).json();
  const before = statements.find(
    (s: { id: string }) => s.id === t.statement_id,
  ).total_cents;
  expect(
    (
      await request.post('/api/recurring', {
        data: {
          account_id: 'seed-f-card',
          payee: 'Cobrança variável G',
          amount_cents: 1234,
          cadence: 'monthly',
          next_date: '2026-11-18',
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto('/transacoes/2026-11?account=seed-f-card');
  const row = page.locator(`tr[data-transaction-id="${id}"]`);
  await row.locator('[data-sheet-cell="3"]').click();
  await row.getByLabel('Valor (BRL)', { exact: true }).fill('20,00');
  const refresh = page.waitForResponse(
    (r) => r.url().endsWith('/api/accounts') && r.ok(),
  );
  await row.getByLabel('Valor (BRL)', { exact: true }).press('Tab');
  const refreshed = await (await refresh).json();
  expect(
    refreshed.find((a: { id: string }) => a.id === 'seed-f-card').balance_cents,
  ).toBe(initial - 766);
  await page.getByRole('link', { name: 'Cartão', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Cartão', exact: true })
    .selectOption('seed-f-card');
  await expect(
    page
      .getByRole('table', { name: 'Compras do ciclo' })
      .getByRole('row')
      .filter({ hasText: 'Cobrança variável G' }),
  ).toContainText('20,00');
  const after = await (
    await request.get('/api/cards/seed-f-card/statements')
  ).json();
  expect(
    after.find((s: { id: string }) => s.id === t.statement_id).total_cents,
  ).toBe(before + 766);
  await page.getByRole('link', { name: 'Recorrentes', exact: true }).click();
  await page.getByLabel('Ir para o mês').fill('2026-11');
  await expect(
    page.getByRole('row').filter({ hasText: 'Cobrança variável G' }),
  ).toContainText('Realizado: R$ 20,00');
  await page.getByRole('link', { name: 'Contas', exact: true }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'Cartão de parcelas fictício' }),
  ).toContainText(
    (Math.abs(initial - 766) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
    }),
  );
});
test('erro de gravação preserva o valor persistido, informa a falha e permite corrigir', async ({
  page,
  request,
}) => {
  const id = await create(request, { payee: 'Erro fictício G' });
  await page.goto('/transacoes/2026-11?account=seed-f-account');
  const row = page.locator(`tr[data-transaction-id="${id}"]`);
  await row.locator('[data-sheet-cell="3"]').click();
  await row.getByLabel('Valor (BRL)', { exact: true }).fill('0,00');
  await row.getByLabel('Valor (BRL)', { exact: true }).press('Tab');
  await expect(row.getByRole('alert')).toContainText('diferente de zero');
  expect((await transaction(request, id)).amount_cents).toBe(1234);
  await row.getByLabel('Valor (BRL)', { exact: true }).fill('15,00');
  await row.getByLabel('Valor (BRL)', { exact: true }).press('Tab');
  await expect(row).toContainText('15,00');
  await expect(row.getByRole('alert')).toHaveCount(0);
});
test('importadas mostram campos financeiros travados e deixam classificar tags em um clique', async ({
  page,
  request,
}) => {
  await page.goto('/transacoes/2025-09?account=checking');
  const row = page.locator('tr[data-transaction-id="seed-2025-09-rent"]');
  for (const column of [0, 1, 2, 3, 8]) {
    await expect(row.locator(`[data-sheet-cell="${column}"]`)).toHaveAttribute(
      'aria-readonly',
      'true',
    );
    await row.locator(`[data-sheet-cell="${column}"]`).click();
    await expect(row.locator('input[type="date"]')).toHaveCount(0);
  }
  await row.locator('[data-sheet-cell="6"]').click();
  await row.getByRole('textbox', { name: /^Nota de / }).press('Tab');
  await row.locator('[data-sheet-cell="7"]').click();
  await row.getByRole('checkbox', { name: 'Planejado', exact: true }).check();
  await page.getByRole('heading', { name: 'Transações', exact: true }).click();
  await expect(row.locator('[data-sheet-cell="7"]')).toContainText('Planejado');
  const data = await (
    await request.get('/api/transactions?month=2025-09&account=checking')
  ).json();
  expect(
    data.items.find((t: { id: string }) => t.id === 'seed-2025-09-rent'),
  ).toMatchObject({
    date: '2025-09-10',
    amount_cents: 180000,
    tags: [{ id: 'planned' }],
  });
});
test('parcelado explica a parcela atual e mostra prévia completa das retroativas antes de salvar', async ({
  page,
}) => {
  await page.goto('/transacoes/2026-11');
  await page.getByText('Mais opções', { exact: true }).click();
  await page.getByRole('button', { name: 'Lançar compra parcelada' }).click();
  const form = page.getByRole('form', { name: 'Lançar transação' });
  await form
    .getByRole('combobox', { name: 'Conta', exact: true })
    .selectOption('seed-f-card');
  await form.getByLabel('Tipo de lançamento').selectOption('installment');
  await form.getByLabel('Total de parcelas').fill('10');
  await form.getByLabel('Parcela atual', { exact: true }).fill('3');
  await form
    .getByLabel('Data da parcela atual', { exact: true })
    .fill('2026-11-12');
  await form
    .getByLabel('Valor da parcela (BRL)', { exact: true })
    .fill('123,45');
  await expect(form).toContainText(
    'A parcela que aparece na fatura deste mês.',
  );
  const preview = page.getByRole('table', { name: 'Prévia das parcelas' });
  await expect(preview.getByRole('row')).toHaveCount(11);
  await expect(preview.getByRole('row').nth(1)).toContainText(
    'Retroativa · Antes do corte',
  );
  await expect(preview.getByRole('row').nth(2)).toContainText('Retroativa');
  await expect(preview.getByRole('row').nth(3)).toContainText('Atual');
  await expect(preview.getByRole('row').last()).toContainText('12/06/2027');
});
test('reabrir divisão com centavos permite salvar sem redigitar as partes', async ({
  page,
  request,
}) => {
  const id = await create(request, {
    amount_cents: 10001,
    payee: 'Reabertura G',
  });
  expect(
    (
      await request.put(`/api/transactions/${id}/splits`, {
        data: {
          mode: 'amount',
          expected_amount_cents: 10001,
          parts: [{ value: 3333 }, { value: 6668 }],
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto('/transacoes/2026-11?account=seed-f-account');
  await page
    .locator(`tr[data-transaction-id="${id}"] details.row-menu > summary`)
    .click();
  await page
    .locator(`tr[data-transaction-id="${id}"]`)
    .getByRole('button', { name: 'Editar divisão', exact: true })
    .click();
  const modal = page.getByRole('dialog');
  await expect(
    modal.getByLabel('Valor (BRL)', { exact: true }).first(),
  ).toHaveValue('33,33');
  await expect(
    modal.getByRole('button', { name: 'Salvar divisão' }),
  ).toBeEnabled();
  await modal.getByRole('button', { name: 'Salvar divisão' }).click();
  await expect(modal).toHaveCount(0);
});
test('lançamento abre no dia de São Paulo mesmo depois da virada UTC', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-30T22:30:00-03:00'));
  await page.setExtraHTTPHeaders(clockHeaders('2026-11-30'));
  await page.goto('/transacoes');
  await expect(page).toHaveURL('/transacoes/2026-11');
  await page.getByRole('button', { name: /^Adicionar em / }).click();
  await expect(
    page
      .locator('tr[data-new-transaction]')
      .getByLabel('Data', { exact: true }),
  ).toHaveValue('2026-11-30');
});
test('resposta de salvamento atrasada não tira foco nem apaga a edição da próxima célula', async ({
  page,
  request,
}) => {
  const id = await create(request, { payee: 'Foco rápido G' });
  await page.goto('/transacoes/2026-11?account=seed-f-account');
  const row = page.locator(`tr[data-transaction-id="${id}"]`);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/transactions/${id}`, async (route) => {
    if (route.request().method() === 'PATCH') await gate;
    await route.continue();
  });
  await row.locator('[data-sheet-cell="4"]').click();
  await row
    .getByRole('combobox', { name: 'Categoria de Foco rápido G', exact: true })
    .selectOption('groceries');
  await row.locator('[data-sheet-cell="6"]').click();
  const note = row.getByRole('textbox', {
    name: 'Nota de Foco rápido G',
    exact: true,
  });
  await note.fill('Rascunho preservado G');
  release();
  await expect(row.locator('[data-sheet-cell="4"]')).toHaveText('Mercado');
  await expect(note).toBeFocused();
  await expect(note).toHaveValue('Rascunho preservado G');
  await note.press('Tab');
  await expect(row).toContainText('Rascunho preservado G');
});

test('resposta antiga de saldos não substitui a atualização mais recente de outra célula', async ({
  page,
  request,
}) => {
  const a = await create(request, { payee: 'Saldo concorrente A G' });
  const b = await create(request, { payee: 'Saldo concorrente B G' });
  const initial = (await (await request.get('/api/accounts')).json()).find(
    (x: { id: string }) => x.id === 'seed-f-account',
  ).balance_cents;
  await page.goto('/transacoes/2026-11?account=seed-f-account');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await expect(page.locator(`tr[data-transaction-id="${a}"]`)).toBeVisible();
  let count = 0;
  await page.route('**/api/accounts', async (route) => {
    const first = ++count === 1;
    const response = await route.fetch();
    if (first) await gate;
    await route.fulfill({ response });
  });
  const rowA = page.locator(`tr[data-transaction-id="${a}"]`),
    rowB = page.locator(`tr[data-transaction-id="${b}"]`);
  await rowA.locator('[data-sheet-cell="3"]').click();
  await rowA.getByLabel('Valor (BRL)', { exact: true }).fill('20,00');
  await rowA.getByLabel('Valor (BRL)', { exact: true }).press('Tab');
  await expect.poll(() => count).toBe(1);
  await rowB.locator('[data-sheet-cell="3"]').click();
  await rowB.getByLabel('Valor (BRL)', { exact: true }).fill('30,00');
  await rowB.getByLabel('Valor (BRL)', { exact: true }).press('Tab');
  await expect(rowB).toContainText('30,00');
  release();
  await expect(rowA).toContainText('20,00');
  await expect(rowA.locator('[data-sheet-cell="3"]')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.getByRole('link', { name: 'Contas', exact: true }).click();
  const expected = Math.abs(initial - (2000 - 1234) - (3000 - 1234));
  await expect(
    page.getByRole('row').filter({ hasText: 'Conta de divisão fictícia' }),
  ).toContainText(
    (expected / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  );
});

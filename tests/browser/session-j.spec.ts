import { test, expect, type APIRequestContext } from '@playwright/test';
async function newCard(
  request: APIRequestContext,
  limit: number | null = 100000,
) {
  const r = await request.post('/api/accounts', {
    data: {
      name: 'Cartão de navegador fictício J ' + crypto.randomUUID(),
      kind: 'credit_card',
      currency: 'BRL',
      institution_id: 'horizonte',
      closing_day: 20,
      due_day: 27,
      credit_limit_cents: limit,
    },
  });
  expect(r.status()).toBe(201);
  return (await r.json()).id as string;
}
async function buy(request: APIRequestContext, card: string, name: string) {
  const r = await request.post('/api/transactions', {
    data: {
      account_id: card,
      date: '2026-11-19',
      payee: name,
      amount_cents: 12000,
      installment_count: 3,
      category_id: 'groceries',
    },
  });
  expect(r.status()).toBe(201);
  return await r.json();
}
test('transferência guarda nota e tags, mostra destino no beneficiário e usa a perspectiva filtrada', async ({
  page,
  request,
}) => {
  await page.goto('/transacoes/2026-11');
  await page
    .getByLabel('Escolher conta para adicionar')
    .selectOption('transfer');
  const row = page.locator('[data-new-transfer]');
  await row.getByLabel('Conta de origem').selectOption('seed-f-account');
  await row.getByLabel('Conta de destino').selectOption('seed-j-investment');
  await row.getByLabel('Data da transferência').fill('2026-11-19');
  await row.getByLabel('Valor da transferência (BRL)').fill('12,34');
  await row
    .getByLabel('Nota da transferência')
    .fill('Aporte de navegador fictício J');
  await row.getByText('Tags', { exact: true }).click();
  await row.getByLabel('Planejado').check();
  await row.getByRole('button', { name: 'Salvar transferência' }).click();
  await expect(row.getByRole('status')).toHaveText('Transferência salva.');
  const data = await (
    await request.get(
      '/api/transactions?month=2026-11&search=Aporte%20de%20navegador',
    )
  ).json();
  const t = data.items[0];
  expect(t.category_id).toBe('transfer');
  expect(t.tags[0].id).toBe('planned');
  const saved = page.locator(`[data-transaction-id="${t.id}"]`);
  await expect(saved.locator('[data-sheet-cell="1"]')).toHaveText(
    'Conta de divisão fictícia',
  );
  await expect(saved.locator('[data-sheet-cell="2"]')).toHaveText(
    '→ Investimento fictício J',
  );
  await expect(saved.locator('[data-sheet-cell="6"]')).toHaveText(
    'Aporte de navegador fictício J',
  );
  await saved.locator('[data-sheet-cell="4"]').click();
  await saved
    .getByRole('combobox', { name: 'Categoria de Transferência', exact: true })
    .selectOption('groceries');
  await expect(saved.locator('[data-sheet-cell="4"]')).toHaveText('Mercado');
  await page.getByRole('button', { name: /Filtros/ }).click();
  await page
    .getByRole('region', { name: 'Filtros de transações' })
    .getByRole('combobox', { name: 'Conta', exact: true })
    .selectOption('seed-j-investment');
  await expect(saved.locator('[data-sheet-cell="3"]')).toContainText('+');
});
test('linha de cartão mostra 1x, gera retroativas pela prévia e mantém o tamanho da célula', async ({
  page,
  request,
}) => {
  const card = await newCard(request);
  await page.goto('/transacoes/2026-11');
  await page.getByLabel('Escolher conta para adicionar').selectOption(card);
  const row = page.locator('[data-new-transaction]');
  await row.getByLabel('Data', { exact: true }).fill('2026-11-19');
  await row
    .getByLabel('Beneficiário', { exact: true })
    .fill('Compra retroativa de navegador J');
  await row.getByLabel('Valor (BRL)', { exact: true }).fill('30,00');
  const cell = row.locator('td').nth(10);
  await cell.scrollIntoViewIfNeeded();
  const rest = (await cell.boundingBox())!;
  await row.getByLabel('Parcelas do novo lançamento').click();
  await expect(row.getByLabel('Parcelas do novo lançamento')).toHaveText('1x');
  await row.getByLabel('Total de parcelas', { exact: true }).fill('5');
  await row.getByLabel('Parcela atual', { exact: true }).fill('3');
  await expect(row.locator('[aria-label="Prévia das parcelas"]')).toContainText(
    'Retroativa',
  );
  await expect(row.locator('[aria-label="Prévia das parcelas"]')).toContainText(
    'Antes do corte',
  );
  await expect(
    row.locator('[aria-label="Prévia das parcelas"] tbody tr'),
  ).toHaveCount(5);
  const editing = (await cell.boundingBox())!;
  expect(editing.width).toBe(rest.width);
  expect(editing.height).toBe(rest.height);
  await row
    .getByRole('button', { name: 'Salvar lançamento', exact: true })
    .click();
  await expect(row.getByRole('status')).toHaveText('Lançamento salvo.');
  const tx = await (
    await request.get(
      '/api/transactions?month=2026-11&search=Compra%20retroativa%20de%20navegador%20J',
    )
  ).json();
  expect(tx.items[0]).toMatchObject({
    installment_number: 3,
    installment_count: 5,
    amount_cents: 3000,
  });
});
test('editar parcela oferece os dois alcances; menu move de fatura e cancela futuras', async ({
  page,
  request,
}) => {
  const card = await newCard(request),
    purchase = await buy(request, card, 'Parcela de navegador J');
  await page.goto('/transacoes/2026-11');
  const row = page.locator(`[data-transaction-id="${purchase.id}"]`);
  await row.locator('[data-sheet-cell="3"]').click();
  await row.getByLabel('Valor (BRL)', { exact: true }).fill('45,00');
  await page.keyboard.press('Tab');
  const dialog = page.getByRole('dialog', { name: 'Editar parcela' });
  await expect(
    dialog.getByRole('button', { name: 'Só esta', exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Esta e as futuras' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row.locator('[data-sheet-cell="3"]')).toContainText('45,00');
  let plan = await (
    await request.get(`/api/installment-plans/${purchase.installment_plan_id}`)
  ).json();
  expect(plan.installments.map((t: any) => t.amount_cents)).toEqual([
    4500, 4500, 4500,
  ]);
  await row.locator('[data-sheet-cell="3"]').click();
  await row.getByLabel('Valor (BRL)', { exact: true }).fill('46,00');
  await page.keyboard.press('Tab');
  await page
    .getByRole('dialog', { name: 'Editar parcela' })
    .getByRole('button', { name: 'Só esta', exact: true })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(row.locator('[data-sheet-cell="3"]')).toContainText('46,00');
  const one = await (
    await request.get(`/api/installment-plans/${purchase.installment_plan_id}`)
  ).json();
  expect(one.installments.map((t: any) => t.amount_cents)).toEqual([
    4600, 4500, 4500,
  ]);
  await row.getByLabel('Ações de Parcela de navegador J').click();
  await expect(
    row.getByRole('button', { name: 'Dividir transação' }),
  ).toBeVisible();
  await expect(
    row.getByRole('link', { name: 'Antecipar parcelas' }),
  ).toBeVisible();
  await expect(
    row.getByRole('button', { name: 'Criar recorrente', exact: true }),
  ).toBeVisible();
  await row
    .getByRole('button', { name: 'Criar recorrente', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Criar recorrente' })
    .getByRole('button', { name: 'Salvar recorrente' })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await row.locator('td:last-child > details.row-menu > summary').click();
  await row
    .getByRole('button', { name: 'Mover de fatura', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Fatura de destino')
    .selectOption('next');
  await page.getByRole('button', { name: 'Mover compra', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const tx = await (
    await request.get(`/api/transactions?month=2026-11&account=${card}`)
  ).json();
  expect(tx.items.find((t: any) => t.id === purchase.id).statement_id).not.toBe(
    plan.installments[0].statement_id,
  );
  await row.locator('td:last-child > details.row-menu > summary').click();
  await row.getByRole('button', { name: 'Cancelar parcelas futuras' }).click();
  await page
    .getByLabel('Motivo do cancelamento')
    .fill('Devolução fictícia do navegador');
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  plan = await (
    await request.get(`/api/installment-plans/${purchase.installment_plan_id}`)
  ).json();
  expect(plan.installments.filter((t: any) => t.cancelled_reason)).toHaveLength(
    2,
  );
});
test('fechamento antecipado pela tabela pede conferência, reabre com motivo e exibe histórico', async ({
  page,
  request,
}) => {
  const card = await newCard(request),
    purchase = await buy(request, card, 'Fatura pela tabela J');
  await page.goto('/transacoes/2026-11');
  const row = page.locator(`[data-transaction-id="${purchase.id}"]`);
  await row.getByLabel('Ações de Fatura pela tabela J').click();
  await row
    .getByRole('button', { name: 'Antecipar fechamento', exact: true })
    .click();
  await page.getByLabel('Data de fechamento antecipado').fill('2026-11-19');
  await page
    .getByRole('button', { name: 'Antecipar e conferir depois' })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Conferir fatura' }),
  ).toBeVisible();
  await page.getByLabel('Valor do banco (BRL)', { exact: true }).fill('40,00');
  await page.getByRole('button', { name: 'Comparar valores' }).click();
  await page
    .getByRole('button', { name: 'Fechar fatura', exact: true })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await row.locator('td:last-child > details.row-menu > summary').click();
  await row
    .getByRole('button', { name: 'Reabrir fatura', exact: true })
    .click();
  await page
    .getByLabel('Motivo da reabertura')
    .fill('Revisar a fatura fictícia pelo navegador');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Reabrir fatura', exact: true })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const bills = await (
      await request.get(`/api/cards/${card}/statements`)
    ).json(),
    first = bills.find((s: any) => s.closing_date === '2026-11-19');
  expect(first.status).toBe('open');
  expect(bills.find((s: any) => s.closing_date === '2026-12-20').due_date).toBe(
    '2026-12-27',
  );
  await page.goto(`/cartao?account=${card}&statement=${first.id}`);
  await expect(
    page.getByRole('table', { name: 'Histórico da fatura', exact: true }),
  ).toContainText('Revisar a fatura fictícia pelo navegador');
  await expect(
    page.getByRole('table', { name: 'Histórico da fatura', exact: true }),
  ).toContainText('Fechamento antecipado');
});
test('pagamento parcial pela tabela vira saldo anterior; limite e Próximos funcionam', async ({
  page,
  request,
}) => {
  const card = await newCard(request),
    purchase = await buy(request, card, 'Pagamento parcial navegador J');
  const plan = await (
    await request.get(`/api/installment-plans/${purchase.installment_plan_id}`)
  ).json();
  const statement = plan.installments[0].statement_id;
  expect(
    (
      await request.post(`/api/statements/${statement}/check`, {
        data: {
          bank_amount_cents: 4000,
          expected_total_cents: 4000,
          action: 'close',
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto('/transacoes/2026-11');
  await page
    .getByLabel('Escolher conta para adicionar')
    .selectOption('transfer');
  const row = page.locator('[data-new-transfer]');
  await row.getByLabel('Conta de origem').selectOption('seed-f-account');
  await row.getByLabel('Conta de destino').selectOption(card);
  await row.getByLabel('Valor da transferência (BRL)').fill('10,00');
  await row.getByLabel('Nota da transferência').fill('Parcial com nota J');
  await row.getByRole('button', { name: 'Salvar transferência' }).click();
  await expect(row.getByRole('status')).toHaveText('Pagamento registrado.');
  await page.goto(
    `/cartao?account=${card}&statement=${plan.installments[1].statement_id}`,
  );
  await expect(
    page.getByText('Saldo anterior: R$ 30,00', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Limite do cartão')).toContainText(
    'Comprometido: R$ 110,00',
  );
  await page.getByText('Configurar limite', { exact: true }).click();
  await page.getByLabel('Limite opcional (BRL)').fill('');
  await page.getByRole('button', { name: 'Salvar limite' }).click();
  await expect(page.getByRole('status').last()).toHaveText('Limite salvo.');
  await expect(page.getByLabel('Limite do cartão')).not.toContainText(
    'Disponível:',
  );
  await page.goto('/proximos');
  await expect(
    page.getByRole('heading', { name: 'Próximos', exact: true }),
  ).toBeVisible();
  const data = await (await request.get('/api/upcoming')).json();
  const invoice = data.items.find(
    (i: any) => i.account_id === card && i.date === '2026-12-27',
  );
  expect(invoice.amount_cents).toBe(7000);
  expect(invoice.components.some((p: any) => p.type === 'balance')).toBe(true);
});

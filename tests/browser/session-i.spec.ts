import { test, expect } from '@playwright/test';

test('células mantêm dimensões em repouso, hover e edição; campos novos ocupam as colunas', async ({
  page,
  request,
}) => {
  const r = await request.post('/api/transactions', {
    data: {
      account_id: 'seed-f-account',
      date: '2026-11-19',
      payee: 'Dimensões fictícias I',
      amount_cents: 12345,
      category_id: 'groceries',
    },
  });
  expect(r.status()).toBe(201);
  const { id } = await r.json();
  await page.goto('/transacoes/2026-11');
  const row = page.locator(`tr[data-transaction-id="${id}"]`);
  await expect(row).toBeVisible();
  for (let column = 0; column <= 8; column++) {
    const cell = row.locator(`[data-sheet-cell="${column}"]`);
    await cell.scrollIntoViewIfNeeded();
    const rest = (await cell.boundingBox())!;
    await cell.hover();
    const hover = (await cell.boundingBox())!;
    expect(hover.width).toBe(rest.width);
    expect(hover.height).toBe(rest.height);
    await cell.click();
    const editing = (await cell.boundingBox())!;
    expect(editing.width).toBe(rest.width);
    expect(editing.height).toBe(rest.height);
    if (column < 8) {
      const editor = (await cell.locator('.cell-editor').boundingBox())!;
      expect(Math.abs(editor.x - rest.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(editor.y - rest.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(editor.width - rest.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(editor.height - rest.height)).toBeLessThanOrEqual(1);
      if (column === 3) {
        await expect(
          cell.getByRole('button', { name: 'Inverter sinal' }),
        ).toBeVisible();
        await expect(cell.locator('.signed-value')).toContainText('BRL');
      }
    }
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: /Adicionar em/ }).click();
  const fresh = page.locator('[data-new-transaction]');
  for (let column = 1; column < 11; column++) {
    const td = fresh.locator('td').nth(column),
      existing = row.locator('td').nth(column);
    await td.scrollIntoViewIfNeeded();
    const a = (await td.boundingBox())!,
      b = (await existing.boundingBox())!;
    await td.hover();
    const hover = (await td.boundingBox())!;
    expect(hover.width).toBe(a.width);
    expect(hover.height).toBe(a.height);
    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
    const control = td.locator(
      ':scope > input,:scope > select,:scope > .signed-value',
    );
    if (await control.count()) {
      const bounds = (await control.boundingBox())!;
      expect(Math.abs(bounds.width - a.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(bounds.height - a.height)).toBeLessThanOrEqual(1);
    }
  }
});

test('nova transferência nasce na seta e salva uma linha neutra com origem e destino', async ({
  page,
  request,
}) => {
  await page.goto('/transacoes/2026-11');
  const menu = page.getByLabel('Escolher conta para adicionar');
  expect(await menu.locator('option').first().textContent()).toBe(
    'Nova transferência',
  );
  await menu.selectOption('transfer');
  const row = page.locator('[data-new-transfer]');
  await row.getByLabel('Conta de origem').selectOption('seed-f-account');
  await row.getByLabel('Conta de destino').selectOption('seed-h-destination');
  await row.getByLabel('Data da transferência').fill('2026-11-19');
  await row.getByLabel('Valor da transferência (BRL)').fill('27,89');
  await row.getByRole('button', { name: 'Salvar transferência' }).click();
  await expect(row.getByRole('status')).toHaveText('Transferência salva.');
  const data = await (
    await request.get('/api/transactions?month=2026-11&search=Transferência')
  ).json();
  const transfer = data.items.find(
    (t: any) => t.kind === 'transfer' && t.amount_cents === 2789,
  );
  expect(transfer.destination_account_id).toBe('seed-h-destination');
  const saved = page.locator(`tr[data-transaction-id="${transfer.id}"]`);
  await expect(saved.locator('[data-sheet-cell="1"]')).toHaveText(
    'Conta de divisão fictícia',
  );
  await expect(saved.locator('[data-sheet-cell="3"]')).not.toContainText('−');
  await expect(saved.locator('[data-sheet-cell="3"]')).not.toContainText('+');
});

test('transferência para cartão sugere a fatura mais antiga e registra pagamento parcial pela tabela', async ({
  page,
  request,
}) => {
  // Um cartão isolado mantém o fluxo independente dos exemplos históricos.
  const created = await request.post('/api/accounts', {
    data: {
      name: 'Cartão isolado I',
      kind: 'credit_card',
      currency: 'BRL',
      institution_id: 'horizonte',
      closing_day: 20,
      due_day: 27,
    },
  });
  const cardId = (await created.json()).id;
  await request.post('/api/transactions', {
    data: {
      account_id: cardId,
      date: '2026-11-19',
      payee: 'Compra isolada I',
      amount_cents: 10000,
    },
  });
  const invoice = (
    await (await request.get(`/api/cards/${cardId}/statements`)).json()
  ).find((s: any) => s.total_cents === 10000);
  await request.post(`/api/statements/${invoice.id}/check`, {
    data: {
      action: 'close',
      bank_amount_cents: 10000,
      expected_total_cents: 10000,
    },
  });
  const before = await (await request.get('/api/accounts')).json();
  await page.goto('/transacoes/2026-11');
  await page
    .getByLabel('Escolher conta para adicionar')
    .selectOption('transfer');
  const row = page.locator('[data-new-transfer]');
  await row.getByLabel('Conta de origem').selectOption('seed-f-account');
  await row.getByLabel('Conta de destino').selectOption(cardId);
  await expect(row.getByLabel('Fatura a pagar')).toHaveValue(invoice.id);
  await row.getByLabel('Data da transferência').fill('2026-11-19');
  await row.getByLabel('Valor da transferência (BRL)').fill('10,00');
  await row.getByRole('button', { name: 'Salvar transferência' }).click();
  await expect(row.getByRole('status')).toHaveText('Pagamento registrado.');
  const cards = await (
    await request.get(`/api/cards/${cardId}/statements`)
  ).json();
  const bill = cards.find((s: any) => s.id === invoice.id);
  expect(bill.status).toBe('closed');
  expect(bill.paid_cents).toBe(1000);
  expect(bill.carried_out_cents).toBe(9000);
  const after = await (await request.get('/api/accounts')).json();
  expect(
    after.find((a: any) => a.id === cardId).balance_cents -
      before.find((a: any) => a.id === cardId).balance_cents,
  ).toBe(1000);
  expect(
    after.find((a: any) => a.id === 'seed-f-account').balance_cents -
      before.find((a: any) => a.id === 'seed-f-account').balance_cents,
  ).toBe(-1000);
  const payments = await (
    await request.get(`/api/transactions?month=2026-11&account=${cardId}`)
  ).json();
  expect(
    payments.items.some(
      (t: any) => t.kind === 'card_payment' && t.amount_cents === 1000,
    ),
  ).toBe(true);
});

test('moedas em uso filtram seletores e moeda principal vira padrão de conta nova', async ({
  page,
  request,
}) => {
  const original = await (await request.get('/api/preferences')).json();
  try {
    await page.goto('/configuracoes');
    await page.getByLabel('Adicionar moeda').selectOption('EUR');
    await page
      .getByLabel('Moeda principal', { exact: true })
      .selectOption('EUR');
    await page.getByRole('button', { name: 'Salvar configurações' }).click();
    await expect(page.getByRole('status').last()).toHaveText(
      'Configurações salvas.',
    );
    await page.getByRole('link', { name: 'Contas', exact: true }).click();
    await page.getByText('Nova conta', { exact: true }).click();
    const currency = page.getByLabel('Moeda', { exact: true }).last();
    await expect(currency).toHaveValue('EUR');
    await expect(currency.locator('option')).toHaveCount(
      original.currencies_in_use.length + 1,
    );
    await expect(currency.locator('option[value="JPY"]')).toHaveCount(0);
  } finally {
    expect(
      (await request.patch('/api/preferences', { data: original })).ok(),
    ).toBe(true);
  }
});

test('recorrente mostra janela de sete dias atravessando o mês', async ({
  page,
  request,
}) => {
  expect(
    (
      await request.post('/api/recurring', {
        data: {
          account_id: 'seed-f-account',
          payee: 'Janela visível I',
          amount_cents: 1000,
          cadence: 'monthly',
          next_date: '2026-12-05',
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto('/recorrentes');
  await page.getByLabel('Ir para o mês').fill('2026-12');
  await expect(
    page.getByRole('row').filter({ hasText: 'Janela visível I' }),
  ).toContainText('reconhece de 28/11 a 12/12');
});

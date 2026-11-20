import { test, expect, type APIRequestContext } from '@playwright/test';

const clock = { 'x-bfo-data': '2026-11-15' };
test.use({ extraHTTPHeaders: clock });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-15T15:00:00.000Z'));
});
async function setup(request: APIRequestContext, payee: string) {
  const account = await request.post('/api/accounts', {
    headers: clock,
    data: {
      name: 'Conta de ' + payee,
      kind: 'checking',
      currency: 'BRL',
      institution_id: 'horizonte',
      opening_balance_cents: 10000,
    },
  });
  expect(account.status()).toBe(201);
  const accountId = (await account.json()).id;
  const transaction = await request.post('/api/transactions', {
    headers: clock,
    data: {
      date: '2026-11-15',
      account_id: accountId,
      payee,
      amount_cents: 1200,
      note: 'Nota anterior',
    },
  });
  expect(transaction.status()).toBe(201);
  return { accountId, id: (await transaction.json()).id };
}
test('abre histórico no menu e recupera uma nota', async ({
  page,
  request,
}) => {
  const payee = 'Histórico navegador S';
  const { accountId, id } = await setup(request, payee);
  await page.goto('/transacoes/2026-11?account=' + accountId);
  const row = page.locator(`tr[data-transaction-id="${id}"]`);
  await row.getByRole('cell', { name: 'Nota de ' + payee }).click();
  const editor = row.getByRole('textbox', { name: 'Nota de ' + payee });
  await editor.fill('Nota atual');
  await editor.press('Enter');
  await expect(row).toContainText('Nota atual');
  await row.getByLabel('Ações de ' + payee).click();
  await page.getByRole('button', { name: 'Histórico de alterações' }).click();
  const dialog = page.getByRole('dialog', { name: 'Histórico de alterações' });
  await expect(dialog).toContainText('Nota anterior → Nota atual');
  await dialog.getByRole('button', { name: 'Voltar nota' }).click();
  await expect(dialog).toContainText('Nota atual → Nota anterior');
});

test('desfaz e refaz o valor na planilha e limpa a pilha ao recarregar', async ({
  page,
  request,
}) => {
  const payee = 'Teclado navegador S';
  const { id, accountId } = await setup(request, payee);
  await page.goto('/transacoes/2026-11?account=' + accountId);
  const row = page.locator(`tr[data-transaction-id="${id}"]`);
  const cell = row.getByRole('cell', { name: 'Valor de ' + payee });
  await cell.click();
  await cell.getByLabel('Valor (BRL)').fill('25,00');
  await cell.getByLabel('Valor (BRL)').press('Enter');
  await expect(cell).toContainText('25,00');
  await page.keyboard.press('Control+z');
  await expect(cell).toContainText('12,00');
  await page.keyboard.press('Control+Shift+Z');
  await expect(cell).toContainText('25,00');
  await page.reload();
  await cell.focus();
  await page.keyboard.press('Control+z');
  await expect(cell).toContainText('25,00');
});

test('aviso da edição mostra saldo e permite desfazer sem sair da tabela', async ({
  page,
  request,
}) => {
  const payee = 'Aviso navegador S';
  const { id, accountId } = await setup(request, payee);
  await page.goto('/transacoes/2026-11?account=' + accountId);
  const cell = page
    .locator(`tr[data-transaction-id="${id}"]`)
    .getByRole('cell', { name: 'Valor de ' + payee });
  await cell.click();
  await cell.getByLabel('Valor (BRL)').fill('25,00');
  await cell.getByLabel('Valor (BRL)').press('Enter');
  const notice = page.getByRole('status', { name: 'Aviso de transação' });
  await expect(notice).toContainText(
    'Transação editada: Aviso navegador S (valor).',
  );
  await expect(notice).toContainText('75,00');
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(notice).toContainText('Alteração desfeita.');
  await expect(notice).toContainText('88,00');
  await expect(cell).toContainText('12,00');
});

test('mostra pagamento agendado no cartão e em Próximos até a data', async ({
  page,
  request,
}) => {
  const { accountId } = await setup(request, 'Pagamento navegador S');
  const card = await request.post('/api/accounts', {
    headers: clock,
    data: {
      name: 'Cartão agendado navegador S',
      kind: 'credit_card',
      currency: 'BRL',
      institution_id: 'horizonte',
      closing_day: 20,
      due_day: 28,
    },
  });
  expect(card.status()).toBe(201);
  const cardId = (await card.json()).id;
  expect(
    (
      await request.post('/api/transactions', {
        headers: clock,
        data: {
          account_id: cardId,
          payee: 'Compra agendada navegador S',
          date: '2026-11-15',
          amount_cents: 5000,
        },
      })
    ).status(),
  ).toBe(201);
  const bills = await (
    await request.get(`/api/cards/${cardId}/statements`, { headers: clock })
  ).json();
  const bill = bills.find(
    (b: { total_cents: number }) => b.total_cents === 5000,
  );
  expect(
    (
      await request.post(`/api/statements/${bill.id}/check`, {
        headers: clock,
        data: {
          action: 'close',
          expected_total_cents: 5000,
          bank_amount_cents: 5000,
        },
      })
    ).status(),
  ).toBe(201);

  const cardPage = `/cartao?account=${cardId}&statement=${encodeURIComponent(bill.id)}`;
  await page.goto(cardPage);
  await page.getByRole('button', { name: 'Pagar fatura' }).click();
  const dialog = page.getByRole('dialog', { name: 'Pagar fatura' });
  await dialog.getByLabel('Conta corrente').selectOption(accountId);
  await dialog.getByLabel('Data do pagamento').fill('2026-11-22');
  await dialog.getByRole('button', { name: 'Registrar pagamento' }).click();
  const invoice = page.locator('#selected-statement');
  await expect(invoice).toContainText('Pagamento agendado para 22/11');
  const notice = page.getByRole('status', { name: 'Aviso de transação' });
  await expect(notice).toContainText('88,00');
  await expect(notice).toContainText('50,00');

  await page.getByRole('link', { name: 'Próximos', exact: true }).click();
  const upcomingPayment = page
    .getByRole('row')
    .filter({ hasText: 'Cartão agendado navegador S' });
  await expect(upcomingPayment).toHaveCount(1);
  await expect(upcomingPayment).toContainText('22/11/2026');
  await expect(upcomingPayment).toContainText('Pagamento agendado');

  await page.clock.setFixedTime(new Date('2026-11-22T15:00:00.000Z'));
  await page.setExtraHTTPHeaders({ 'x-bfo-data': '2026-11-22' });
  await page.reload();
  await expect(upcomingPayment).toHaveCount(0);
  await page.goto(cardPage);
  await expect(invoice.getByText('Paga', { exact: true })).toBeVisible();
  const balances = await (
    await request.get('/api/accounts', {
      headers: { 'x-bfo-data': '2026-11-22' },
    })
  ).json();
  expect(
    balances.find((a: { id: string }) => a.id === accountId).balance_cents,
  ).toBe(3800);
  expect(
    balances.find((a: { id: string }) => a.id === cardId).balance_cents,
  ).toBe(0);
});

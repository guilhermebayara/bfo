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

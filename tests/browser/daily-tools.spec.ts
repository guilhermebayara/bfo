import { readFile } from 'node:fs/promises';
import { test, expect, type APIRequestContext } from '@playwright/test';

const clock = { 'x-bfo-data': '2026-11-15' };
test.use({ extraHTTPHeaders: clock });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-15T15:00:00Z'));
});

async function createAccount(request: APIRequestContext, name: string) {
  const response = await request.post('/api/accounts', {
    headers: clock,
    data: {
      name,
      kind: 'checking',
      currency: 'BRL',
      institution_id: 'horizonte',
      opening_balance_cents: 10000,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}

async function createTransaction(
  request: APIRequestContext,
  account_id: string,
  payee: string,
  fields: object = {},
) {
  const response = await request.post('/api/transactions', {
    headers: clock,
    data: {
      account_id,
      date: '2026-11-15',
      payee,
      amount_cents: 2345,
      category_id: 'groceries',
      ...fields,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}

test('total de categoria guarda filtro no endereço, volta e abre o mesmo recorte', async ({
  page,
}) => {
  await page.goto('/transacoes/2026-11');
  const summary = page.getByRole('complementary', { name: 'Resumo do mês' });
  await summary.getByRole('link', { name: /^Mercado:/ }).click();
  await expect(page).toHaveURL(
    /\/transacoes\/2026-11\?categoria=groceries&resumo=expense&grupo=food$/,
  );
  const url = page.url();
  const row = page.locator('tr[data-transaction-id="seed-f-split"]');
  await expect(
    row.getByRole('cell', { name: 'No total de Compra mista fictícia' }),
  ).toContainText('100,00');
  await expect(
    page.getByText('Despesas · Alimentação · Mercado'),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/transacoes\/2026-11$/);
  await expect(
    page.getByRole('columnheader', { name: 'No total (R$)' }),
  ).toHaveCount(0);
  await page.goto(url);
  await expect(
    row.getByRole('cell', { name: 'No total de Compra mista fictícia' }),
  ).toContainText('100,00');
});

test('saldo de Contas, total do Cartão e item de Próximos abrem as linhas que os compõem', async ({
  page,
  request,
}) => {
  const account = 'Conta de conferência diária fictícia';
  const id = await createAccount(request, account);
  await createTransaction(request, id, 'Compra já realizada fictícia');
  const future = await createTransaction(
    request,
    id,
    'Compra futura diária fictícia',
    { date: '2026-11-18', amount_cents: 1000 },
  );

  await page.goto('/contas');
  await page
    .getByRole('link', { name: new RegExp('^Saldo de ' + account) })
    .click();
  await expect(page).toHaveURL(new RegExp(`conta=${id}&saldo=current`));
  await expect(
    page.getByRole('cell', { name: 'Saldo após Compra já realizada fictícia' }),
  ).toContainText('76,55');
  await expect(
    page.getByRole('cell', {
      name: 'Saldo após Compra futura diária fictícia',
    }),
  ).toHaveCount(0);
  await page.goto(`/transacoes/2026-11?conta=${id}`);
  await expect(
    page.getByRole('cell', {
      name: 'Saldo após Compra futura diária fictícia',
    }),
  ).toHaveText(/66,55\s*Previsto/);

  await page.goto('/cartao?account=card-b&statement=statement-brisa-2026-11');
  await page
    .locator('#selected-statement')
    .getByRole('link', { name: /^Total da fatura/ })
    .click();
  await expect(page).toHaveURL(
    /conta=card-b&fatura=statement-brisa-2026-11&totalFatura=1/,
  );
  await expect(page.getByText(/Total da fatura · R\$\s*21,90/)).toBeVisible();
  await expect(
    page.locator('tr[data-transaction-id="seed-brisa-open"]'),
  ).toBeVisible();

  await page.goto('/proximos');
  await page
    .getByRole('link', { name: /^Valor de Compra futura diária fictícia/ })
    .click();
  await expect(page).toHaveURL(new RegExp('transacao=' + future));
  await expect(
    page.getByText('Lançamento futuro. Entra no saldo da conta na data.'),
  ).toBeVisible();
  await expect(page.locator('tr[data-transaction-id]')).toHaveCount(1);
});

test('privacidade esconde valores, gráfico e aviso, e persiste nas telas e após recarregar', async ({
  page,
  request,
}) => {
  const account = 'Conta de privacidade fictícia';
  const id = await createAccount(request, account);
  const payee = 'Compra de privacidade fictícia';
  const tx = await createTransaction(request, id, payee);
  await page.goto(`/transacoes/2026-11?conta=${id}`);
  const button = page.getByRole('button', { name: 'Ocultar valores' });
  const row = page.locator(`tr[data-transaction-id="${tx}"]`);
  const amount = row.getByRole('cell', { name: `Valor de ${payee}` });
  await expect(amount).toContainText('23,45');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('progressbar').first()).toBeVisible();
  await button.click();
  await expect(amount).toHaveText('R$ ••••');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await amount.click();
  const field = amount.getByLabel('Valor (BRL)');
  await expect(field).toHaveAttribute('type', 'password');
  await field.fill('24,50');
  await field.press('Enter');
  const notice = page.getByRole('status', { name: 'Aviso de transação' });
  await expect(notice).toContainText('R$ ••••');
  await expect(notice).not.toContainText('75,50');
  await page.reload();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(amount).toHaveText('R$ ••••');
  await page.getByRole('link', { name: 'Contas', exact: true }).click();
  await expect(
    page.getByRole('link', { name: new RegExp('^Saldo de ' + account) }),
  ).toHaveText('R$ ••••');
  await page.goto('/cartao?account=card-b&statement=statement-brisa-2026-11');
  const total = page
    .locator('#selected-statement')
    .getByRole('link', { name: /^Total da fatura/ });
  await expect(total).toHaveText('R$ ••••');
  await page.keyboard.press('Control+Shift+H');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(total).toContainText('21,90');
});

test('CSV baixa o período filtrado com BOM e todos os campos no formato brasileiro', async ({
  page,
  request,
}) => {
  const account = 'Conta CSV fictícia';
  const id = await createAccount(request, account);
  await createTransaction(request, id, 'Compras; "Teste"', {
    note: 'Nota de teste',
    tag_ids: ['planned'],
  });
  await createTransaction(request, id, 'Compra em outra data fictícia', {
    date: '2026-11-16',
  });
  await page.goto(
    `/transacoes/2026-11?conta=${id}&de=2026-11-15&ate=2026-11-15`,
  );
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Baixar CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('transacoes-2026-11.csv');
  const bytes = await readFile((await download.path())!);
  expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
  expect(bytes.subarray(3).toString('utf8')).toBe(
    'Data;Conta;Beneficiário;Categoria;Grupo;Valor original;Moeda;Valor em reais;Notas;Tags;Origem;Dividida;Destino\r\n' +
      '15/11/2026;Conta CSV fictícia;"Compras; ""Teste""";Mercado;Alimentação;-23,45;BRL;-23,45;Nota de teste;Planejado;Manual;;\r\n',
  );
});

import { test, expect } from '@playwright/test';
import { ACTIVE, freezeToday } from './helpers';

test.beforeEach(async ({ page }) => {
  await freezeToday(page);
});

test('K01 K08 tela de cartão mostra ciclo, comprometido e disponível', async ({
  page,
  request,
}) => {
  // decisoes.md: fatura com ciclo; limite com comprometido e disponível
  const created = await request.post('/api/accounts', {
    data: {
      name: 'Cartão Browser K01 ' + crypto.randomUUID(),
      kind: 'credit_card',
      currency: 'BRL',
      institution_id: 'horizonte',
      closing_day: 20,
      due_day: 27,
      credit_limit_cents: 200000,
    },
  });
  expect(created.status()).toBe(201);
  const { id: card } = await created.json();
  expect(
    (
      await request.post('/api/transactions', {
        data: {
          account_id: card,
          date: '2026-11-20',
          amount_cents: 15000,
          payee: 'Compra K01',
          category_id: 'groceries',
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto(`/cartao?account=${card}`);
  await expect(page.getByText(/Compras do ciclo/i).first()).toBeVisible();
  await expect(page.getByLabel('Limite do cartão')).toContainText(/Comprometido/i);
  await expect(page.getByLabel('Limite do cartão')).toContainText(/Disponível/i);
});

test('K02 K03 pagamento parcial pela tabela vira saldo anterior', async ({
  page,
  request,
}) => {
  // decisoes.md: pagamento parcial → saldo anterior na seguinte
  const cardRes = await request.post('/api/accounts', {
    data: {
      name: 'Cartão Browser K03 ' + crypto.randomUUID(),
      kind: 'credit_card',
      currency: 'BRL',
      institution_id: 'horizonte',
      closing_day: 20,
      due_day: 27,
      credit_limit_cents: 200000,
    },
  });
  expect(cardRes.status()).toBe(201);
  const { id: card } = await cardRes.json();
  const buy = await request.post('/api/transactions', {
    data: {
      account_id: card,
      date: '2026-11-20',
      amount_cents: 10000,
      payee: 'Compra browser K03',
      category_id: 'groceries',
    },
  });
  expect(buy.status(), await buy.text()).toBe(201);
  const bills = await (await request.get(`/api/cards/${card}/statements`)).json();
  const statementId = (Array.isArray(bills) ? bills : bills.items).find(
    (s: any) => Number(s.total_cents) === 10000,
  ).id;
  expect(
    (
      await request.post(`/api/statements/${statementId}/check`, {
        data: {
          action: 'close',
          bank_amount_cents: 10000,
          expected_total_cents: 10000,
        },
      })
    ).status(),
  ).toBe(201);

  await page.goto('/transacoes/2026-11');
  await page.getByLabel('Escolher conta para adicionar').selectOption('transfer');
  const row = page.locator('[data-new-transfer]');
  await row.getByLabel('Conta de origem').selectOption(ACTIVE);
  await row.getByLabel('Conta de destino').selectOption(card);
  await row.getByLabel('Data da transferência').fill('2026-11-20');
  await row.getByLabel('Valor da transferência (BRL)').fill('40,00');
  await row.getByRole('button', { name: 'Salvar transferência' }).click();
  await expect(row.getByRole('status')).toHaveText('Pagamento registrado.');

  const statements = await (await request.get(`/api/cards/${card}/statements`)).json();
  const arr = Array.isArray(statements) ? statements : statements.items;
  const next = arr.find((s: any) => s.previous_balance_cents === 6000);
  expect(next).toBeTruthy();
  expect(next.previous_balance_cents).toBe(6000);
  await page.goto(`/cartao?account=${card}&statement=${next.id}`);
  await expect(page.getByText(/Saldo anterior/i).first()).toBeVisible();
  await expect(page.getByText(/60,00/).first()).toBeVisible();
});

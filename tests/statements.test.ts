import { beforeAll, beforeEach, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';
import { statementCycle } from '../src/server/statements';

const db = env.DB as D1Database;
function request(path: string, body?: object) {
  return app.request(
    `https://bfo.test/api${path}`,
    {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    },
    env,
  );
}
function purchase(fields: object = {}) {
  return request('/transactions', {
    account_id: 'credit',
    date: '2026-02-28',
    payee: 'Compra fictícia',
    amount_cents: 1000,
    ...fields,
  });
}
async function buy() {
  expect((await purchase()).status).toBe(201);
  return (await db
    .prepare('SELECT id FROM statements WHERE account_id=? AND closing_date=?')
    .bind('credit', '2026-02-28')
    .first<{ id: string }>())!.id;
}
const check = (id: string, fields: object = {}) =>
  request(`/statements/${id}/check`, { bank_amount_cents: 1100, ...fields });

beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
});

beforeEach(async () => {
  await db.exec(
    'DELETE FROM transactions; DELETE FROM installment_plans; DELETE FROM statements; DELETE FROM accounts;',
  );
  await db
    .prepare(
      `INSERT INTO accounts(id,name,kind,cutoff_date,closing_day,due_day)
    VALUES ('credit','Cartão de Teste','credit_card','2025-01-01',30,5),('checking','Corrente','checking','2025-01-01',NULL,NULL);`,
    )
    .run();
});

it('inclui o dia do fechamento, limita dias ao fim do mês e calcula o vencimento posterior', () => {
  expect(statementCycle('2028-02-29', 31, 5)).toMatchObject({
    periodStart: '2028-02-01',
    closingDate: '2028-02-29',
    dueDate: '2028-03-05',
  });
  expect(statementCycle('2026-12-31', 30, 31)).toMatchObject({
    periodStart: '2026-12-31',
    closingDate: '2027-01-30',
    dueDate: '2027-01-31',
  });
  expect(statementCycle('2026-01-30', 30, 31, 1)).toMatchObject({
    periodStart: '2026-01-31',
    closingDate: '2026-02-28',
    dueDate: '2026-03-31',
    date: '2026-02-28',
  });
});

it('gera uma compra, ajusta o resto na última parcela e vincula cada parcela ao seu ciclo', async () => {
  const saved = await purchase({
    installment_count: 3,
    note: 'Nota da compra',
  });
  expect(saved.status).toBe(201);
  const { installment_plan_id } = await saved.json();
  const { plan, installments } = await (
    await request(`/installment-plans/${installment_plan_id}`)
  ).json();
  expect(plan).toMatchObject({
    count: 3,
    total_cents: 1000,
    first_date: '2026-02-28',
  });
  expect(
    installments.map((part) => [
      part.installment_number,
      part.amount_cents,
      part.due_date,
    ]),
  ).toEqual([
    [1, 333, '2026-03-05'],
    [2, 333, '2026-04-05'],
    [3, 334, '2026-05-05'],
  ]);
  expect(new Set(installments.map((part) => part.statement_id)).size).toBe(3);
  for (const part of installments) {
    const detail = await (
      await request(`/statements/${part.statement_id}`)
    ).json();
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]).toMatchObject({
      id: part.id,
      installment_count: 3,
    });
  }
  expect(
    (
      await db
        .prepare(
          'SELECT spending_month FROM spending_transactions ORDER BY date',
        )
        .all()
    ).results,
  ).toEqual([
    { spending_month: '2026-03' },
    { spending_month: '2026-04' },
    { spending_month: '2026-05' },
  ]);
});

it('preserva a cotação da compra estrangeira e o total em reais ao arredondar parcelas', async () => {
  await db
    .prepare("UPDATE accounts SET currency='USD' WHERE id='credit'")
    .run();
  const saved = await purchase({
    amount_cents: 9,
    installment_count: 4,
    fx_rate: 5.49,
  });
  expect(saved.status).toBe(201);
  const { installment_plan_id } = await saved.json();
  const { plan, installments } = await (
    await request(`/installment-plans/${installment_plan_id}`)
  ).json();
  expect(plan.currency).toBe('USD');
  expect(
    installments.reduce((sum, part) => sum + part.amount_brl_cents, 0),
  ).toBe(49);
});

it('registra a busca e fecha com ajuste na categoria de sistema', async () => {
  const id = await buy();
  expect(await (await check(id)).json()).toEqual({
    bank_amount_cents: 1100,
    app_amount_cents: 1000,
    difference_cents: 100,
  });
  expect(
    (await check(id, { action: 'search', expected_total_cents: 1000 })).status,
  ).toBe(201);
  expect(
    (await check(id, { action: 'close', expected_total_cents: 999 })).status,
  ).toBe(409);
  const close = () =>
    check(id, { action: 'close', expected_total_cents: 1000 });
  expect(
    (await Promise.all([close(), close()]))
      .map((result) => result.status)
      .sort(),
  ).toEqual([201, 409]);
  const detail = await (await request(`/statements/${id}`)).json();
  expect(detail.checks.map((entry) => entry.action)).toEqual([
    'close',
    'search',
  ]);
  expect(
    detail.items.map((entry) => entry.amount_cents).sort((a, b) => a - b),
  ).toEqual([100, 1000]);
  expect(
    await db
      .prepare(
        "SELECT SUM(amount_brl_cents) AS total FROM spending_transactions WHERE category_id='statement-difference'",
      )
      .first(),
  ).toEqual({ total: 100 });
  expect((await purchase({ installment_count: 2 })).status).toBe(409);
  expect(
    await db.prepare('SELECT COUNT(*) AS count FROM installment_plans').first(),
  ).toEqual({ count: 0 });
});

it('paga em uma linha, movimenta os dois saldos e deixa pagamentos fora das somas de gasto e categoria', async () => {
  const id = await buy();
  expect(
    (
      await check(id, {
        action: 'close',
        bank_amount_cents: 1000,
        expected_total_cents: 1000,
      })
    ).status,
  ).toBe(201);
  const pay = () =>
    request(`/statements/${id}/pay`, {
      account_id: 'checking',
      date: '2026-03-05',
    });
  expect(
    (await Promise.all([pay(), pay()])).map((result) => result.status).sort(),
  ).toEqual([201, 409]);
  const rows = (await (await request('/transactions')).json()).items;
  const payments = rows.filter((row) => row.kind === 'card_payment');
  expect(payments).toHaveLength(1);
  expect(payments[0]).toMatchObject({
    payee: 'Fatura Cartão de Teste março',
    account_id: 'checking',
    category_id: null,
  });
  expect(
    await db
      .prepare(
        'SELECT SUM(amount_brl_cents) AS total FROM spending_transactions',
      )
      .first(),
  ).toEqual({ total: 1000 });
  expect(
    (await (await request('/accounts')).json()).map((a) => [
      a.id,
      a.balance_cents,
    ]),
  ).toEqual([
    ['credit', 0],
    ['checking', -1000],
  ]);
  expect(
    await db
      .prepare('SELECT status FROM statements WHERE id=?')
      .bind(id)
      .first(),
  ).toEqual({ status: 'paid' });
});

it('paga em reais uma fatura estrangeira e credita o valor original no cartão', async () => {
  await db
    .prepare("UPDATE accounts SET currency='USD' WHERE id='credit'")
    .run();
  expect((await purchase({ fx_rate: 5 })).status).toBe(201);
  const { id } = (await db
    .prepare("SELECT id FROM statements WHERE account_id='credit'")
    .first<{ id: string }>())!;
  expect(
    (
      await check(id, {
        action: 'close',
        bank_amount_cents: 1000,
        expected_total_cents: 1000,
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await request(`/statements/${id}/pay`, {
        account_id: 'checking',
        date: '2026-03-05',
        card_fx_rate: 5.25,
      })
    ).status,
  ).toBe(201);
  expect(
    (await (await request('/accounts')).json()).map((a) => [
      a.id,
      a.balance_cents,
    ]),
  ).toEqual([
    ['credit', 0],
    ['checking', -5250],
  ]);
  expect(
    await db
      .prepare(
        'SELECT SUM(amount_brl_cents) AS total FROM spending_transactions',
      )
      .first(),
  ).toEqual({ total: 5000 });
});

it('registra pagamentos parciais, rejeita excesso e quita apenas quando soma o total', async () => {
  const id = await buy();
  expect(
    (
      await check(id, {
        action: 'close',
        bank_amount_cents: 1000,
        expected_total_cents: 1000,
      })
    ).status,
  ).toBe(201);
  const pay = (amount_cents: number) =>
    request(`/statements/${id}/pay`, {
      account_id: 'checking',
      date: '2026-03-05',
      amount_cents,
    });
  expect((await pay(400)).status).toBe(201);
  expect(
    await db
      .prepare('SELECT status,bank_amount_cents FROM statements WHERE id=?')
      .bind(id)
      .first(),
  ).toEqual({ status: 'closed', bank_amount_cents: 1000 });
  expect((await pay(601)).status).toBe(400);
  expect((await pay(0)).status).toBe(400);
  expect((await pay(-1)).status).toBe(400);
  expect(
    (await (await request('/accounts')).json()).find((a) => a.id === 'credit')
      .balance_cents,
  ).toBe(-600);
  expect((await pay(600)).status).toBe(201);
  expect(
    await db
      .prepare('SELECT status FROM statements WHERE id=?')
      .bind(id)
      .first(),
  ).toEqual({ status: 'paid' });
  expect(
    (await (await request('/accounts')).json()).map((a) => a.balance_cents),
  ).toEqual([0, -1000]);
});

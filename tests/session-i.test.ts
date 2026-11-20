import { beforeAll, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';
import { seedSql } from '../scripts/seed-data.mjs';
const db = env.DB as D1Database;
const req = (path: string, method = 'GET', body?: object) =>
  app.request(
    `https://bfo.test/api${path}`,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    },
    env,
  );
beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
  await db.exec(seedSql());
});
it('transferência cria duas movimentações atômicas e lista uma linha nas duas perspectivas', async () => {
  const balances = await (await req('/accounts')).json();
  const r = await req('/transfers', 'POST', {
    account_id: 'seed-f-account',
    destination_account_id: 'seed-h-destination',
    date: '2026-11-19',
    amount_cents: 1234,
  });
  expect(r.status).toBe(201);
  const { id } = await r.json();
  const source = await (
    await req('/transactions?month=2026-11&account=seed-f-account')
  ).json();
  const dest = await (
    await req('/transactions?month=2026-11&account=seed-h-destination')
  ).json();
  expect(source.items.find((t) => t.id === id)).toMatchObject({
    amount_cents: 1234,
    destination_amount_cents: -1234,
  });
  expect(dest.items.filter((t) => t.id === id)).toHaveLength(1);
  const after = await (await req('/accounts')).json();
  for (const [account, delta] of [
    ['seed-f-account', -1234],
    ['seed-h-destination', 1234],
  ] as const)
    expect(
      after.find((a) => a.id === account).balance_cents -
        balances.find((a) => a.id === account).balance_cents,
    ).toBe(delta);
  expect(
    await db
      .prepare('SELECT COUNT(*) AS n FROM spending_transactions WHERE id=?')
      .bind(id)
      .first(),
  ).toEqual({ n: 0 });
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual(
    [],
  );
});
it('rejeita transferência para a própria conta, cartão, conta de arquivo e valor inválido sem gravar parte', async () => {
  const before = await db
    .prepare("SELECT COUNT(*) AS n FROM transactions WHERE kind='transfer'")
    .first();
  for (const extra of [
    { destination_account_id: 'seed-f-account' },
    { destination_account_id: 'seed-i-card' },
    { account_id: 'checking' },
    { amount_cents: 0 },
    { amount_cents: 1.5 },
    { date: '2026-01-01' },
  ])
    expect(
      (
        await req('/transfers', 'POST', {
          account_id: 'seed-f-account',
          destination_account_id: 'seed-h-destination',
          date: '2026-11-19',
          amount_cents: 100,
          ...extra,
        })
      ).status,
    ).toBe(400);
  expect(
    await db
      .prepare("SELECT COUNT(*) AS n FROM transactions WHERE kind='transfer'")
      .first(),
  ).toEqual(before);
});
it('pagamentos parciais concorrentes não ultrapassam saldo e continuam fora do gasto', async () => {
  const pay = () =>
    req('/statements/seed-i-statement/pay', 'POST', {
      account_id: 'seed-f-account',
      date: '2026-11-19',
      amount_cents: 4000,
    });
  expect(
    (await Promise.all([pay(), pay()])).map((r) => r.status).sort(),
  ).toEqual([201, 409]);
  const rows = await (await req('/transactions?account=seed-i-card')).json();
  expect(
    rows.items.find(
      (t) => t.kind === 'card_payment' && t.amount_cents === 4000,
    ),
  ).toMatchObject({
    destination_account_id: 'seed-i-card',
    destination_name: 'Cartão de pagamento fictício',
    destination_amount_cents: -4000,
    destination_currency: 'BRL',
  });
  expect(
    await db
      .prepare(
        "SELECT status,bank_amount_cents FROM statements WHERE id='seed-i-statement'",
      )
      .first(),
  ).toEqual({ status: 'closed', bank_amount_cents: 10000 });
});
it('preferências validam moedas e conta nova usa moeda principal', async () => {
  expect(
    (
      await req('/preferences', 'PATCH', {
        primary_currency: 'EUR',
        currencies_in_use: ['BRL', 'USD', 'EUR'],
      })
    ).status,
  ).toBe(200);
  const account = await req('/accounts', 'POST', {
    name: 'Padrão de moeda I',
    institution_id: 'horizonte',
    kind: 'checking',
  });
  expect(account.status).toBe(201);
  const { id } = await account.json();
  expect(
    await db
      .prepare('SELECT currency FROM accounts WHERE id=?')
      .bind(id)
      .first(),
  ).toEqual({ currency: 'EUR' });
  for (const body of [
    { currencies_in_use: ['USD', 'EUR'] },
    { currencies_in_use: ['BRL', 'EUR'] },
    { primary_currency: 'JPY' },
    { currencies_in_use: [] },
    { currencies_in_use: ['BRL', 'USD', 'EUR', 22] },
  ])
    expect((await req('/preferences', 'PATCH', body)).status).toBe(400);
  expect(
    (
      await req('/accounts', 'POST', {
        name: 'Moeda fora da lista I',
        institution_id: 'horizonte',
        kind: 'checking',
        currency: 'JPY',
      })
    ).status,
  ).toBe(400);
});

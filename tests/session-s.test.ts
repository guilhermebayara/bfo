import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';

const db = env.DB as D1Database;
const fixed = '2026-11-15T15:00:00.000Z';
const session = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const req = (path: string, method = 'GET', body?: object) =>
  app.request(
    `https://bfo.test/api${path}`,
    {
      method,
      headers: { 'Content-Type': 'application/json', 'X-BFO-Sessao': session },
      body: body && JSON.stringify(body),
    },
    env,
  );
beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
  await db.exec(`INSERT INTO accounts(id,name,kind,cutoff_date,opening_balance_cents) VALUES('s-a','Conta S','checking','2026-11-01',10000),('s-b','Destino S','checking','2026-11-01',0);
    INSERT INTO tags(id,name) VALUES('s-tag','Tag S');`);
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(fixed));
});
afterEach(() => vi.useRealTimers());

async function make(payee: string) {
  const response = await req('/transactions', 'POST', {
    account_id: 's-a',
    date: '2026-11-15',
    amount_cents: 1200,
    payee,
    tag_ids: ['s-tag'],
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
}
it('registra célula, divisão e exclusão com os dados completos e volta uma nota pelo histórico', async () => {
  const { id } = await make('Histórico S');
  const path = '/transactions/' + id;
  const edit = await req(path, 'PATCH', { note: 'Nota nova' });
  expect(edit.status).toBe(200);
  const editId = edit.headers.get('X-BFO-Acao');
  expect(editId).toBeTruthy();
  expect(
    (
      await req(path + '/restore-field', 'POST', {
        action_id: editId,
        field: 'note',
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req(path + '/splits', 'PUT', {
        mode: 'amount',
        expected_amount_cents: 1200,
        parts: [{ value: 1000, tag_ids: ['s-tag'] }, { value: 200 }],
      })
    ).status,
  ).toBe(200);
  expect(
    (await req('/transactions/batch', 'POST', { ids: [id], delete: true }))
      .status,
  ).toBe(200);
  const history = await (await req(path + '/history')).json<any[]>();
  expect(history.map((x) => x.source)).toEqual([
    'lote',
    'divisão',
    'histórico',
    'célula',
    'lançamento',
  ]);
  expect(history[0].changes[0]).toMatchObject({
    after: null,
    before: {
      tag_ids: ['s-tag'],
      splits: [
        { amount_cents: 1000, tag_ids: ['s-tag'] },
        { amount_cents: 200 },
      ],
      note: '',
    },
  });
  expect(history[3]).toMatchObject({
    created_at: fixed,
    changes: [{ before: { note: '' }, after: { note: 'Nota nova' } }],
  });
});
it('agrupa as duas pontas da transferência', async () => {
  const response = await req('/transfers', 'POST', {
    account_id: 's-a',
    destination_account_id: 's-b',
    date: '2026-11-15',
    amount_cents: 900,
  });
  expect(response.status).toBe(201);
  const action = response.headers.get('X-BFO-Acao');
  const first = await db
    .prepare('SELECT transaction_id FROM transaction_changes WHERE action_id=?')
    .bind(action)
    .first<string>('transaction_id');
  const history = await (
    await req('/transactions/' + first + '/history')
  ).json<any[]>();
  expect(history).toHaveLength(1);
  expect(
    history[0].changes.map((x) => x.after.amount_cents).sort((x, y) => x - y),
  ).toEqual([-900, 900]);
});
async function balance(id = 's-a') {
  const accounts = await (
    await req('/accounts')
  ).json<{ id: string; balance_cents: number }[]>();
  return accounts.find((a) => a.id === id)!.balance_cents;
}
const reverse = (response: Response, direction = 'undo') =>
  req(
    '/transaction-actions/' +
      response.headers.get('X-BFO-Acao') +
      '/' +
      direction,
    'POST',
    {},
  );

it('desfaz edição e exclusão, refaz a edição e recupera tags e divisão', async () => {
  const opening = await balance();
  const { id } = await make('Desfazer S');
  const path = '/transactions/' + id;
  expect(await balance()).toBe(opening - 1200);
  const edit = await req(path, 'PATCH', { amount_cents: 2500 });
  expect(await balance()).toBe(opening - 2500);
  const undone = await reverse(edit);
  expect(await undone.json()).toEqual({ ok: true });
  expect(await balance()).toBe(opening - 1200);
  const redone = await reverse(undone, 'redo');
  expect(redone.status).toBe(200);
  expect(await balance()).toBe(opening - 2500);
  expect((await reverse(undone, 'redo')).status).toBe(409);

  expect(
    (
      await req(path + '/splits', 'PUT', {
        mode: 'amount',
        expected_amount_cents: 2500,
        parts: [{ value: 1000, tag_ids: ['s-tag'] }, { value: 1500 }],
      })
    ).status,
  ).toBe(200);
  const deletion = await req('/transactions/batch', 'POST', {
    ids: [id],
    delete: true,
  });
  expect(await balance()).toBe(opening);
  expect((await reverse(deletion)).status).toBe(200);
  expect(await balance()).toBe(opening - 2500);
  const history = await (await req(path + '/history')).json<any[]>();
  expect(history[0]).toMatchObject({
    source: 'desfazer',
    changes: [
      {
        before: null,
        after: {
          tag_ids: ['s-tag'],
          splits: [
            { amount_cents: 1000, tag_ids: ['s-tag'] },
            { amount_cents: 1500 },
          ],
        },
      },
    ],
  });
});

it('preserva a trava de fatura fechada e permite desfazer classificação importada', async () => {
  await db.batch([
    db.prepare(
      "INSERT INTO accounts(id,name,kind,cutoff_date,closing_day,due_day) VALUES('s-card','Cartão S','credit_card','2026-11-01',20,28)",
    ),
    db.prepare(
      "INSERT INTO transactions(id,account_id,date,payee,amount_cents,amount_brl_cents,origin,kind) VALUES('s-import','s-a','2026-11-10','Importada S',500,500,'imported','regular')",
    ),
  ]);
  const tx = await req('/transactions', 'POST', {
    account_id: 's-card',
    date: '2026-11-10',
    payee: 'Compra S',
    amount_cents: 800,
  });
  expect(tx.status).toBe(201);
  const id = (await tx.json<{ id: string }>()).id;
  const st = await db
    .prepare('SELECT statement_id FROM transactions WHERE id=?')
    .bind(id)
    .first<string>('statement_id');
  await db
    .prepare("UPDATE statements SET status='closed' WHERE id=?")
    .bind(st)
    .run();
  const rejected = await reverse(tx);
  expect(rejected.status).toBe(409);
  expect(await rejected.text()).toContain('Reabra a fatura');
  expect(
    (await req('/transactions/s-import', 'PATCH', { amount_cents: 1200 }))
      .status,
  ).toBe(400);
  const classification = await req('/transactions/s-import', 'PATCH', {
    note: 'Classificação editável',
  });
  expect((await reverse(classification)).status).toBe(200);
  expect(
    await db
      .prepare("SELECT amount_cents FROM transactions WHERE id='s-import'")
      .first('amount_cents'),
  ).toBe(500);
});

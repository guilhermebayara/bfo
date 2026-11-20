import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';

const db = env.DB as D1Database;
const fixed = '2026-11-15T15:00:00.000Z';
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

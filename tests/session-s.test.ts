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

it('devolve um aviso por lote com os saldos das duas contas afetadas', async () => {
  const beginningA = await balance();
  const beginningB = await balance('s-b');
  const { id } = await make('Primeira do lote S');
  const other = await req('/transactions', 'POST', {
    account_id: 's-b',
    date: '2026-11-15',
    amount_cents: 700,
    payee: 'Segunda do lote S',
  });
  expect(other.status).toBe(201);
  const second = (await other.json<{ id: string }>()).id;
  const response = await app.request(
    'https://bfo.test/api/transactions/batch',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BFO-Avisos': '1',
        'X-BFO-Sessao': session,
      },
      body: JSON.stringify({ ids: [id, second], delete: true }),
    },
    env,
  );
  expect(await response.json()).toMatchObject({
    count: 2,
    transaction_notice: {
      id: response.headers.get('X-BFO-Acao'),
      message: '2 transações excluídas.',
      accounts: [
        { id: 's-a', balance_cents: beginningA },
        { id: 's-b', balance_cents: beginningB },
      ],
    },
  });
});

async function invoice(id: string) {
  await db
    .prepare(
      "INSERT INTO accounts(id,name,kind,cutoff_date,closing_day,due_day) VALUES(?,?,'credit_card','2026-11-01',20,28)",
    )
    .bind(id, 'Cartão ' + id)
    .run();
  const purchase = await req('/transactions', 'POST', {
    account_id: id,
    date: '2026-11-10',
    payee: 'Compra de ' + id,
    amount_cents: 5000,
  });
  expect(purchase.status).toBe(201);
  const paymentTarget = await db
    .prepare('SELECT statement_id FROM transactions WHERE id=?')
    .bind((await purchase.json<{ id: string }>()).id)
    .first<string>('statement_id');
  const closed = await req(`/statements/${paymentTarget}/check`, 'POST', {
    action: 'close',
    expected_total_cents: 5000,
    bank_amount_cents: 5000,
  });
  expect(closed.status).toBe(201);
  return paymentTarget!;
}
const statementsFor = async (card: string) =>
  (await req(`/cards/${card}/statements`)).json<
    {
      id: string;
      status: string;
      paid_cents: number;
      carried_out_cents: number;
      previous_balance_cents: number;
      scheduled_payment_date: string | null;
      remaining_cents: number;
    }[]
  >();
const upcoming = async () =>
  (
    await (
      await req('/upcoming')
    ).json<{
      items: { id: string; type: string; date: string; amount_cents: number }[];
    }>()
  ).items;

it.each([5000, 2000])(
  'aplica pagamento agendado de %i na data e mostra Próximos sem duplicar',
  async (amount) => {
    const card = 's-scheduled-' + amount;
    const source = 's-source-' + amount;
    await db
      .prepare(
        "INSERT INTO accounts(id,name,kind,cutoff_date,opening_balance_cents) VALUES(?,?,'checking','2026-11-01',10000)",
      )
      .bind(source, 'Origem ' + amount)
      .run();
    const statement = await invoice(card);
    const accountBefore = await balance(source);
    const payment = await req(`/statements/${statement}/pay`, 'POST', {
      account_id: source,
      date: '2026-11-22',
      amount_cents: amount,
    });
    expect(payment.status).toBe(201);
    const paymentId = (await payment.json<{ id: string }>()).id;
    expect(await balance(source)).toBe(accountBefore);
    expect(await balance(card)).toBe(-5000);
    const pending = await statementsFor(card);
    expect(pending.find((s) => s.id === statement)).toMatchObject({
      status: 'closed',
      paid_cents: 0,
      carried_out_cents: 0,
      scheduled_payment_date: '2026-11-22',
    });
    expect(pending.every((s) => s.previous_balance_cents === 0)).toBe(true);
    expect(
      (await upcoming()).filter((i) => [paymentId, statement].includes(i.id)),
    ).toEqual([
      expect.objectContaining({
        id: paymentId,
        date: '2026-11-22',
        type: 'payment',
        amount_cents: amount,
      }),
    ]);

    vi.setSystemTime(new Date('2026-11-22T03:00:00.000Z'));
    const [accountAfter, cardAfter] = await Promise.all([
      balance(source),
      balance(card),
    ]);
    expect(accountAfter).toBe(accountBefore - amount);
    expect(cardAfter).toBe(-5000 + amount);
    const settled = await statementsFor(card);
    expect(settled.find((s) => s.id === statement)).toMatchObject({
      status: amount === 5000 ? 'paid' : 'closed',
      paid_cents: amount,
      carried_out_cents: 5000 - amount,
      scheduled_payment_date: null,
    });
    const projected = await upcoming();
    expect(
      projected.some((i) => i.id === paymentId || i.id === statement),
    ).toBe(false);
    if (amount < 5000) {
      const next = settled.find(
        (s) => s.previous_balance_cents === 5000 - amount,
      );
      expect(projected.filter((i) => i.id === next?.id)).toEqual([
        expect.objectContaining({
          id: next?.id,
          type: 'statement',
          amount_cents: 5000 - amount,
        }),
      ]);
    }
    const undone = await reverse(payment);
    expect(await undone.json()).toEqual({ ok: true });
    expect(await balance(source)).toBe(accountBefore);
    expect(await balance(card)).toBe(-5000);
    expect(
      (await statementsFor(card)).find((s) => s.id === statement),
    ).toMatchObject({
      status: 'closed',
      paid_cents: 0,
      carried_out_cents: 0,
    });
    expect((await upcoming()).filter((i) => i.id === statement)).toEqual([
      expect.objectContaining({
        id: statement,
        type: 'statement',
        amount_cents: 5000,
      }),
    ]);
    expect((await reverse(undone, 'redo')).status).toBe(200);
    expect(await balance(card)).toBe(-5000 + amount);
    expect(
      (await statementsFor(card)).find((s) => s.id === statement),
    ).toMatchObject({
      status: amount === 5000 ? 'paid' : 'closed',
      paid_cents: amount,
      carried_out_cents: 5000 - amount,
    });
  },
);

it('quita no lançamento um pagamento com data de hoje', async () => {
  const card = 's-immediate';
  const statement = await invoice(card);
  const response = await req(`/statements/${statement}/pay`, 'POST', {
    account_id: 's-a',
    date: '2026-11-15',
    amount_cents: 5000,
  });
  expect(response.status).toBe(201);
  expect(await balance(card)).toBe(0);
  expect(
    (await statementsFor(card)).find((s) => s.id === statement),
  ).toMatchObject({
    status: 'paid',
    paid_cents: 5000,
    scheduled_payment_date: null,
  });
});

it('recalcula resumo e Próximos ao desfazer a edição de um lançamento futuro', async () => {
  const created = await req('/transactions', 'POST', {
    account_id: 's-a',
    date: '2026-11-19',
    payee: 'Boleto futuro S',
    amount_cents: 600,
    category_id: 'card-fees',
  });
  expect(created.status).toBe(201);
  const id = (await created.json<{ id: string }>()).id;
  async function check(amount: number) {
    const summary = await (
      await req('/month-summary?month=2026-11')
    ).json<
      {
        category_id: string;
        amount_cents: number;
      }[]
    >();
    expect(
      summary.find((i) => i.category_id === 'card-fees')?.amount_cents,
    ).toBe(amount);
    expect((await upcoming()).filter((i) => i.id === id)).toEqual([
      expect.objectContaining({ amount_cents: amount, date: '2026-11-19' }),
    ]);
  }
  await check(600);
  const edit = await req('/transactions/' + id, 'PATCH', { amount_cents: 900 });
  expect(edit.status).toBe(200);
  await check(900);
  expect((await reverse(edit)).status).toBe(200);
  await check(600);
});

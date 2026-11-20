import { beforeAll, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';
import { statementCycle, today } from '../src/server/statements';
import { renewalSoon } from '../src/shared/recurring';
const db = env.DB as D1Database;
const req = (path: string, method = 'GET', body?: object) =>
  app.request(
    `https://bfo.test/api${path}`,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
const buy = (fields: object = {}) =>
  req('/transactions', 'POST', {
    account_id: 'f-card',
    date: today(),
    payee: 'Compra fictícia F',
    installment_count: 5,
    installment_current: 3,
    installment_amount_cents: 10001,
    ...fields,
  });
beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
  await db.exec(
    "INSERT INTO accounts(id,name,kind,cutoff_date,closing_day,due_day) VALUES('f-card','Cartão fictício','credit_card','2026-10-01',20,27),('f-cash','Conta fictícia','checking','2025-01-01',NULL,NULL); INSERT INTO tags(id,name) VALUES('f-tag','Tag fictícia'); INSERT INTO subscription_types(id,name) VALUES('f-type','Tipo fictício');",
  );
});
it('gera todas as parcelas a partir da atual e marca as anteriores ao corte e as incluídas em fatura fechada', async () => {
  const d = today(),
    previous = statementCycle(d, 20, 27, -1);
  await db
    .prepare(
      "INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status,bank_amount_cents) VALUES('f-closed','f-card',?,?,?,'closed',0)",
    )
    .bind(previous.periodStart, previous.closingDate, previous.dueDate)
    .run();
  const response = await buy();
  expect(response.status).toBe(201);
  const { installment_plan_id } = await response.json();
  const p = await (
    await req(`/installment-plans/${installment_plan_id}`)
  ).json();
  expect(p.installments).toHaveLength(5);
  expect(p.plan.total_cents).toBe(50005);
  expect(p.installments.map((t) => t.installment_number)).toEqual([
    1, 2, 3, 4, 5,
  ]);
  expect(p.installments[2].date).toBe(d);
  expect(p.installments[0].retroactive).toBe(
    Number(p.installments[0].date <= '2026-10-01'),
  );
  const added = p.installments.find((t) => t.statement_id === 'f-closed');
  expect(added.added_to_closed).toBe(1);
  const detail = await (await req('/statements/f-closed')).json();
  expect(detail.revisions).toMatchObject([
    { previous_cents: 0, current_cents: 10001, bank_amount_cents: 0 },
  ]);
  const statements = await (await req('/cards/f-card/statements')).json();
  expect(statements.find((s) => s.id === 'f-closed').difference_cents).toBe(
    -10001,
  );
});
it('aceita parcela atual anterior ao corte, mantém o número de parcelas e ajusta centavos na última', async () => {
  const response = await buy({
    date: '2026-09-12',
    installment_current: 2,
    installment_amount_cents: undefined,
    amount_cents: 1000,
    installment_count: 3,
  });
  expect(response.status).toBe(201);
  const p = await (
    await req(
      `/installment-plans/${(await response.json()).installment_plan_id}`,
    )
  ).json();
  expect(p.installments.map((t) => t.amount_cents)).toEqual([333, 333, 334]);
  expect(p.installments.map((t) => t.retroactive)).toEqual([1, 1, 0]);
  expect((await buy({ installment_current: 6 })).status).toBe(400);
});
it('antecipa próximas parcelas numa linha, registra desconto e reduz o custo e o compromisso futuro sem duplicar', async () => {
  const saved = await buy({ installment_current: 1, installment_count: 6 });
  const { installment_plan_id: id } = await saved.json();
  const p = await (await req(`/installment-plans/${id}`)).json();
  const future = p.installments.filter(
    (t) => t.closing_date > p.current_closing_date,
  );
  const face = future.slice(0, 2).reduce((s, t) => s + t.amount_cents, 0);
  const advance = () =>
    req(`/installment-plans/${id}/advance`, 'POST', {
      count: 2,
      paid_cents: face - 1000,
      expected_face_cents: face,
    });
  const responses = await Promise.all([advance(), advance()]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  const result = await (await req(`/installment-plans/${id}`)).json();
  expect(result.real_cost_cents).toBe(result.plan.total_cents - 1000);
  expect(result.advances).toMatchObject([
    { count: 2, face_cents: face, paid_cents: face - 1000 },
  ]);
  const transactions = await db
    .prepare('SELECT * FROM active_transactions WHERE installment_plan_id=?')
    .bind(id)
    .all();
  expect(transactions.results).toHaveLength(5);
  expect(transactions.results.filter((t) => t.advance_id)).toHaveLength(1);
  const full = await db
    .prepare(
      'SELECT SUM(amount_cents) AS amount FROM spending_transactions WHERE installment_plan_id=?',
    )
    .bind(id)
    .first();
  expect(full!.amount).toBe(result.real_cost_cents);
  for (const t of future.slice(0, 2))
    expect(
      (await (await req(`/statements/${t.statement_id}`)).json()).items.some(
        (i) => i.id === t.id,
      ),
    ).toBe(false);
  expect(
    (
      await req(`/installment-plans/${id}/advance`, 'POST', {
        count: 1,
        paid_cents: 999999,
        expected_face_cents: 10001,
      })
    ).status,
  ).toBe(400);
});
it('antecipa as parcelas 5 e 6 em dezembro após fechar novembro e lançar outra compra', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T15:00:00Z'));
  try {
    const account = 'f-card-composto';
    await db
      .prepare(
        "INSERT INTO accounts(id,name,kind,cutoff_date,closing_day,due_day) VALUES(?,'Cartão fictício composto','credit_card','2026-11-01',20,27)",
      )
      .bind(account)
      .run();
    const original = await buy({
      account_id: account,
      date: '2026-11-10',
      installment_count: 10,
      installment_amount_cents: 10000,
    });
    expect(original.status).toBe(201);
    const { installment_plan_id: id } = await original.json();
    const bills = await (await req(`/cards/${account}/statements`)).json();
    const november = bills.find((bill) => bill.closing_date === '2026-11-20');
    const december = bills.find((bill) => bill.closing_date === '2026-12-20');
    expect(november.total_cents).toBe(10000);
    expect(
      (
        await req(`/statements/${november.id}/check`, 'POST', {
          action: 'close',
          bank_amount_cents: 10000,
          expected_total_cents: 10000,
        })
      ).status,
    ).toBe(201);

    const other = await buy({
      account_id: account,
      payee: 'Outra compra fictícia',
      installment_count: 6,
      installment_current: 1,
      installment_amount_cents: 10000,
    });
    expect(other.status).toBe(201);

    const advance = await req(`/installment-plans/${id}/advance`, 'POST', {
      count: 2,
      paid_cents: 18000,
      expected_face_cents: 20000,
    });
    const result = await advance.json();
    expect(advance.status, JSON.stringify(result)).toBe(201);
    expect(result.discount_cents).toBe(2000);

    const updatedBills = await (
      await req(`/cards/${account}/statements`)
    ).json();
    const bill = await (await req(`/statements/${december.id}`)).json();
    expect(updatedBills.find((row) => row.id === december.id).total_cents).toBe(
      38000,
    );
    expect(
      bill.items.filter(
        (item) =>
          item.installment_plan_id === id && item.installment_number === null,
      ),
    ).toMatchObject([{ id: result.transaction_id, amount_cents: 18000 }]);
    const plan = await (await req(`/installment-plans/${id}`)).json();
    expect(plan.current_closing_date).toBe('2026-12-20');
    expect(plan.real_cost_cents).toBe(98000);
    expect(plan.advances).toMatchObject([
      { count: 2, face_cents: 20000, paid_cents: 18000 },
    ]);
    const advanced = plan.installments.filter(
      (part) => part.installment_number && part.advance_id,
    );
    expect(advanced.map((part) => part.installment_number)).toEqual([5, 6]);
    expect(advanced.map((part) => part.closing_date)).toEqual([
      '2027-01-20',
      '2027-02-20',
    ]);
    for (const part of advanced) {
      const later = await (
        await req(`/statements/${part.statement_id}`)
      ).json();
      expect(later.items.some((item) => item.id === part.id)).toBe(false);
      expect(
        updatedBills.find((row) => row.id === part.statement_id).total_cents,
      ).toBe(10000);
    }
  } finally {
    vi.useRealTimers();
  }
});
async function regular(origin = 'manual', amount = 10001) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,origin,kind) VALUES(?,'f-cash','2026-11-12',?,?,'Compra dividida',?,'regular')",
    )
    .bind(id, amount, amount, origin)
    .run();
  return id;
}
const parts = (values: number[]) =>
  values.map((value, i) => ({
    value,
    category_id: i ? 'statement-difference' : null,
    note: `Parte ${i + 1}`,
    tag_ids: i ? ['f-tag'] : [],
  }));
it.each(['amount', 'percent'])(
  'divide por %s somente com a soma fechada e desfaz preservando o original',
  async (mode) => {
    const id = await regular();
    expect(
      (
        await req(`/transactions/${id}/splits`, 'PUT', {
          mode,
          expected_amount_cents: 10001,
          parts: parts([5000, 4999]),
        })
      ).status,
    ).toBe(400);
    expect(await (await req(`/transactions/${id}/splits`)).json()).toEqual([]);
    const values = mode === 'amount' ? [5000, 5001] : [3333, 6667];
    const response = await req(`/transactions/${id}/splits`, 'PUT', {
      mode,
      expected_amount_cents: 10001,
      parts: parts(values),
    });
    expect(response.status).toBe(200);
    const saved = await (await req(`/transactions/${id}/splits`)).json();
    expect(saved.reduce((s, p) => s + p.amount_cents, 0)).toBe(10001);
    expect(saved.map((p) => p.amount_cents)).toEqual(
      mode === 'amount' ? values : [3333, 6668],
    );
    expect(saved[1]).toMatchObject({
      note: 'Parte 2',
      category_id: 'statement-difference',
      tags: [{ id: 'f-tag' }],
    });
    expect(
      (await req(`/transactions/${id}`, 'PATCH', { amount_cents: 500 })).status,
    ).toBe(409);
    expect(
      (await db
        .prepare(
          'SELECT SUM(amount_cents) AS total FROM spending_transactions WHERE id=?',
        )
        .bind(id)
        .first())!.total,
    ).toBe(10001);
    const filtered = await (await req('/transactions?tag=f-tag')).json();
    expect(filtered.items.some((t) => t.id === id)).toBe(true);
    expect((await req(`/transactions/${id}/splits`, 'DELETE', {})).status).toBe(
      200,
    );
    expect(await (await req(`/transactions/${id}/splits`)).json()).toEqual([]);
    expect(
      await db
        .prepare(
          'SELECT amount_cents,date,category_id,note FROM transactions WHERE id=?',
        )
        .bind(id)
        .first(),
    ).toMatchObject({
      amount_cents: 10001,
      date: '2026-11-12',
      category_id: null,
      note: '',
    });
  },
);
it('divide entradas importadas sem alterar valor, data e origem, inclusive ao desfazer', async () => {
  const id = await regular('imported', -10001);
  expect(
    (
      await req(`/transactions/${id}/splits`, 'PUT', {
        mode: 'percent',
        expected_amount_cents: -10001,
        parts: parts([5000, 5000]),
        date: '2026-12-01',
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await req(`/transactions/${id}/splits`, 'PUT', {
        mode: 'percent',
        expected_amount_cents: -10001,
        parts: parts([5000, 5000]),
      })
    ).status,
  ).toBe(200);
  expect(
    (await (await req(`/transactions/${id}/splits`)).json()).map(
      (p) => p.amount_cents,
    ),
  ).toEqual([-5000, -5001]);
  expect(
    (await req(`/transactions/${id}`, 'PATCH', { date: '2026-12-01' })).status,
  ).toBe(409);
  await req(`/transactions/${id}/splits`, 'DELETE', {});
  expect(
    (await req(`/transactions/${id}`, 'PATCH', { amount_cents: 1 })).status,
  ).toBe(400);
  expect(
    await db
      .prepare('SELECT amount_cents,date,origin FROM transactions WHERE id=?')
      .bind(id)
      .first(),
  ).toEqual({ amount_cents: -10001, date: '2026-11-12', origin: 'imported' });
});
it('avisa cada assinatura pelo prazo próprio e usa 30 dias por padrão', async () => {
  expect(renewalSoon('2026-12-19', '2026-11-19')).toBe(true);
  expect(renewalSoon('2026-12-20', '2026-11-19')).toBe(false);
  expect(renewalSoon('2026-12-20', '2026-11-19', 45)).toBe(true);
  expect(renewalSoon('2026-11-19', '2026-11-19', 0)).toBe(true);
  expect(renewalSoon('2026-11-18', '2026-11-19', 45)).toBe(false);
  const create = await req('/recurring', 'POST', {
    account_id: 'f-cash',
    payee: 'Assinatura fictícia',
    amount_cents: 1000,
    cadence: 'monthly',
    next_date: today(),
    is_subscription: 1,
    subscription_type_id: 'f-type',
    renewal_date: today(),
  });
  expect(create.status).toBe(201);
  const { id } = await create.json();
  expect(
    (await (await req('/subscriptions')).json()).find((r) => r.id === id),
  ).toMatchObject({ notice_days: 30, renewal_soon: true });
  expect(
    (await req(`/recurring/${id}`, 'PATCH', { notice_days: 45 })).status,
  ).toBe(200);
  expect(
    (await (await req('/subscriptions')).json()).find((r) => r.id === id)
      .notice_days,
  ).toBe(45);
  expect(
    (await req(`/recurring/${id}`, 'PATCH', { notice_days: -1 })).status,
  ).toBe(400);
  expect(
    (await req(`/recurring/${id}`, 'PATCH', { notice_days: 0.5 })).status,
  ).toBe(400);
});

it('preserva conferência e pagamento ao incluir uma parcela numa fatura paga', async () => {
  await db.exec(
    "INSERT INTO accounts(id,name,kind,cutoff_date,closing_day,due_day) VALUES('f-paid-card','Cartão pago fictício','credit_card','2026-10-01',20,27); INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status,bank_amount_cents) VALUES('f-paid','f-paid-card','2026-07-21','2026-08-20','2026-08-27','paid',1000); INSERT INTO statement_checks(id,statement_id,app_amount_cents,bank_amount_cents,action) VALUES('f-paid-check','f-paid',1000,1000,'close'); INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,origin,kind,statement_id) VALUES('f-paid-base','f-paid-card','2026-08-10',1000,1000,'Compra paga','manual','regular',NULL),('f-paid-payment','f-cash','2026-08-27',1000,1000,'Fatura paga','manual','card_payment','f-paid');",
  );
  const response = await buy({
    account_id: 'f-paid-card',
    date: '2026-11-12',
    installment_current: 4,
    installment_count: 5,
  });
  expect(response.status).toBe(201);
  const detail = await (await req('/statements/f-paid')).json();
  expect(detail.checks).toMatchObject([
    { id: 'f-paid-check', app_amount_cents: 1000, bank_amount_cents: 1000 },
  ]);
  expect(detail.revisions).toMatchObject([
    { previous_cents: 1000, current_cents: 11001, bank_amount_cents: 1000 },
  ]);
  expect(
    await db
      .prepare(
        "SELECT status,bank_amount_cents FROM statements WHERE id='f-paid'",
      )
      .first(),
  ).toEqual({ status: 'paid', bank_amount_cents: 1000 });
  expect(
    (await db
      .prepare(
        "SELECT amount_cents FROM transactions WHERE id='f-paid-payment'",
      )
      .first())!.amount_cents,
  ).toBe(1000);
});

it('divide moeda estrangeira sem perder centavos na soma em reais', async () => {
  const id = await regular('manual', 5);
  await db
    .prepare(
      "UPDATE transactions SET currency='USD',fx_rate=0.4,amount_brl_cents=2 WHERE id=?",
    )
    .bind(id)
    .run();
  const result = await req(`/transactions/${id}/splits`, 'PUT', {
    mode: 'amount',
    expected_amount_cents: 5,
    parts: parts([1, 1, 1, 1, 1]),
  });
  expect(result.status).toBe(200);
  const saved = await (await req(`/transactions/${id}/splits`)).json();
  expect(saved.reduce((sum, p) => sum + p.amount_brl_cents, 0)).toBe(2);
  expect(saved.every((p) => p.amount_brl_cents >= 0)).toBe(true);
});

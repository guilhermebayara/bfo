import { beforeAll, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';
import { convert, convertBetween, parseMoney } from '../src/shared/money';
import { today } from '../src/shared/dates';
import { monthlyEquivalent } from '../src/shared/recurring';
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
const post = (fields: object = {}) =>
  req('/transactions', 'POST', {
    account_id: 'g-cash',
    date: '2026-11-18',
    amount_cents: 100,
    payee: 'Compra G',
    ...fields,
  });
beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
  await db.exec(
    "INSERT INTO accounts(id,name,kind,cutoff_date,closing_day,due_day) VALUES('g-cash','Conta G','checking','2026-01-01',NULL,NULL),('g-card','Cartão G','credit_card','2026-01-01',20,27); INSERT INTO accounts(id,name,kind,currency,cutoff_date) VALUES('g-usd','Exterior G','checking','USD','2026-01-01'); INSERT INTO tags(id,name) VALUES('g-tag','Classificação G');",
  );
});
it('arredonda decimais exatamente, inclusive meio centavo, entradas e notação exponencial', () => {
  expect(convert(100, 1.005)).toBe(101);
  expect(convertBetween(9, 1, 6)).toBe(2);
  expect(convertBetween(-9, 1, 6)).toBe(-2);
  expect(convert(-100, 1.005)).toBe(-101);
  expect(convert(100, 0.145)).toBe(15);
  expect(convert(1, 5e-7)).toBe(0);
  expect(convert(1, 1e10)).toBe(10000000000);
  expect(parseMoney('90071992547409,91')).toBe(Number.MAX_SAFE_INTEGER);
  expect(() => parseMoney('90071992547409,92')).toThrow();
  expect(() => convert(0.5, 1)).toThrow();
});
it('equivalente mensal mantém centavos e arredondamento simétrico de entradas', () => {
  expect(monthlyEquivalent(6, 'yearly')).toBe(1);
  expect(monthlyEquivalent(-6, 'yearly')).toBe(-1);
  expect(monthlyEquivalent(35990, 'yearly')).toBe(2999);
});
it('usa o dia de São Paulo em saldos, conferência e marco na virada UTC', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-12-01T01:30:00Z'));
  try {
    expect(today()).toBe('2026-11-30');
    await db.exec(
      "INSERT INTO accounts(id,name,kind,cutoff_date) VALUES('g-midnight','Virada G','checking','2026-11-29'); INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,origin,kind) VALUES('g-day-one','g-midnight','2026-11-30',100,100,'Hoje','manual','regular'),('g-day-two','g-midnight','2026-12-01',200,200,'Amanhã','manual','regular');",
    );
    const accounts = await (await req('/accounts')).json();
    expect(accounts.find((a) => a.id === 'g-midnight').balance_cents).toBe(
      -100,
    );
    expect(
      (
        await req('/accounts/g-midnight/reconcile', 'POST', {
          bank_balance_cents: -150,
          expected_balance_cents: -100,
          confirm: true,
        })
      ).status,
    ).toBe(201);
    expect(
      await db
        .prepare(
          "SELECT date FROM reconciliations WHERE account_id='g-midnight'",
        )
        .first(),
    ).toEqual({ date: '2026-11-30' });
    expect(
      (await (await req('/accounts')).json()).find((a) => a.id === 'g-midnight')
        .balance_cents,
    ).toBe(-150);
  } finally {
    vi.useRealTimers();
  }
});
it('preserva a origem PTAX ao editar apenas valor ou beneficiário', async () => {
  await db.exec("INSERT INTO fx_rates VALUES('USD','2026-11-18',1.005);");
  const created = await post({ account_id: 'g-usd', amount_cents: 100 });
  expect(created.status).toBe(201);
  const { id } = await created.json();
  expect(
    (
      await req(`/transactions/${id}`, 'PATCH', {
        payee: 'Nome revisado G',
        amount_cents: 200,
      })
    ).status,
  ).toBe(200);
  expect(
    await db
      .prepare(
        'SELECT fx_rate,fx_source,amount_cents,amount_brl_cents FROM transactions WHERE id=?',
      )
      .bind(id)
      .first(),
  ).toEqual({
    fx_rate: 1.005,
    fx_source: 'ptax',
    amount_cents: 200,
    amount_brl_cents: 201,
  });
});
it('recusa nulos financeiros, cotação inválida em BRL e opcionais inválidos antes de escrever', async () => {
  const { id } = await (await post()).json();
  for (const field of [
    'date',
    'account_id',
    'amount_cents',
    'payee',
    'fx_rate',
  ])
    expect(
      (await req(`/transactions/${id}`, 'PATCH', { [field]: null })).status,
    ).toBe(400);
  expect((await post({ fx_rate: -1 })).status).toBe(400);
  expect(
    (
      await req('/recurring', 'POST', {
        account_id: 'g-usd',
        payee: 'Outro cadastro G',
        amount_cents: 100,
        cadence: 'monthly',
        next_date: '2026-11-18',
        transaction_id: id,
      })
    ).status,
  ).toBe(400);

  expect(
    (
      await req('/accounts/g-cash/reconcile', 'POST', {
        bank_balance_cents: 0,
        confirm: 'sim',
      })
    ).status,
  ).toBe(400);
  for (const invalid of [
    { interval_days: 'mês' },
    { subscription_type_id: 'inexistente' },
  ])
    expect(
      (
        await req('/recurring', 'POST', {
          account_id: 'g-cash',
          payee: 'Recorrente G',
          amount_cents: 100,
          cadence: 'monthly',
          next_date: '2026-11-01',
          ...invalid,
        })
      ).status,
    ).toBe(400);
});
it('classifica importadas com tags e divisão sem liberar campos originais nem edição indireta em lote', async () => {
  await db.exec(
    "INSERT INTO payees(id,name) VALUES('g-payee','Nome importado G'),('g-target','Destino G'); INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,payee_id,origin,kind) VALUES('g-imported','g-cash','2026-05-01',100,100,'Nome importado G','g-payee','imported','regular');",
  );
  expect(
    (
      await req('/transactions/g-imported', 'PATCH', {
        tag_ids: ['g-tag'],
        note: 'Classificada',
      })
    ).status,
  ).toBe(200);
  for (const body of [
    { date: '2026-06-01' },
    { amount_cents: 101 },
    { origin: 'manual' },
    { payee: 'Novo nome' },
    { retroactive: 1 },
    { account_id: 'g-usd' },
  ])
    expect((await req('/transactions/g-imported', 'PATCH', body)).status).toBe(
      400,
    );
  expect(
    (
      await req('/payees/merge', 'POST', {
        target_id: 'g-target',
        source_ids: ['g-payee'],
      })
    ).status,
  ).toBe(409);
  for (const field of ['retroactive', 'added_to_closed'])
    await expect(
      db
        .prepare(`UPDATE transactions SET ${field}=1 WHERE id='g-imported'`)
        .run(),
    ).rejects.toThrow();
  expect(
    (
      await req('/transactions/g-imported/splits', 'PUT', {
        mode: 'amount',
        expected_amount_cents: 100,
        parts: [{ value: 40, tag_ids: ['g-tag'] }, { value: 60 }],
      })
    ).status,
  ).toBe(200);
  expect(
    (await req('/transactions/g-imported/splits', 'DELETE', {})).status,
  ).toBe(200);
  expect(
    await db
      .prepare(
        "SELECT amount_cents,date,payee,origin FROM transactions WHERE id='g-imported'",
      )
      .first(),
  ).toEqual({
    amount_cents: 100,
    date: '2026-05-01',
    payee: 'Nome importado G',
    origin: 'imported',
  });
});
it('bloqueia saída de compra antiga de fatura fechada mesmo sem statement_id', async () => {
  await db.exec(
    "INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status,bank_amount_cents) VALUES('g-legacy-st','g-card','2026-05-21','2026-06-20','2026-06-27','closed',500); INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,origin,kind) VALUES('g-legacy','g-card','2026-06-01',500,500,'Compra antiga G','manual','regular');",
  );
  expect(
    (await req('/transactions/g-legacy', 'PATCH', { date: '2026-11-18' }))
      .status,
  ).toBe(409);
  await expect(
    db
      .prepare("UPDATE transactions SET date='2026-11-18' WHERE id='g-legacy'")
      .run(),
  ).rejects.toThrow('Fatura já fechada');
  const data = await (
    await req('/transactions?month=2026-06&account=g-card')
  ).json();
  expect(data.items.find((t) => t.id === 'g-legacy').statement_status).toBe(
    'closed',
  );
});
it('abertura e conferência não inflam gastos, diferença de fatura continua contabilizada', async () => {
  await db.exec(
    "INSERT INTO accounts(id,name,kind,currency) VALUES('g-opening','Marco G','checking','USD'); INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,origin,kind) VALUES('g-archive','g-opening','2026-01-01',-100,-100,'Arquivo G','imported','regular');",
  );
  expect(
    (
      await req('/accounts/g-opening/activate', 'POST', {
        cutoff_date: '2026-01-01',
        opening_balance_cents: 0,
        fx_rate: 1.005,
      })
    ).status,
  ).toBe(201);
  const opening = await db
    .prepare(
      "SELECT id,amount_brl_cents FROM transactions WHERE activation_account_id='g-opening'",
    )
    .first();
  expect(opening.amount_brl_cents).toBe(101);
  expect(
    await db
      .prepare('SELECT id FROM spending_transactions WHERE id=?')
      .bind(opening.id)
      .first(),
  ).toBeNull();
  expect(
    (
      await req('/accounts/g-opening/reconcile', 'POST', {
        bank_balance_cents: 10,
        expected_balance_cents: 0,
        confirm: true,
        fx_rate: 1,
      })
    ).status,
  ).toBe(201);
  const reconciliation = await db
    .prepare(
      "SELECT adjustment_transaction_id AS id FROM reconciliations WHERE account_id='g-opening'",
    )
    .first();
  expect(
    await db
      .prepare('SELECT id FROM spending_transactions WHERE id=?')
      .bind(reconciliation.id)
      .first(),
  ).toBeNull();
  await db.exec(
    "INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,category_id,origin,kind,statement_id) VALUES('g-adjustment','g-card','2026-06-20',10,10,'Diferença de fatura','statement-difference','adjustment','regular','g-legacy-st');",
  );
  expect(
    await db
      .prepare(
        "SELECT amount_brl_cents FROM spending_transactions WHERE id='g-adjustment'",
      )
      .first(),
  ).toEqual({ amount_brl_cents: 10 });
});
it('não ativa marco futuro nem paga fatura antes do corte do cartão', async () => {
  await db.exec(
    "INSERT INTO accounts(id,name,kind) VALUES('g-future','Futura G','checking'); INSERT INTO accounts(id,name,kind,cutoff_date,closing_day,due_day) VALUES('g-late-card','Virada cartão G','credit_card','2026-11-10',20,27); INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status,bank_amount_cents) VALUES('g-cut-st','g-late-card','2026-10-21','2026-11-20','2026-11-27','closed',100);",
  );
  expect(
    (
      await req('/accounts/g-future/activate', 'POST', {
        cutoff_date: '9998-01-01',
        opening_balance_cents: 0,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await req('/statements/g-cut-st/pay', 'POST', {
        account_id: 'g-cash',
        date: '2026-11-09',
      })
    ).status,
  ).toBe(400);
});
it('plano de consulta encontra parcelas e históricos pelos índices', async () => {
  for (const [sql, index] of [
    [
      "SELECT * FROM transactions WHERE installment_plan_id='g-plan' ORDER BY installment_number",
      'transactions_plan_number',
    ],
    [
      "SELECT * FROM statement_checks WHERE statement_id='g-st' ORDER BY rowid DESC",
      'statement_checks_statement',
    ],
    [
      "SELECT * FROM statement_revisions WHERE statement_id='g-st'",
      'statement_revisions_statement',
    ],
    ["SELECT * FROM split_tags WHERE tag_id='g-tag'", 'split_tags_tag'],
  ]) {
    const plan = await db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
    expect(JSON.stringify(plan.results)).toContain(index);
  }
});
it('edições financeiras concorrentes não sobrescrevem valores e podem ser repetidas após conflito', async () => {
  const { id } = await (
    await post({ payee: 'Concorrência G', amount_cents: 100 })
  ).json();
  const edits = [{ amount_cents: 200 }, { payee: 'Nome concorrente G' }];
  const responses = await Promise.all(
    edits.map((body) => req(`/transactions/${id}`, 'PATCH', body)),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  const failed = responses.findIndex((r) => r.status === 409);
  expect(
    (await req(`/transactions/${id}`, 'PATCH', edits[failed])).status,
  ).toBe(200);
  expect(
    await db
      .prepare('SELECT amount_cents,payee FROM transactions WHERE id=?')
      .bind(id)
      .first(),
  ).toEqual({ amount_cents: 200, payee: 'Nome concorrente G' });
});

it('pagamento entre moedas divide as duas cotações sem arredondar a razão antes dos centavos', async () => {
  await db.exec(
    "INSERT INTO accounts(id,name,kind,currency,cutoff_date,closing_day,due_day) VALUES('g-fx-card','Cartão exterior G','credit_card','USD','2026-01-01',20,27); INSERT INTO accounts(id,name,kind,currency,cutoff_date) VALUES('g-fx-checking','Corrente exterior G','checking','EUR','2026-01-01'); INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status,bank_amount_cents) VALUES('g-fx-st','g-fx-card','2026-10-21','2026-11-20','2026-11-27','closed',9);",
  );
  const response = await req('/statements/g-fx-st/pay', 'POST', {
    account_id: 'g-fx-checking',
    date: '2026-11-18',
    card_fx_rate: 1,
    account_fx_rate: 6,
  });
  expect(response.status).toBe(201);
  const { id } = await response.json();
  expect(
    await db
      .prepare('SELECT amount_cents,currency FROM transactions WHERE id=?')
      .bind(id)
      .first(),
  ).toEqual({ amount_cents: 2, currency: 'EUR' });
});

// Limite de conversão também precisa virar erro de entrada na rota de pagamento.
it('recusa pagamento cuja conversão entre moedas excede os centavos seguros', async () => {
  await db.exec(
    "INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status,bank_amount_cents) VALUES('g-fx-limit','g-fx-card','2026-11-21','2026-12-20','2026-12-27','closed',9007199254740991);",
  );
  expect(
    (
      await req('/statements/g-fx-limit/pay', 'POST', {
        account_id: 'g-fx-checking',
        date: '2026-11-18',
        card_fx_rate: 1,
        account_fx_rate: 1e-12,
      })
    ).status,
  ).toBe(400);
});

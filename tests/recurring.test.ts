import { beforeAll, beforeEach, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';
import {
  datesInMonth,
  monthlyEquivalent,
  renewalSoon,
  nextOccurrence,
} from '../src/shared/recurring';
const db = env.DB as D1Database;
const request = (path: string, method = 'GET', body?: unknown) =>
  app.request(
    `https://bfo.test/api${path}`,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
});
beforeEach(async () => {
  await db.exec(
    'DELETE FROM recurring_sources; DELETE FROM recurring; DELETE FROM transaction_tags; DELETE FROM transactions; DELETE FROM statements; DELETE FROM accounts; DELETE FROM categories; DELETE FROM category_groups; DELETE FROM allocation_groups; DELETE FROM subscription_types; DELETE FROM payees;',
  );
  await db.exec(
    "INSERT INTO accounts(id,name,kind,cutoff_date) VALUES('a','Conta fictícia','checking','2026-01-01'); INSERT INTO subscription_types VALUES('type','Tipo fictício',0);",
  );
});
const recurring = (extra = {}) =>
  request('/recurring', 'POST', {
    account_id: 'a',
    payee: 'Serviço fictício',
    amount_cents: 12000,
    category_id: null,
    cadence: 'monthly',
    next_date: '2026-02-28',
    is_subscription: 0,
    ...extra,
  });
it('limita o mês mesmo com filtros mais amplos e rejeita mês inválido', async () => {
  for (const date of ['2026-10-31', '2026-11-01', '2026-11-30', '2026-12-01'])
    expect(
      (
        await request('/transactions', 'POST', {
          account_id: 'a',
          date,
          amount_cents: 100,
          payee: 'Teste',
        })
      ).status,
    ).toBe(201);
  const r = await (
    await request(
      '/transactions?month=2026-11&from=2026-01-01&to=2026-12-31&account=a',
    )
  ).json();
  expect(r.total).toBe(2);
  expect(
    r.items.every((t: { date: string }) => t.date.startsWith('2026-11')),
  ).toBe(true);
  expect((await request('/transactions?month=2026-13')).status).toBe(400);
});
it('calendário preserva dia 31, ano bissexto e intervalos semanais', () => {
  const r = { cadence: 'monthly', next_date: '2026-01-31' };
  expect(datesInMonth(r, '2026-02')).toEqual(['2026-02-28']);
  expect(datesInMonth(r, '2026-03')).toEqual(['2026-03-31']);
  expect(datesInMonth(r, '2025-12')).toEqual([]);
  expect(
    datesInMonth({ cadence: 'yearly', next_date: '2024-02-29' }, '2028-02'),
  ).toEqual(['2028-02-29']);
  expect(
    datesInMonth({ cadence: 'weekly', next_date: '2026-11-01' }, '2026-11'),
  ).toHaveLength(5);
  expect(
    datesInMonth(
      { cadence: 'custom', next_date: '2026-11-01', interval_days: 10 },
      '2026-11',
    ),
  ).toEqual(['2026-11-01', '2026-11-11', '2026-11-21']);
  expect(nextOccurrence(r, '2026-02-28')).toBe('2026-02-28');
  expect(nextOccurrence(r, '2026-03-01')).toBe('2026-03-31');
});
it('relaciona realizado por conta e beneficiário e mantém a previsão do mês', async () => {
  expect((await recurring()).status).toBe(201);
  let r = await (await request('/recurring?month=2026-11')).json();
  expect(r.items[0].arrived).toBe(false);
  expect(r.summary.BRL.expense).toEqual({ expected: 12000, actual: 0 });
  await request('/transactions', 'POST', {
    account_id: 'a',
    date: '2026-11-27',
    amount_cents: 13000,
    payee: 'serviço fictício',
  });
  r = await (await request('/recurring?month=2026-11')).json();
  expect(r.items[0].arrived).toBe(true);
  expect(r.summary.BRL.expense).toEqual({ expected: 12000, actual: 13000 });
  expect(
    (await (await request('/recurring?month=2026-12')).json()).items[0].arrived,
  ).toBe(false);
});
it('cada transação atende só uma ocorrência semanal e uma conta diferente não atende', async () => {
  await recurring({ cadence: 'weekly', next_date: '2026-11-01' });
  await request('/transactions', 'POST', {
    account_id: 'a',
    date: '2026-11-01',
    amount_cents: 12000,
    payee: 'Serviço fictício',
  });
  const data = await (await request('/recurring?month=2026-11')).json();
  expect(data.items).toHaveLength(5);
  expect(
    data.items.filter((r: { arrived: boolean }) => r.arrived),
  ).toHaveLength(1);
});
it('anual entra só no mês de cobrança, com equivalente mensal inteiro', async () => {
  expect(monthlyEquivalent(35990, 'yearly')).toBe(2999);
  expect(monthlyEquivalent(1990, 'monthly')).toBe(1990);
  await recurring({
    cadence: 'yearly',
    next_date: '2026-12-02',
    is_subscription: 1,
    subscription_type_id: 'type',
    renewal_date: '2026-12-02',
    amount_cents: 35990,
  });
  expect(
    (await (await request('/recurring?month=2026-11')).json()).items,
  ).toEqual([]);
  expect(
    (await (await request('/recurring?month=2026-12')).json()).summary.BRL
      .expense.expected,
  ).toBe(35990);
  expect(
    (await (await request('/subscriptions')).json())[0].monthly_cents,
  ).toBe(2999);
});
it.each([
  { ligada: true, desligada: false },
  { ligada: 1, desligada: 0 },
])(
  'aceita as marcas de recorrente com $ligada e $desligada',
  async ({ ligada, desligada }) => {
    const response = await recurring({
      is_subscription: ligada,
      active: ligada,
      subscription_type_id: 'type',
      renewal_date: '2026-12-02',
    });
    expect(response.status).toBe(201);
    const { id } = await response.json();
    expect(await (await request('/subscriptions')).json()).toMatchObject([
      { id },
    ]);

    expect(
      (
        await request(`/recurring/${id}`, 'PATCH', {
          is_subscription: desligada,
          active: desligada,
        })
      ).status,
    ).toBe(200);
    const catalog = await (
      await request('/recurring?month=2026-11&catalog=1')
    ).json();
    expect(catalog.items).toMatchObject([
      { id, is_subscription: 0, active: 0 },
    ]);
    expect(await (await request('/subscriptions')).json()).toEqual([]);

    expect(
      (await recurring({ is_subscription: desligada, active: desligada }))
        .status,
    ).toBe(201);
    expect(
      (
        await request(`/recurring/${id}`, 'PATCH', {
          is_subscription: ligada,
          active: ligada,
        })
      ).status,
    ).toBe(200);
    expect(await (await request('/subscriptions')).json()).toMatchObject([
      { id },
    ]);
  },
);
it.each([{ is_subscription: 'true' }, { active: 2 }])(
  'rejeita marca inválida no cadastro de recorrente (%j)',
  async (flags) => {
    const response = await recurring(flags);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Estado inválido.' });
  },
);
it('aviso cobre hoje e limite de 30 dias, exclui vencidas e inativas', async () => {
  expect(renewalSoon('2026-11-19', '2026-11-19')).toBe(true);
  expect(renewalSoon('2026-12-19', '2026-11-19')).toBe(true);
  expect(renewalSoon('2026-12-20', '2026-11-19')).toBe(false);
  expect(renewalSoon('2026-11-18', '2026-11-19')).toBe(false);
  expect(renewalSoon(null, '2026-11-19')).toBe(false);
  const today = new Date().toISOString().slice(0, 10);
  const { id } = await (
    await recurring({
      is_subscription: 1,
      subscription_type_id: 'type',
      renewal_date: today,
    })
  ).json();
  expect((await (await request('/subscriptions')).json())[0].renewal_soon).toBe(
    true,
  );
  await request(`/recurring/${id}`, 'PATCH', { active: 0 });
  expect(await (await request('/subscriptions')).json()).toEqual([]);
  const catalog = await (
    await request('/recurring?month=2026-11&catalog=1')
  ).json();
  expect(catalog.items[0].active).toBe(0);
  expect(
    (await request(`/recurring/${id}`, 'PATCH', { active: 1 })).status,
  ).toBe(200);
});
it('cria a partir de importada sem mudar o registro original e valida assinatura', async () => {
  await db
    .prepare(
      "INSERT INTO transactions(id,account_id,date,amount_cents,payee,origin,kind) VALUES('imported','a','2026-02-28',12000,'Serviço fictício','imported','regular')",
    )
    .run();
  expect((await recurring({ transaction_id: 'imported' })).status).toBe(201);
  expect(
    (await db
      .prepare("SELECT origin FROM transactions WHERE id='imported'")
      .first())!.origin,
  ).toBe('imported');
  expect(
    (await request('/transactions/imported', 'PATCH', { date: '2026-11-01' }))
      .status,
  ).toBe(400);
  expect((await recurring({ is_subscription: 1 })).status).toBe(400);
  expect(
    (await recurring({ cadence: 'custom', interval_days: 0 })).status,
  ).toBe(400);
});
it('edita os campos comuns, recalcula moeda e mantém a trava das importadas', async () => {
  await db
    .prepare(
      "INSERT INTO accounts(id,name,kind,currency,cutoff_date) VALUES('usd','Exterior fictícia','checking','USD','2026-01-01')",
    )
    .run();
  const { id } = await (
    await request('/transactions', 'POST', {
      account_id: 'a',
      date: '2026-11-01',
      amount_cents: 100,
      payee: 'Antes',
    })
  ).json();
  expect(
    (
      await request(`/transactions/${id}`, 'PATCH', {
        account_id: 'usd',
        date: '2026-11-02',
        payee: 'Depois',
        amount_cents: 250,
        fx_rate: 5,
        note: 'Editado',
      })
    ).status,
  ).toBe(200);
  expect(
    await db
      .prepare(
        'SELECT account_id,date,payee,amount_cents,amount_brl_cents,currency,note FROM transactions WHERE id=?',
      )
      .bind(id)
      .first(),
  ).toEqual({
    account_id: 'usd',
    date: '2026-11-02',
    payee: 'Depois',
    amount_cents: 250,
    amount_brl_cents: 1250,
    currency: 'USD',
    note: 'Editado',
  });
});

it('bloqueia edição financeira de fatura fechada e permite corrigir nota', async () => {
  await db
    .prepare(
      "INSERT INTO accounts(id,name,kind,cutoff_date,closing_day,due_day) VALUES('card','Cartão fictício','credit_card','2026-01-01',20,27)",
    )
    .run();
  const response = await request('/transactions', 'POST', {
    account_id: 'card',
    date: '2026-11-01',
    amount_cents: 1000,
    payee: 'Compra fictícia',
  });
  expect(response.status).toBe(201);
  const { id } = await response.json();
  expect(
    (
      await request(`/transactions/${id}`, 'PATCH', {
        date: '2026-12-01',
        amount_cents: 2000,
      })
    ).status,
  ).toBe(200);
  const t = await db
    .prepare('SELECT statement_id FROM transactions WHERE id=?')
    .bind(id)
    .first();
  await db
    .prepare("UPDATE statements SET status='closed' WHERE id=?")
    .bind(t!.statement_id)
    .run();
  expect(
    (await request(`/transactions/${id}`, 'PATCH', { amount_cents: 3000 }))
      .status,
  ).toBe(409);
  expect(
    (await request(`/transactions/${id}`, 'PATCH', { note: 'Conferido' }))
      .status,
  ).toBe(200);
});
it('calcula a próxima cobrança de intervalos acima de dez anos sem voltar à âncora', () => {
  const schedule = {
    cadence: 'custom',
    next_date: '2020-01-01',
    interval_days: 3660,
  };
  const next = nextOccurrence(schedule, '2020-01-02');
  expect(next > '2030-01-01').toBe(true);
  expect(nextOccurrence(schedule, next)).toBe(next);
});
it('transação de outra conta não realiza a cobrança', async () => {
  await recurring();
  await db
    .prepare(
      "INSERT INTO accounts(id,name,kind,cutoff_date) VALUES('other','Outra conta fictícia','checking','2026-01-01')",
    )
    .run();
  await request('/transactions', 'POST', {
    account_id: 'other',
    date: '2026-11-01',
    amount_cents: 12000,
    payee: 'Serviço fictício',
  });
  expect(
    (await (await request('/recurring?month=2026-11')).json()).items[0].arrived,
  ).toBe(false);
});

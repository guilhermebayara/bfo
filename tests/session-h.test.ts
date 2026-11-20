import { beforeAll, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';
import { seedSql } from '../scripts/seed-data.mjs';
import { matchRecurring } from '../src/shared/recurring';
import { today, statementCycle } from '../src/server/statements';
const db = env.DB as D1Database;
const req = (path: string, method = 'GET', body?: unknown) =>
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
  await db.exec(seedSql());
});
async function create(payee: string, extra = {}) {
  const response = await req('/transactions', 'POST', {
    account_id: 'seed-f-account',
    date: '2026-11-19',
    payee,
    amount_cents: 1000,
    ...extra,
  });
  expect(response.status).toBe(201);
  return (await response.json()).id as string;
}
it('persistência da conta padrão rejeita conta de arquivo ou encerrada', async () => {
  expect(
    (
      await req('/preferences', 'PATCH', {
        default_account_id: 'seed-f-account',
      })
    ).status,
  ).toBe(200);
  expect(await (await req('/preferences')).json()).toMatchObject({
    default_account_id: 'seed-f-account',
  });
  for (const account of ['checking', 'closed', 'ausente'])
    expect(
      (await req('/preferences', 'PATCH', { default_account_id: account }))
        .status,
    ).toBe(400);
});
it('marcas herdadas alteram resumos sem alterar saldos, incluindo partes divididas', async () => {
  const group = await (
    await req('/category-groups', 'POST', {
      name: 'Grupo H fictício',
      allocation_group_id: 'essential',
      is_income: 1,
      exclude_budget: 1,
      exclude_totals: 0,
    })
  ).json();
  const cat = await (
    await req('/categories', 'POST', {
      name: 'Categoria H fictícia',
      category_group_id: group.id,
    })
  ).json();
  const id = await create('Renda H', {
    amount_cents: -10000,
    category_id: cat.id,
  });
  const cats = await (await req('/categories')).json();
  expect(cats.find((c: { id: string }) => c.id === cat.id)).toMatchObject({
    effective_income: 1,
    effective_exclude_budget: 1,
    inherited_income: 1,
    is_income: 0,
  });
  let summary = await (await req('/month-summary?month=2026-11')).json();
  expect(
    summary.find((c: { category_id: string }) => c.category_id === cat.id),
  ).toMatchObject({ is_income: 1, exclude_budget: 1, amount_cents: 10000 });
  const before = await (await req('/accounts')).json();
  expect(
    (await req(`/category-groups/${group.id}`, 'PATCH', { exclude_totals: 1 }))
      .status,
  ).toBe(200);
  summary = await (await req('/month-summary?month=2026-11')).json();
  expect(
    summary.some((c: { category_id: string }) => c.category_id === cat.id),
  ).toBe(false);
  expect(await (await req('/accounts')).json()).toEqual(before);
  expect(
    (await req(`/transactions/${id}`, 'PATCH', { category_id: 'groceries' }))
      .status,
  ).toBe(200);
  expect((await req('/month-summary?month=inválido')).status).toBe(400);
});
it('transferência é única, conserva os dois saldos e aparece em ambos os filtros', async () => {
  for (const account of ['', 'seed-f-account', 'seed-h-destination']) {
    const page = await (
      await req(
        `/transactions?month=2026-11&search=Transferência fictícia&account=${account}`,
      )
    ).json();
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      id: 'seed-h-transfer-out',
      amount_cents: 15000,
      destination_account_id: 'seed-h-destination',
    });
  }
});
it('lote é atômico e importadas aceitam classificação sem mudar valores', async () => {
  const id = await create('Lote H');
  expect(
    (
      await req('/transactions/batch', 'POST', {
        ids: [id, 'seed-2025-09-rent'],
        changes: { date: '2026-11-20' },
      })
    ).status,
  ).toBe(400);
  expect(
    (await db
      .prepare('SELECT date FROM transactions WHERE id=?')
      .bind(id)
      .first())!.date,
  ).toBe('2026-11-19');
  expect(
    (
      await req('/transactions/batch', 'POST', {
        ids: [id, 'seed-2025-09-rent'],
        changes: { category_id: 'entertainment', note: 'Classificação H' },
        add_tag_ids: ['planned'],
      })
    ).status,
  ).toBe(200);
  expect(
    await db
      .prepare(
        "SELECT date,amount_cents,note,category_id FROM transactions WHERE id='seed-2025-09-rent'",
      )
      .first(),
  ).toEqual({
    date: '2025-09-10',
    amount_cents: 180000,
    note: 'Classificação H',
    category_id: 'entertainment',
  });
  expect(
    (
      await req('/transactions/batch', 'POST', {
        ids: [id, 'seed-2025-09-rent'],
        delete: true,
      })
    ).status,
  ).toBe(409);
  expect(
    await db.prepare('SELECT 1 FROM transactions WHERE id=?').bind(id).first(),
  ).toBeTruthy();
  expect(
    (await req('/transactions/batch', 'POST', { ids: [id], delete: true }))
      .status,
  ).toBe(200);
  expect(
    await db.prepare('SELECT 1 FROM transactions WHERE id=?').bind(id).first(),
  ).toBeNull();
});
it('edição em lote classifica partes e adiciona e remove tags sem alterar soma', async () => {
  const id = await create('Partes H', { amount_cents: 10001 });
  expect(
    (
      await req(`/transactions/${id}/splits`, 'PUT', {
        mode: 'amount',
        expected_amount_cents: 10001,
        parts: [
          { value: 3333, category_id: 'groceries', tag_ids: ['planned'] },
          { value: 6668, category_id: 'entertainment' },
        ],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req('/transactions/batch', 'POST', {
        ids: [id],
        changes: { category_id: 'restaurant' },
        add_tag_ids: ['travel'],
        remove_tag_ids: ['planned'],
      })
    ).status,
  ).toBe(200);
  const parts = await (await req(`/transactions/${id}/splits`)).json();
  expect(parts.map((p: { amount_cents: number }) => p.amount_cents)).toEqual([
    3333, 6668,
  ]);
  for (const part of parts) {
    expect(part.category_id).toBe('restaurant');
    expect(part.tags.map((t: { id: string }) => t.id)).toEqual(['travel']);
  }
});
it('moeda é editável na conta vazia e fica protegida depois de movimentar', async () => {
  const r = await req('/accounts', 'POST', {
    name: 'Vazia H',
    kind: 'checking',
    currency: 'BRL',
    institution_id: 'horizonte',
    opening_balance_cents: 0,
  });
  const { id } = await r.json();
  expect(
    (await req(`/accounts/${id}`, 'PATCH', { currency: 'USD' })).status,
  ).toBe(200);
  await create('Câmbio H', { account_id: id, date: today(), fx_rate: 5 });
  expect(
    (await req(`/accounts/${id}`, 'PATCH', { currency: 'EUR' })).status,
  ).toBe(409);
  expect(
    (await req(`/accounts/${id}`, 'PATCH', { name: 'Nome H', currency: 'USD' }))
      .status,
  ).toBe(200);
});
it('recorrente reconhece ±7 dias no mês previsto, exclui oitavo dia e não duplica meses', () => {
  const rows = [
    {
      id: 'r',
      account_id: 'a',
      payee: 'Luz',
      amount_cents: 1000,
      active: 1,
      cadence: 'monthly',
      next_date: '2026-11-30',
    },
  ];
  for (const day of ['2026-11-23', '2026-12-07']) {
    const t = [
      {
        id: 't',
        account_id: 'a',
        payee: 'Luz',
        date: day,
        amount_cents: 1900,
        source_id: null,
      },
    ];
    expect(matchRecurring(rows, t, '2026-11')[0].match?.id).toBe('t');
    expect(matchRecurring(rows, t, '2026-12')[0].match).toBeUndefined();
  }
  for (const day of ['2026-11-22', '2026-12-08'])
    expect(
      matchRecurring(
        rows,
        [
          {
            id: 't',
            account_id: 'a',
            payee: 'Luz',
            date: day,
            amount_cents: 1000,
            source_id: null,
          },
        ],
        '2026-11',
      )[0].match,
    ).toBeUndefined();
});
it('API reconhece cobrança fora do mês sem usar faixa de valor', async () => {
  const r = await req('/recurring', 'POST', {
    account_id: 'seed-f-account',
    payee: 'Janela H',
    amount_cents: 1000,
    cadence: 'monthly',
    next_date: '2026-11-30',
  });
  expect(r.status).toBe(201);
  await create('Janela H', { date: '2026-12-07', amount_cents: 5500 });
  const november = await (await req('/recurring?month=2026-11')).json();
  expect(
    november.items.find((r: { payee: string }) => r.payee === 'Janela H'),
  ).toMatchObject({
    arrived: true,
    actual_cents: 5500,
    due_date: '2026-11-30',
  });
  const december = await (await req('/recurring?month=2026-12')).json();
  expect(
    december.items.find((r: { payee: string }) => r.payee === 'Janela H')
      .arrived,
  ).toBe(false);
});
it('antecipação reparte desconto por classificação da parcela e preserva centavos e tags', async () => {
  const d = today(),
    cycle = statementCycle(d, 20, 27);
  const response = await req('/transactions', 'POST', {
    account_id: 'seed-f-card',
    date: d,
    payee: 'Antecipação H',
    amount_cents: 30003,
    installment_count: 3,
    category_id: 'groceries',
  });
  expect(response.status).toBe(201);
  const { installment_plan_id: id } = await response.json();
  const rows = await db
    .prepare(
      'SELECT t.* FROM transactions t JOIN statements s ON s.id=t.statement_id WHERE t.installment_plan_id=? AND s.closing_date>? ORDER BY installment_number',
    )
    .bind(id, cycle.closingDate)
    .all<{ id: string; amount_cents: number }>();
  expect(rows.results).toHaveLength(2);
  await req(`/transactions/${rows.results[0].id}`, 'PATCH', {
    category_id: 'entertainment',
  });
  await db
    .prepare('INSERT INTO transaction_tags VALUES(?,?)')
    .bind(rows.results[0].id, 'travel')
    .run();
  const face = rows.results.reduce((sum, r) => sum + r.amount_cents, 0);
  const advance = await req(`/installment-plans/${id}/advance`, 'POST', {
    count: 2,
    expected_face_cents: face,
    paid_cents: 19001,
  });
  expect(advance.status).toBe(201);
  const a = await advance.json();
  const parts = await (
    await req(`/transactions/${a.transaction_id}/splits`)
  ).json();
  expect(parts).toHaveLength(2);
  expect(
    parts.reduce(
      (sum: number, p: { amount_cents: number }) => sum + p.amount_cents,
      0,
    ),
  ).toBe(19001);
  expect(
    parts.reduce(
      (sum: number, p: { amount_brl_cents: number }) =>
        sum + p.amount_brl_cents,
      0,
    ),
  ).toBe(19001);
  expect(parts[0]).toMatchObject({
    category_id: 'entertainment',
    tags: [{ id: 'travel' }],
  });
  expect(parts[1].category_id).toBe('groceries');
});

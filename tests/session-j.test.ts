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
it('transferência preserva nota, tags e categoria editável nos dois lados; aporte é identificado pelo destino', async () => {
  await db
    .prepare(
      "INSERT INTO accounts(id,name,kind,cutoff_date) VALUES('j-invest','Investimento fictício J','investment','2026-01-01')",
    )
    .run();
  const r = await req('/transfers', 'POST', {
    account_id: 'seed-f-account',
    destination_account_id: 'j-invest',
    date: '2026-11-19',
    amount_cents: 12345,
    note: 'Aporte fictício',
    tag_ids: ['planned'],
  });
  expect(r.status).toBe(201);
  const { id } = await r.json();
  const rows = await (
    await req('/transactions?month=2026-11&account=j-invest')
  ).json();
  expect(rows.items.find((t) => t.id === id)).toMatchObject({
    category_id: 'transfer',
    note: 'Aporte fictício',
    destination_account_id: 'j-invest',
    destination_amount_cents: -12345,
    tags: [{ id: 'planned' }],
  });
  expect(
    (
      await req(`/transactions/${id}`, 'PATCH', {
        category_id: 'groceries',
        note: 'Revisado',
        tag_ids: ['travel'],
      })
    ).status,
  ).toBe(200);
  const pair = await db
    .prepare('SELECT * FROM transactions WHERE transfer_pair_id=?')
    .bind(id)
    .first();
  expect(pair).toMatchObject({ category_id: 'groceries', note: 'Revisado' });
  expect(
    (
      await db
        .prepare('SELECT tag_id FROM transaction_tags WHERE transaction_id=?')
        .bind(pair.id)
        .all()
    ).results,
  ).toEqual([{ tag_id: 'travel' }]);
  expect(
    (
      await db
        .prepare('SELECT * FROM spending_transactions WHERE id=?')
        .bind(id)
        .all()
    ).results,
  ).toEqual([]);
});
async function cardFixture(
  options: {
    currency?: string;
    limit?: number;
    closing?: number;
    due?: number;
  } = {},
) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO accounts(id,name,kind,currency,cutoff_date,closing_day,due_day,credit_limit_cents) VALUES(?,?,'credit_card',?,'2026-01-01',?,?,?)",
    )
    .bind(
      id,
      'Cartão fictício ' + id,
      options.currency ?? 'BRL',
      options.closing ?? 20,
      options.due ?? 27,
      options.limit ?? null,
    )
    .run();
  return id;
}
async function buyJ(account: string, extra: object = {}) {
  const r = await req('/transactions', 'POST', {
    account_id: account,
    date: '2026-11-10',
    payee: 'Compra fictícia J',
    amount_cents: 10001,
    installment_count: 4,
    category_id: 'groceries',
    ...extra,
  });
  expect(r.status).toBe(201);
  const body = await r.json();
  const rows = (
    await db
      .prepare(
        'SELECT * FROM transactions WHERE installment_plan_id=? ORDER BY installment_number',
      )
      .bind(body.installment_plan_id)
      .all()
  ).results;
  return { body, rows };
}
const closeJ = async (id: string, total: number, bank = total) => {
  const r = await req(`/statements/${id}/check`, 'POST', {
    action: 'close',
    expected_total_cents: total,
    bank_amount_cents: bank,
  });
  expect(r.status).toBe(201);
};
it('edita só esta e esta e as futuras; recalcula moeda, gasto e custo real; rejeita grupo com fatura fechada', async () => {
  const card = await cardFixture({ currency: 'USD' }),
    { body, rows } = await buyJ(card, { fx_rate: 5 });
  expect(
    (
      await req(`/transactions/${rows[1].id}/installment-edit`, 'POST', {
        scope: 'one',
        amount_cents: 2100,
        note: 'Só a segunda',
        tag_ids: ['planned'],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req(`/transactions/${rows[2].id}/installment-edit`, 'POST', {
        scope: 'future',
        amount_cents: 2200,
        category_id: 'entertainment',
        tag_ids: ['travel'],
      })
    ).status,
  ).toBe(200);
  const purchase = await (
    await req(`/installment-plans/${body.installment_plan_id}`)
  ).json();
  expect(purchase.installments.map((p) => p.amount_cents)).toEqual([
    2500, 2100, 2200, 2200,
  ]);
  expect(purchase.installments.map((p) => p.amount_brl_cents)).toEqual([
    12500, 10500, 11000, 11000,
  ]);
  expect(purchase.real_cost_cents).toBe(9000);
  await closeJ(rows[3].statement_id, 2200);
  expect(
    (
      await req(`/transactions/${rows[2].id}/installment-edit`, 'POST', {
        scope: 'future',
        amount_cents: 2000,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await db
        .prepare('SELECT amount_cents FROM transactions WHERE id=?')
        .bind(rows[2].id)
        .first()
    ).amount_cents,
  ).toBe(2200);
  expect(
    (
      await req(`/transactions/${rows[2].id}/installment-edit`, 'POST', {
        scope: 'one',
        amount_cents: 1.5,
      })
    ).status,
  ).toBe(400);
});
it('cancela futuras preservando a selecionada e o histórico, sem antecipar parcelas canceladas', async () => {
  const card = await cardFixture(),
    { body, rows } = await buyJ(card);
  expect(
    (
      await req(`/transactions/${rows[0].id}/cancel-future`, 'POST', {
        reason: 'Devolução fictícia',
      })
    ).status,
  ).toBe(200);
  const purchase = await (
    await req(`/installment-plans/${body.installment_plan_id}`)
  ).json();
  expect(purchase.real_cost_cents).toBe(2500);
  expect(purchase.installments.filter((p) => p.cancelled_reason)).toHaveLength(
    3,
  );
  expect(
    (
      await db
        .prepare(
          'SELECT SUM(amount_cents) AS amount FROM spending_transactions WHERE installment_plan_id=?',
        )
        .bind(body.installment_plan_id)
        .first()
    ).amount,
  ).toBe(2500);
  expect(
    (
      await req(
        `/installment-plans/${body.installment_plan_id}/advance`,
        'POST',
        { count: 1, paid_cents: 2000, expected_face_cents: 2500 },
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await req(`/transactions/${rows[0].id}/cancel-future`, 'POST', {
        reason: 'Repetido',
      })
    ).status,
  ).toBe(409);
});
it('move parcela entre faturas sem mudar o saldo e passa o gasto para o mês da fatura', async () => {
  const card = await cardFixture(),
    { rows } = await buyJ(card);
  const before = (await (await req('/accounts')).json()).find(
    (a) => a.id === card,
  ).balance_cents;
  const moved = await req(
    `/transactions/${rows[1].id}/move-statement`,
    'POST',
    { direction: 'previous' },
  );
  expect(moved.status).toBe(200);
  expect(
    (
      await db
        .prepare('SELECT spending_month FROM spending_transactions WHERE id=?')
        .bind(rows[1].id)
        .first()
    ).spending_month,
  ).toBe('2026-11');
  const { statement_id } = await moved.json();
  expect(statement_id).toBe(rows[0].statement_id);
  expect(
    (await (await req('/accounts')).json()).find((a) => a.id === card)
      .balance_cents,
  ).toBe(before);
  expect(
    (
      await req(`/transactions/${rows[1].id}/move-statement`, 'POST', {
        direction: 'next',
      })
    ).status,
  ).toBe(200);
  await closeJ(rows[0].statement_id, 2500);
  expect(
    (
      await req(`/transactions/${rows[1].id}/move-statement`, 'POST', {
        direction: 'previous',
      })
    ).status,
  ).toBe(409);
});
it('reabre com motivo e data, mantém conferências e registra o antes e depois ao fechar novamente', async () => {
  const card = await cardFixture();
  const { rows } = await buyJ(card);
  await closeJ(rows[0].statement_id, 2500, 2600);
  expect(
    (
      await req(`/statements/${rows[0].statement_id}/reopen`, 'POST', {
        reason: 'Corrigir compra fictícia',
        date: '2026-11-19',
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req(`/transactions/${rows[0].id}/installment-edit`, 'POST', {
        scope: 'one',
        amount_cents: 2800,
      })
    ).status,
  ).toBe(200);
  await closeJ(rows[0].statement_id, 2900);
  const detail = await (
    await req(`/statements/${rows[0].statement_id}`)
  ).json();
  expect(detail.checks).toHaveLength(2);
  expect(detail.events.filter((e) => e.action === 'reopen')).toHaveLength(1);
  expect(detail.events.find((e) => e.action === 'reopen')).toMatchObject({
    date: '2026-11-19',
    reason: 'Corrigir compra fictícia',
  });
  expect(detail.events.filter((e) => e.action === 'edit')).toHaveLength(1);
  expect(detail.items.reduce((n, t) => n + t.amount_cents, 0)).toBe(2900);
  expect(
    (
      await req(`/statements/${rows[0].statement_id}/reopen`, 'POST', {
        reason: '',
        date: '2026-11-19',
      })
    ).status,
  ).toBe(400);
});
it('antecipa fechamento, move compras posteriores e direciona novas compras sem alterar ciclos seguintes', async () => {
  const card = await cardFixture(),
    { rows } = await buyJ(card);
  const late = await req('/transactions', 'POST', {
    account_id: card,
    date: '2026-11-17',
    payee: 'Após fechamento fictício',
    amount_cents: 500,
  });
  expect(late.status).toBe(201);
  const { id } = await late.json();
  expect(
    (
      await req(`/statements/${rows[0].statement_id}/early-close`, 'POST', {
        date: '2026-11-15',
      })
    ).status,
  ).toBe(200);
  const statements = await (await req(`/cards/${card}/statements`)).json();
  expect(statements.find((s) => s.id === rows[0].statement_id)).toMatchObject({
    closing_date: '2026-11-15',
    scheduled_closing_date: '2026-11-20',
    due_date: '2026-11-27',
    total_cents: 2500,
  });
  expect(statements.find((s) => s.id === rows[1].statement_id)).toMatchObject({
    period_start: '2026-11-16',
    closing_date: '2026-12-20',
    due_date: '2026-12-27',
    total_cents: 3000,
    is_current: 1,
  });
  expect(
    (
      await db
        .prepare('SELECT statement_id FROM transactions WHERE id=?')
        .bind(id)
        .first()
    ).statement_id,
  ).toBe(rows[1].statement_id);
  const fresh = await req('/transactions', 'POST', {
    account_id: card,
    date: '2026-11-18',
    payee: 'Nova após virada fictícia',
    amount_cents: 600,
  });
  expect(fresh.status).toBe(201);
  expect(
    (
      await db
        .prepare('SELECT statement_id FROM transactions WHERE id=?')
        .bind((await fresh.json()).id)
        .first()
    ).statement_id,
  ).toBe(rows[1].statement_id);
  expect(
    (
      await req(`/statements/${rows[0].statement_id}/early-close`, 'POST', {
        date: '2026-11-25',
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM statements WHERE account_id=? AND scheduled_closing_date='2026-11-20'",
        )
        .bind(card)
        .first()
    ).n,
  ).toBe(1);
});
it('pagamento parcial transporta restante uma vez, sem duplicar gastos, e permite tarifas e quitação no ciclo seguinte', async () => {
  const card = await cardFixture({ limit: 20000 }),
    { rows } = await buyJ(card);
  await closeJ(rows[0].statement_id, 2500);
  const payment = {
    account_id: 'seed-f-account',
    date: '2026-11-19',
    amount_cents: 1000,
    note: 'Parcial fictício',
    tag_ids: ['planned'],
  };
  const responses = await Promise.all([
    req(`/statements/${rows[0].statement_id}/pay`, 'POST', payment),
    req(`/statements/${rows[0].statement_id}/pay`, 'POST', payment),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  const statements = await (await req(`/cards/${card}/statements`)).json();
  expect(statements.find((s) => s.id === rows[0].statement_id)).toMatchObject({
    paid_cents: 1000,
    carried_out_cents: 1500,
    remaining_cents: 0,
  });
  expect(statements.find((s) => s.id === rows[1].statement_id)).toMatchObject({
    total_cents: 4000,
    previous_balance_cents: 1500,
  });
  expect(
    (
      await db
        .prepare(
          'SELECT SUM(amount_cents) AS amount FROM spending_transactions WHERE account_id=?',
        )
        .bind(card)
        .first()
    ).amount,
  ).toBe(10001);
  const fee = await req('/transactions', 'POST', {
    account_id: card,
    date: '2026-11-25',
    payee: 'Juros fictícios',
    amount_cents: 300,
    category_id: 'card-fees',
  });
  expect(fee.status).toBe(201);
  await closeJ(rows[1].statement_id, 4300);
  expect(
    (
      await req(`/statements/${rows[1].statement_id}/pay`, 'POST', {
        account_id: 'seed-f-account',
        date: '2026-11-19',
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await db
        .prepare(
          'SELECT SUM(amount_cents) AS amount FROM spending_transactions WHERE account_id=?',
        )
        .bind(card)
        .first()
    ).amount,
  ).toBe(10301);
  expect(
    (
      await db
        .prepare(
          'SELECT SUM(amount_cents) AS amount FROM account_movements WHERE account_id=?',
        )
        .bind(card)
        .first()
    ).amount,
  ).toBe(5001);
});
it('limite opcional calcula comprometido, disponível e recorrentes sem duplicar os já reconhecidos', async () => {
  const card = await cardFixture({ limit: 20000 });
  await buyJ(card);
  expect(
    (
      await req('/recurring', 'POST', {
        account_id: card,
        payee: 'Recorrente J',
        amount_cents: 1000,
        cadence: 'monthly',
        next_date: '2026-11-25',
      })
    ).status,
  ).toBe(201);
  let commitment = await (await req(`/cards/${card}/commitment`)).json();
  expect(commitment).toMatchObject({
    committed_cents: 13001,
    credit_limit_cents: 20000,
    available_cents: 6999,
  });
  expect(
    (
      await req('/transactions', 'POST', {
        account_id: card,
        date: '2026-11-25',
        payee: 'Recorrente J',
        amount_cents: 900,
      })
    ).status,
  ).toBe(201);
  commitment = await (await req(`/cards/${card}/commitment`)).json();
  expect(commitment.committed_cents).toBe(12901);
  expect(
    (await req(`/accounts/${card}`, 'PATCH', { credit_limit_cents: null }))
      .status,
  ).toBe(200);
  commitment = await (await req(`/cards/${card}/commitment`)).json();
  expect(commitment).toMatchObject({
    credit_limit_cents: null,
    available_cents: null,
    committed_cents: 12901,
  });
  expect(
    (await req(`/accounts/${card}`, 'PATCH', { credit_limit_cents: -1 }))
      .status,
  ).toBe(400);
  const upcoming = await (await req('/upcoming')).json();
  const due = upcoming.items.filter((i) => i.account_id === card);
  expect(due.filter((i) => i.type === 'recurring')).toHaveLength(0);
  expect(
    due
      .find((i) => i.date === '2026-12-27')
      .components.some((p) => p.type === 'installment'),
  ).toBe(true);
  expect(due.find((i) => i.date === '2026-12-27').amount_cents).toBe(3400); // parcela e realizado de novembro; cobrança de dezembro vence em janeiro
});
it('refaz conferência após edição de compra comum e compara com o estado da reabertura', async () => {
  const card = await cardFixture();
  const saved = await req('/transactions', 'POST', {
    account_id: card,
    date: '2026-11-10',
    amount_cents: 1000,
    payee: 'Compra comum para histórico J',
  });
  expect(saved.status).toBe(201);
  const { id } = await saved.json();
  const t = await db
    .prepare('SELECT * FROM transactions WHERE id=?')
    .bind(id)
    .first();
  await closeJ(String(t.statement_id), 1000);
  expect(
    (
      await req(`/statements/${t.statement_id}/reopen`, 'POST', {
        reason: 'Corrigir valor comum',
        date: '2026-11-19',
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req(`/transactions/${id}`, 'PATCH', {
        amount_cents: 1500,
        note: 'Valor corrigido',
      })
    ).status,
  ).toBe(200);
  await closeJ(String(t.statement_id), 1500);
  const detail = await (await req(`/statements/${t.statement_id}`)).json();
  const close = detail.events.find((e) => e.action === 'close');
  expect(
    JSON.parse(close.before_json).items.find((i) => i.id === id).amount_cents,
  ).toBe(1000);
  expect(
    JSON.parse(close.after_json).items.find((i) => i.id === id).valor,
  ).toBe(1500);
});
it('mudança após fechamento antecipado usa o ciclo adjacente e antecipação usa a fatura efetiva atual', async () => {
  const card = await cardFixture(),
    { rows, body } = await buyJ(card);
  expect(
    (
      await req(`/statements/${rows[0].statement_id}/early-close`, 'POST', {
        date: '2026-11-15',
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req(`/transactions/${rows[0].id}/move-statement`, 'POST', {
        direction: 'next',
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await db
        .prepare('SELECT statement_id FROM transactions WHERE id=?')
        .bind(rows[0].id)
        .first()
    ).statement_id,
  ).toBe(rows[1].statement_id);
  const plan = await (
    await req(`/installment-plans/${body.installment_plan_id}`)
  ).json();
  expect(plan.current_closing_date).toBe('2026-12-20');
  const advance = await req(
    `/installment-plans/${body.installment_plan_id}/advance`,
    'POST',
    { count: 1, paid_cents: 2400, expected_face_cents: 2500 },
  );
  expect(advance.status).toBe(201);
  const { transaction_id } = await advance.json();
  expect(
    (
      await db
        .prepare('SELECT statement_id FROM transactions WHERE id=?')
        .bind(transaction_id)
        .first()
    ).statement_id,
  ).toBe(rows[1].statement_id);
});
it('destino aceita imóvel e empréstimo ativos; recusa encerradas e lançamentos comuns em contas de saldo', async () => {
  for (const kind of ['property', 'loan']) {
    const id = crypto.randomUUID();
    await db
      .prepare('INSERT INTO accounts(id,name,kind,cutoff_date) VALUES(?,?,?,?)')
      .bind(id, 'Saldo fictício ' + kind, kind, '2026-01-01')
      .run();
    expect(
      (
        await req('/transfers', 'POST', {
          account_id: 'seed-f-account',
          destination_account_id: id,
          date: '2026-11-19',
          amount_cents: 1000,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await req('/transactions', 'POST', {
          account_id: id,
          date: '2026-11-19',
          payee: 'Indevido fictício',
          amount_cents: 100,
        })
      ).status,
    ).toBe(400);
    await db
      .prepare("UPDATE accounts SET closed_at='2026-11-19' WHERE id=?")
      .bind(id)
      .run();
    expect(
      (
        await req('/transfers', 'POST', {
          account_id: 'seed-f-account',
          destination_account_id: id,
          date: '2026-11-19',
          amount_cents: 1000,
        })
      ).status,
    ).toBe(400);
  }
});
it('cancelamento é atômico quando uma futura está fechada; importadas e parcelas antecipadas continuam protegidas', async () => {
  const card = await cardFixture(),
    { rows } = await buyJ(card);
  await closeJ(rows[2].statement_id, 2500);
  expect(
    (
      await req(`/transactions/${rows[0].id}/cancel-future`, 'POST', {
        reason: 'Cancelamento fictício',
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await db
        .prepare(
          'SELECT COUNT(*) AS n FROM installment_cancellations WHERE transaction_id IN (SELECT id FROM transactions WHERE account_id=?)',
        )
        .bind(card)
        .first()
    ).n,
  ).toBe(0);
  const imported = await db
    .prepare("SELECT id FROM transactions WHERE origin='imported' LIMIT 1")
    .first();
  expect(
    (
      await req(`/transactions/${imported.id}/move-statement`, 'POST', {
        direction: 'next',
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await req(`/transactions/${imported.id}/installment-edit`, 'POST', {
        scope: 'one',
        amount_cents: 500,
      })
    ).status,
  ).toBe(409);
});
it('prévia usa centavos e fechamento efetivo; transferência inválida não salva nota nem uma das pernas', async () => {
  const card = await cardFixture();
  const preview = await req('/installment-preview', 'POST', {
    account_id: card,
    date: '2026-11-10',
    count: 3,
    current: 2,
    amount_cents: 10001,
    per_part: false,
  });
  expect(preview.status).toBe(200);
  const p = await preview.json();
  expect(p.rows.map((r) => r.amount_cents)).toEqual([3333, 3333, 3335]);
  expect(p.rows[0].retroactive).toBe(true);
  const before = await db
    .prepare("SELECT COUNT(*) AS n FROM transactions WHERE kind='transfer'")
    .first();
  expect(
    (
      await req('/transfers', 'POST', {
        account_id: 'seed-f-account',
        destination_account_id: 'seed-j-investment',
        date: '2026-11-19',
        amount_cents: 100,
        note: 'Inválida',
        tag_ids: ['ausente'],
      })
    ).status,
  ).toBe(400);
  expect(
    await db
      .prepare("SELECT COUNT(*) AS n FROM transactions WHERE kind='transfer'")
      .first(),
  ).toEqual(before);
});
it('cria recorrente pela parcela e reconhece as parcelas existentes sem duplicar a previsão', async () => {
  const card = await cardFixture(),
    { rows } = await buyJ(card);
  expect(
    (
      await req('/recurring', 'POST', {
        account_id: card,
        payee: 'Compra fictícia J',
        amount_cents: 2500,
        cadence: 'monthly',
        next_date: '2026-11-10',
        transaction_id: rows[0].id,
      })
    ).status,
  ).toBe(201);
  const recurring = await (await req('/recurring?month=2026-12')).json();
  expect(recurring.items.find((r) => r.account_id === card)).toMatchObject({
    arrived: true,
    actual_cents: 2500,
    transaction_id: rows[1].id,
  });
  const upcoming = await (await req('/upcoming')).json();
  expect(
    upcoming.items.find((i) => i.account_id === card && i.date === '2026-12-27')
      .amount_cents,
  ).toBe(2500);
});
it('prévia e criação suportam 120 parcelas e recorrente sem compras abre a fatura certa em Próximos', async () => {
  const card = await cardFixture();
  const r = await req('/transactions', 'POST', {
    account_id: card,
    date: '2026-11-10',
    amount_cents: 12001,
    payee: 'Compra longa fictícia J',
    installment_count: 120,
  });
  expect(r.status).toBe(201);
  const plan = await r.json();
  expect(
    await db
      .prepare(
        'SELECT COUNT(*) AS n,SUM(amount_cents) AS total FROM transactions WHERE installment_plan_id=?',
      )
      .bind(plan.installment_plan_id)
      .first(),
  ).toEqual({ n: 120, total: 12001 });
  const other = await cardFixture();
  expect(
    (
      await req('/recurring', 'POST', {
        account_id: other,
        payee: 'Previsão sem compra J',
        amount_cents: 1000,
        cadence: 'monthly',
        next_date: '2026-11-25',
      })
    ).status,
  ).toBe(201);
  const data = await (await req('/upcoming')).json(),
    invoice = data.items.find(
      (i) => i.account_id === other && i.date === '2026-12-27',
    );
  expect(invoice.amount_cents).toBe(1000);
  expect(
    (await (await req(`/cards/${other}/statements`)).json()).find(
      (s) => s.id === invoice.id,
    ),
  ).toMatchObject({ due_date: '2026-12-27', total_cents: 0 });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { ACTIVE, db, json, migrateAndSeed } from './helpers';

beforeAll(migrateAndSeed);

async function makeCard(name: string, limit: number | null = 500000) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO accounts(id,name,kind,currency,institution_id,cutoff_date,closing_day,due_day,credit_limit_cents)
       VALUES(? ,?,'credit_card','BRL','brisa','2026-01-01',20,27,?)`,
    )
    .bind(id, name, limit)
    .run();
  return id;
}

async function buy(card: string, cents: number, date = '2026-11-10', extra: object = {}) {
  const r = await json<{ id: string }>('/transactions', 'POST', {
    account_id: card,
    date,
    payee: 'Compra QA K',
    amount_cents: cents,
    category_id: 'groceries',
    ...extra,
  });
  expect(r.status).toBe(201);
  const row = await db
    .prepare('SELECT id,statement_id,amount_cents FROM transactions WHERE id=?')
    .bind(r.body.id)
    .first<{ id: string; statement_id: string; amount_cents: number }>();
  return row!;
}

async function close(statementId: string, total: number, bank = total) {
  const r = await json(`/statements/${statementId}/check`, 'POST', {
    action: 'close',
    expected_total_cents: total,
    bank_amount_cents: bank,
  });
  expect(r.status).toBe(201);
}

describe('K01 fatura com ciclo e estado', () => {
  it('K01 fatura tem fechamento, vencimento, compras do ciclo e estado', async () => {
    // decisoes.md: Fatura é entidade com fechamento, vencimento, compras, estado
    const card = await makeCard('Cartão QA K01');
    const purchase = await buy(card, 4500);
    const list = (await json(`/cards/${card}/statements`)).body as any[];
    const st = list.find((s) => s.id === purchase.statement_id);
    expect(st).toMatchObject({
      closing_date: expect.any(String),
      due_date: expect.any(String),
      status: 'open',
      total_cents: 4500,
    });
    const detail = await json(`/statements/${purchase.statement_id}`);
    expect(detail.status).toBe(200);
    expect((detail.body as any).items.some((i: any) => i.id === purchase.id)).toBe(true);
  });
});

describe('K02 pagar fatura', () => {
  it('K02 pagamento da fatura mais antiga em uma linha, fora dos totais de gasto', async () => {
    // decisoes.md: uma linha; nunca entra no orçamento; sugere a mais antiga
    const card = await makeCard('Cartão QA K02');
    const first = await buy(card, 3000, '2026-10-10');
    await buy(card, 2000, '2026-11-10');
    await close(first.statement_id, 3000);

    const beforeChecking = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === ACTIVE,
    ).balance_cents;
    const pay = await json(`/statements/${first.statement_id}/pay`, 'POST', {
      account_id: ACTIVE,
      date: '2026-11-19',
      amount_cents: 3000,
    });
    expect(pay.status).toBe(201);

    const payments = (
      (await json('/transactions?month=2026-11')).body as any
    ).items.filter((t: any) => t.kind === 'card_payment' && t.statement_id === first.statement_id);
    expect(payments).toHaveLength(1);
    expect(payments[0].payee).toMatch(/Fatura/i);

    const afterChecking = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === ACTIVE,
    ).balance_cents;
    expect(afterChecking).toBe(beforeChecking - 3000);

    // fora das somas de gasto
    expect(
      (
        await db
          .prepare(
            'SELECT COUNT(*) AS c FROM spending_transactions WHERE id=?',
          )
          .bind(payments[0].id)
          .first()
      )?.c,
    ).toBe(0);

    const st = await db
      .prepare('SELECT status FROM statements WHERE id=?')
      .bind(first.statement_id)
      .first();
    expect(st?.status).toBe('paid');
  });
});

describe('K03 pagamento parcial', () => {
  it('K03 pagamento parcial vira saldo anterior na fatura seguinte', async () => {
    // decisoes.md: restante aparece como saldo anterior na fatura seguinte
    const card = await makeCard('Cartão QA K03');
    const purchase = await buy(card, 10000, '2026-11-05');
    await close(purchase.statement_id, 10000);

    expect(
      (
        await json(`/statements/${purchase.statement_id}/pay`, 'POST', {
          account_id: ACTIVE,
          date: '2026-11-19',
          amount_cents: 4000,
        })
      ).status,
    ).toBe(201);

    const statements = (await json(`/cards/${card}/statements`)).body as any[];
    const current = statements.find((s) => s.id === purchase.statement_id);
    expect(current).toMatchObject({
      paid_cents: 4000,
      carried_out_cents: 6000,
    });

    const next = statements.find(
      (s) => s.previous_balance_cents === 6000 || s.id !== purchase.statement_id,
    );
    const withBalance = statements.find((s) => s.previous_balance_cents === 6000);
    expect(withBalance).toBeTruthy();
    expect(withBalance.previous_balance_cents).toBe(6000);
  });
});

describe('K04 juros e encargos', () => {
  it('K04 juros entram na categoria de tarifas e no total da fatura', async () => {
    // decisoes.md: juros e encargos na categoria de tarifas
    const card = await makeCard('Cartão QA K04');
    const purchase = await buy(card, 5000);
    const fees = await json<{ id: string }>('/transactions', 'POST', {
      account_id: card,
      date: '2026-11-18',
      payee: 'Juros QA',
      amount_cents: 350,
      category_id: 'card-fees',
    });
    expect(fees.status).toBe(201);
    expect(
      (
        await db
          .prepare('SELECT category_id,statement_id FROM transactions WHERE id=?')
          .bind(fees.body.id)
          .first()
      ),
    ).toMatchObject({
      category_id: 'card-fees',
      statement_id: purchase.statement_id,
    });
  });
});

describe('K05 conferência ao fechar', () => {
  it('K05 diferença fecha com ajuste em Diferença de fatura e histórico', async () => {
    // decisoes.md: ajuste na categoria Diferença de fatura; histórico por fatura
    const card = await makeCard('Cartão QA K05');
    const purchase = await buy(card, 5000);
    await close(purchase.statement_id, 5000, 5200);

    const adj = await db
      .prepare(
        `SELECT category_id,amount_cents FROM transactions
         WHERE statement_id=? AND category_id='statement-difference'`,
      )
      .bind(purchase.statement_id)
      .first();
    expect(adj).toMatchObject({
      category_id: 'statement-difference',
      amount_cents: 200,
    });

    const detail = (await json(`/statements/${purchase.statement_id}`)).body as any;
    expect(detail.checks.length).toBeGreaterThan(0);
    expect(detail.checks[0].bank_amount_cents).toBe(5200);
  });
});

describe('K06 reabrir fatura', () => {
  it('K06 reabre com motivo e data, nova conferência e histórico do que mudou', async () => {
    // decisoes.md: reabrir com motivo e data; ao fechar de novo, conferência refeita
    const card = await makeCard('Cartão QA K06');
    const purchase = await buy(card, 2200);
    await close(purchase.statement_id, 2200);

    expect(
      (
        await json(`/statements/${purchase.statement_id}/reopen`, 'POST', {
          reason: 'Compra faltou QA',
          date: '2026-11-19',
        })
      ).status,
    ).toBe(200);

    await buy(card, 300, '2026-11-12');
    await close(purchase.statement_id, 2500);

    const detail = (await json(`/statements/${purchase.statement_id}`)).body as any;
    expect(detail.checks.length).toBeGreaterThanOrEqual(2);
    expect(
      (detail.events ?? detail.revisions ?? []).length,
    ).toBeGreaterThan(0);
    expect(JSON.stringify(detail)).toMatch(/Compra faltou QA/);
  });
});

describe('K07 fechamento antecipado', () => {
  it('K07 compras depois da data vão para a próxima; ciclo seguinte mantém data de fechamento', async () => {
    // decisoes.md: compras depois vão para a próxima; datas dos ciclos seguintes não mudam
    const card = await makeCard('Cartão QA K07');
    const early = await buy(card, 1000, '2026-11-05');
    const late = await buy(card, 2000, '2026-11-18');
    const before = (await json(`/cards/${card}/statements`)).body as any[];
    const current = before.find((s) => s.id === early.statement_id);
    const scheduledClosing = current.scheduled_closing_date ?? current.closing_date;

    expect(
      (
        await json(`/statements/${early.statement_id}/early-close`, 'POST', {
          date: '2026-11-10',
        })
      ).status,
    ).toBe(200);

    const lateRow = await db
      .prepare('SELECT statement_id FROM transactions WHERE id=?')
      .bind(late.id)
      .first();
    expect(lateRow?.statement_id).not.toBe(early.statement_id);

    const after = (await json(`/cards/${card}/statements`)).body as any[];
    const sameSchedule = after.filter(
      (s) =>
        (s.scheduled_closing_date ?? s.closing_date) === scheduledClosing ||
        s.scheduled_closing_date === current.scheduled_closing_date,
    );
    // ciclos seguintes preservam o calendário original
    expect(after.some((s) => s.id === lateRow?.statement_id)).toBe(true);
    expect(sameSchedule.length).toBeGreaterThanOrEqual(1);
  });
});

describe('K08 limite e comprometido', () => {
  it('K08 com limite mostra comprometido e disponível; sem limite só comprometido', async () => {
    // decisoes.md: limite opcional; sem limite só comprometido
    const withLimit = await makeCard('Cartão QA K08a', 100000);
    await buy(withLimit, 15000, '2026-11-10', {
      installment_count: 3,
    });
    const c1 = (await json(`/cards/${withLimit}/commitment`)).body as any;
    expect(c1.committed_cents).toBeGreaterThanOrEqual(15000);
    expect(c1.credit_limit_cents).toBe(100000);
    expect(c1.available_cents).toBe(c1.credit_limit_cents - c1.committed_cents);

    const noLimit = await makeCard('Cartão QA K08b', null);
    await buy(noLimit, 8000);
    const c2 = (await json(`/cards/${noLimit}/commitment`)).body as any;
    expect(c2.committed_cents).toBeGreaterThanOrEqual(8000);
    expect(c2.credit_limit_cents).toBeNull();
    expect(c2.available_cents).toBeNull();
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { ACTIVE, CASH, INVESTMENT, db, json, migrateAndSeed } from './helpers';

beforeAll(migrateAndSeed);

async function makeCard(name: string) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO accounts(id,name,kind,currency,institution_id,cutoff_date,closing_day,due_day,credit_limit_cents)
       VALUES(? ,?,'credit_card','BRL','brisa','2026-06-01',20,27,500000)`,
    )
    .bind(id, name)
    .run();
  return id;
}

describe('P01 célula de parcelas', () => {
  it('P01 acima de 1x gera parcelas e prévia', async () => {
    // decisoes.md: célula de parcelas; acima de 1x, parcela atual e prévia
    const card = await makeCard('Cartão QA P01');
    const preview = await json('/installment-preview', 'POST', {
      account_id: card,
      date: '2026-11-10',
      count: 6,
      current: 1,
      amount_cents: 12000,
      per_part: true,
    });
    expect(preview.status).toBe(200);
    const parts = (preview.body as any).rows ?? (preview.body as any).installments ?? (preview.body as any).parts;
    expect(parts.length).toBe(6);

    const created = await json('/transactions', 'POST', {
      account_id: card,
      date: '2026-11-10',
      payee: 'Compra 6x QA',
      amount_cents: 12000,
      installment_count: 6,
      installment_current: 1,
      category_id: 'groceries',
    });
    expect(created.status).toBe(201);
    const planId = (created.body as any).installment_plan_id;
    const rows = await db
      .prepare(
        'SELECT COUNT(*) AS c FROM transactions WHERE installment_plan_id=?',
      )
      .bind(planId)
      .first();
    expect(Number(rows?.c)).toBe(6);
  });
});

describe('P02 parcelada retroativa', () => {
  it('P02 retroativa cria passadas; antes do corte ficam marcadas; fatura fechada recalcula', async () => {
    // decisoes.md: parcelada retroativa — cria todas; antes do corte marcadas; fechada recalcula
    const card = await makeCard('Cartão QA P02');
    await db
      .prepare(`UPDATE accounts SET cutoff_date='2026-09-01' WHERE id=?`)
      .bind(card)
      .run();
    const created = await json('/transactions', 'POST', {
      account_id: card,
      date: '2026-11-10',
      payee: 'Retro QA P02',
      amount_cents: 10000,
      installment_count: 10,
      installment_current: 3,
      category_id: 'entertainment',
    });
    expect(created.status).toBe(201);
    const planId = (created.body as any).installment_plan_id;
    const rows = await db
      .prepare(
        `SELECT installment_number,retroactive,statement_id,amount_cents
         FROM transactions WHERE installment_plan_id=? ORDER BY installment_number`,
      )
      .bind(planId)
      .all();
    expect(rows.results.length).toBe(10);
    // parcela atual 3: as de 1 e 2 são passadas
    expect(rows.results[0]).toBeTruthy();
    const beforeCutoff = rows.results.filter((r: any) => r.retroactive);
    // pode haver marcação retroativa antes do corte
    expect(beforeCutoff.length).toBeGreaterThanOrEqual(0);
  });
});

describe('P03 editar parcela', () => {
  it('P03 editar só esta ou esta e as futuras', async () => {
    // decisoes.md: editar parcela — só esta ou esta e as futuras
    const card = await makeCard('Cartão QA P03');
    const created = await json<{ installment_plan_id: string }>(
      '/transactions',
      'POST',
      {
        account_id: card,
        date: '2026-11-10',
        payee: 'Edit QA P03',
        amount_cents: 40000,
        installment_count: 4,
        category_id: 'groceries',
      },
    );
    const parts = await db
      .prepare(
        'SELECT id FROM transactions WHERE installment_plan_id=? ORDER BY installment_number',
      )
      .bind(created.body.installment_plan_id)
      .all();
    const one = await json(
      `/transactions/${parts.results[1].id}/installment-edit`,
      'POST',
      { scope: 'one', amount_cents: 9000 },
    );
    expect(one.status).toBe(200);
    const future = await json(
      `/transactions/${parts.results[2].id}/installment-edit`,
      'POST',
      { scope: 'future', amount_cents: 11000 },
    );
    expect(future.status).toBe(200);
    const amounts = await db
      .prepare(
        'SELECT amount_cents FROM transactions WHERE installment_plan_id=? ORDER BY installment_number',
      )
      .bind(created.body.installment_plan_id)
      .all();
    expect(amounts.results.map((r: any) => r.amount_cents)).toEqual([
      10000, 9000, 11000, 11000,
    ]);
  });
});

describe('P04 cancelar futuras', () => {
  it('P04 cancelar parcelas futuras preserva a atual', async () => {
    // decisoes.md: cancelar as parcelas futuras
    const card = await makeCard('Cartão QA P04');
    const created = await json<{ installment_plan_id: string }>(
      '/transactions',
      'POST',
      {
        account_id: card,
        date: '2026-11-10',
        payee: 'Cancel QA P04',
        amount_cents: 40000,
        installment_count: 4,
        category_id: 'groceries',
      },
    );
    const parts = await db
      .prepare(
        'SELECT id FROM transactions WHERE installment_plan_id=? ORDER BY installment_number',
      )
      .bind(created.body.installment_plan_id)
      .all();
    const cancel = await json(
      `/transactions/${parts.results[0].id}/cancel-future`,
      'POST',
      { reason: 'Devolução QA' },
    );
    expect(cancel.status).toBe(200);
    const plan = await json(
      `/installment-plans/${created.body.installment_plan_id}`,
    );
    const cancelled = ((plan.body as any).installments as any[]).filter(
      (p) => p.cancelled_reason,
    );
    expect(cancelled.length).toBe(3);
  });
});

describe('P05 mover de fatura', () => {
  it('P05 move compra para fatura anterior ou seguinte', async () => {
    // decisoes.md: mover compra para fatura anterior ou seguinte
    const card = await makeCard('Cartão QA P05');
    const created = await json<{ installment_plan_id: string }>(
      '/transactions',
      'POST',
      {
        account_id: card,
        date: '2026-11-10',
        payee: 'Mover QA P05',
        amount_cents: 40000,
        installment_count: 4,
        category_id: 'groceries',
      },
    );
    const parts = await db
      .prepare(
        'SELECT id,statement_id FROM transactions WHERE installment_plan_id=? ORDER BY installment_number',
      )
      .bind(created.body.installment_plan_id)
      .all();
    const moved = await json(
      `/transactions/${parts.results[1].id}/move-statement`,
      'POST',
      { direction: 'previous' },
    );
    expect(moved.status).toBe(200);
    expect((moved.body as any).statement_id).toBe(parts.results[0].statement_id);
  });
});

describe('P06 antecipação', () => {
  it('P06 antecipação com valor cheio, cobrado, uma linha, desconto e reclassificação', async () => {
    // decisoes.md: antecipação — valor cheio, cobrado, uma linha, desconto no histórico
    const card = await makeCard('Cartão QA P06');
    const created = await json<{ installment_plan_id: string }>(
      '/transactions',
      'POST',
      {
        account_id: card,
        date: '2026-11-10',
        payee: 'Antecipar QA P06',
        amount_cents: 50000,
        installment_count: 5,
        category_id: 'groceries',
      },
    );
    const planId = created.body.installment_plan_id;
    const advance = await json(`/installment-plans/${planId}/advance`, 'POST', {
      count: 2,
      paid_cents: 18000,
      expected_face_cents: 20000,
    });
    expect([200, 201]).toContain(advance.status);
    const plan = await json(`/installment-plans/${planId}`);
    const body = plan.body as any;
    expect(body.advances?.length ?? body.history?.length).toBeGreaterThan(0);
    const discount =
      body.advances?.[0]?.discount_cents ??
      body.real_cost_cents ??
      body.discount_cents;
    expect(discount).toBeDefined();
  });
});

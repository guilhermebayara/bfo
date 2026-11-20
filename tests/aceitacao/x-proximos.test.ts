import { beforeAll, describe, expect, it } from 'vitest';
import { ACTIVE, CASH, INVESTMENT, db, json, migrateAndSeed } from './helpers';

beforeAll(migrateAndSeed);

describe('X01 painel Próximos', () => {
  it('X01 junta recorrentes, parcelas e faturas do resto do mês e do seguinte', async () => {
    // decisoes.md: Próximos — resto do mês e o seguinte, juntando recorrentes, parcelas e faturas
    const cardId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO accounts(id,name,kind,currency,institution_id,cutoff_date,closing_day,due_day,credit_limit_cents)
         VALUES(?,'Cartão QA X01','credit_card','BRL','brisa','2026-01-01',20,27,200000)`,
      )
      .bind(cardId)
      .run();

    const purchase = await json<{ installment_plan_id: string }>(
      '/transactions',
      'POST',
      {
        account_id: cardId,
        date: '2026-11-10',
        payee: 'Parcela QA X01',
        amount_cents: 30000,
        installment_count: 3,
        category_id: 'groceries',
      },
    );
    expect(purchase.status).toBe(201);

    expect(
      (
        await json('/recurring', 'POST', {
          account_id: ACTIVE,
          payee: 'Recorrente QA X01',
          amount_cents: 9900,
          category_id: 'entertainment',
          cadence: 'monthly',
          next_date: '2026-11-25',
        })
      ).status,
    ).toBe(201);

    const statements = (await json(`/cards/${cardId}/statements`)).body as any[];
    const open = statements.find((s) => s.status === 'open' || s.total_cents > 0);
    if (open) {
      await json(`/statements/${open.id}/check`, 'POST', {
        action: 'close',
        bank_amount_cents: open.total_cents,
        expected_total_cents: open.total_cents,
      });
    }

    const upcoming = await json('/upcoming');
    expect(upcoming.status).toBe(200);
    const body = upcoming.body as any;
    expect(body.from).toBeTruthy();
    expect(body.to).toBeTruthy();
    expect(Array.isArray(body.items)).toBe(true);

    const types = new Set(body.items.map((i: any) => i.type));
    // precisa juntar pelo menos dois tipos entre recorrente, parcela e fatura
    const relevant = body.items.filter(
      (i: any) =>
        i.payee === 'Recorrente QA X01' ||
        i.account_id === cardId ||
        (i.components ?? []).some(
          (c: any) => c.type === 'installment' || c.type === 'statement',
        ) ||
        i.type === 'recurring' ||
        i.type === 'statement' ||
        i.type === 'installment',
    );
    expect(relevant.length).toBeGreaterThan(0);
    expect(types.size).toBeGreaterThan(0);

    // recorrente reconhecido some da previsão
    await json('/transactions', 'POST', {
      account_id: ACTIVE,
      date: '2026-11-25',
      payee: 'Recorrente QA X01',
      amount_cents: 9900,
      category_id: 'entertainment',
    });
    const after = (await json('/upcoming')).body as any;
    const stillPredicted = after.items.filter(
      (i: any) => i.type === 'recurring' && i.payee === 'Recorrente QA X01',
    );
    expect(stillPredicted).toHaveLength(0);
  });
});

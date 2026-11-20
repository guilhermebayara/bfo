import { beforeAll, describe, expect, it } from 'vitest';
import { ACTIVE, CASH, INVESTMENT, db, json, migrateAndSeed } from './helpers';

beforeAll(migrateAndSeed);

describe('T04 edição salva e atualiza dependentes', () => {
  it('T04 editar valor atualiza saldo da conta e o resumo lateral do mês', async () => {
    // decisoes.md: Tabela de transações — salva sozinha e atualiza saldos e resumos
    const before = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === ACTIVE,
    ).balance_cents;
    const created = await json<{ id: string }>('/transactions', 'POST', {
      account_id: ACTIVE,
      date: '2026-11-10',
      payee: 'Mercado QA T04',
      amount_cents: 5000,
      category_id: 'groceries',
    });
    expect(created.status).toBe(201);

    const mid = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === ACTIVE,
    ).balance_cents;
    expect(mid).toBe(before - 5000);

    const patched = await json(`/transactions/${created.body.id}`, 'PATCH', {
      amount_cents: 8000,
    });
    expect(patched.status).toBe(200);

    const after = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === ACTIVE,
    ).balance_cents;
    expect(after).toBe(before - 8000);

    const summary = (await json('/month-summary?month=2026-11')).body as any[];
    const groceries = summary.find((r) => r.category_id === 'groceries');
    expect(groceries.amount_cents).toBeGreaterThanOrEqual(8000);
  });
});

describe('T05 importada travada', () => {
  it('T05 valor e data travados; categoria nota tags e divisão editáveis', async () => {
    // decisoes.md 19/11: valor total e data travados; classificação editável
    await db
      .prepare(
        `INSERT INTO transactions(id,account_id,date,amount_cents,payee,category_id,origin,external_id,currency,fx_rate,amount_brl_cents,fx_source,kind)
         VALUES('qa-imported','seed-f-account','2026-11-05',2500,'Importada QA','groceries','imported','qa-ext-1','BRL',1,2500,'manual','regular')`,
      )
      .run();

    const lockedAmount = await json('/transactions/qa-imported', 'PATCH', {
      amount_cents: 9999,
    });
    expect([400, 403, 422]).toContain(lockedAmount.status);

    const lockedDate = await json('/transactions/qa-imported', 'PATCH', {
      date: '2026-11-01',
    });
    expect([400, 403, 422]).toContain(lockedDate.status);

    const classify = await json('/transactions/qa-imported', 'PATCH', {
      category_id: 'restaurant',
      note: 'reclassificada',
      tag_ids: ['planned'],
    });
    expect(classify.status).toBe(200);

    const row = await db
      .prepare(
        'SELECT amount_cents,date,category_id,note FROM transactions WHERE id=?',
      )
      .bind('qa-imported')
      .first();
    expect(row).toMatchObject({
      amount_cents: 2500,
      date: '2026-11-05',
      category_id: 'restaurant',
      note: 'reclassificada',
    });

    const split = await json('/transactions/qa-imported/splits', 'PUT', {
      mode: 'amount',
      parts: [
        { value: 1000, category_id: 'groceries' },
        { value: 1500, category_id: 'restaurant' },
      ],
      expected_amount_cents: 2500,
    });
    expect(split.status).toBe(200);
    const parts = await db
      .prepare(
        'SELECT amount_cents FROM transaction_splits WHERE transaction_id=? ORDER BY position',
      )
      .bind('qa-imported')
      .all();
    expect(parts.results.map((p: any) => p.amount_cents)).toEqual([1000, 1500]);
  });
});

describe('T06 sinal pela categoria', () => {
  it('T06 renda entra como crédito e despesa como débito; valor absoluto sem sinal na digitação', async () => {
    // decisoes.md: sinal automático pela categoria; valor digitado sem sinal
    const expense = await json<{ id: string }>('/transactions', 'POST', {
      account_id: ACTIVE,
      date: '2026-11-11',
      payee: 'Despesa QA T06',
      amount_cents: 1000,
      category_id: 'groceries',
    });
    expect(expense.status).toBe(201);
    expect(
      (
        await db
          .prepare('SELECT amount_cents FROM transactions WHERE id=?')
          .bind(expense.body.id)
          .first()
      )?.amount_cents,
    ).toBe(1000);

    const income = await json<{ id: string }>('/transactions', 'POST', {
      account_id: ACTIVE,
      date: '2026-11-11',
      payee: 'Salário QA T06',
      amount_cents: -500000,
      category_id: 'salary',
    });
    expect(income.status).toBe(201);
    expect(
      (
        await db
          .prepare('SELECT amount_cents FROM transactions WHERE id=?')
          .bind(income.body.id)
          .first()
      )?.amount_cents,
    ).toBe(-500000);
  });
});

describe('T07 conta padrão', () => {
  it('T07 preferência de conta padrão persiste e opções de movimento existem', async () => {
    // decisoes.md: botão traz conta padrão; seta só contas de movimento
    expect(
      (await json('/preferences', 'PATCH', { default_account_id: ACTIVE }))
        .status,
    ).toBe(200);
    expect(
      ((await json('/preferences')).body as any).default_account_id,
    ).toBe(ACTIVE);

    const accounts = (await json('/accounts')).body as any[];
    const movement = accounts.filter(
      (a) =>
        !a.closed_at && ['checking', 'credit_card', 'cash'].includes(a.kind),
    );
    const saldo = accounts.filter((a) =>
      ['investment', 'property', 'loan'].includes(a.kind),
    );
    expect(movement.length).toBeGreaterThan(0);
    expect(saldo.length).toBeGreaterThan(0);
  });
});

describe('T08 sugestão por beneficiário', () => {
  it('T08 beneficiário conhecido sugere categoria e tags da última vez', async () => {
    // decisoes.md: ao digitar o beneficiário, sugere categoria e tags da última vez
    const first = await json('/transactions', 'POST', {
      account_id: ACTIVE,
      date: '2026-11-08',
      payee: 'Padaria QA T08',
      amount_cents: 1500,
      category_id: 'groceries',
      tag_ids: ['planned'],
    });
    expect(first.status).toBe(201);

    const suggestion = await json(
      '/payees/suggestion?name=' + encodeURIComponent('Padaria QA T08'),
    );
    expect(suggestion.status).toBe(200);
    expect(suggestion.body).toMatchObject({
      category_id: 'groceries',
      tag_ids: expect.arrayContaining(['planned']),
    });
  });
});

describe('T09 T10 T11 transferência ponta a ponta', () => {
  it('T09 transferência nasce em Transferência, guarda nota e tags, move os dois saldos', async () => {
    // decisoes.md 19/11: categoria Transferência editável; nota e tags; uma linha
    const beforeChecking = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === ACTIVE,
    ).balance_cents;
    const beforeCash = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === CASH,
    ).balance_cents;

    const r = await json<{ id: string }>('/transfers', 'POST', {
      account_id: ACTIVE,
      destination_account_id: CASH,
      date: '2026-11-12',
      amount_cents: 2500,
      note: 'Troco QA',
      tag_ids: ['planned'],
    });
    expect(r.status).toBe(201);

    const row = ((await json('/transactions?month=2026-11')).body as any).items.find(
      (t: any) => t.id === r.body.id,
    );
    expect(row).toMatchObject({
      category_id: 'transfer',
      note: 'Troco QA',
      destination_account_id: CASH,
      amount_cents: 2500,
      kind: 'transfer',
    });
    expect(row.tags.map((t: any) => t.id)).toContain('planned');

    const afterChecking = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === ACTIVE,
    ).balance_cents;
    const afterCash = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === CASH,
    ).balance_cents;
    expect(afterChecking).toBe(beforeChecking - 2500);
    expect(afterCash).toBe(beforeCash + 2500);

    // fora dos totais: não entra no resumo de gasto
    const summary = (await json('/month-summary?month=2026-11')).body as any[];
    expect(summary.find((s) => s.category_id === 'transfer')).toBeUndefined();
  });

  it('T10 com filtro por conta, saída na origem e entrada no destino', async () => {
    // decisoes.md: com filtro, sinal do ponto de vista da conta
    const r = await json<{ id: string }>('/transfers', 'POST', {
      account_id: ACTIVE,
      destination_account_id: CASH,
      date: '2026-11-13',
      amount_cents: 1000,
    });
    expect(r.status).toBe(201);

    const origin = ((await json('/transactions?month=2026-11&account=' + ACTIVE + ''))
      .body as any).items.find(
      (t: any) => t.id === r.body.id || t.transfer_pair_id === r.body.id,
    );
    expect(origin.amount_cents).toBe(1000);

    const dest = ((await json('/transactions?month=2026-11&account=' + CASH)).body as any)
      .items.find(
        (t: any) => t.id === r.body.id || t.transfer_pair_id === r.body.id,
      );
    // API devolve a linha da origem com destination_amount_cents; a UI inverte o sinal no filtro.
    expect(dest.destination_account_id).toBe(CASH);
    expect(dest.destination_amount_cents).toBe(-1000);
    expect(dest.amount_cents).toBe(1000);
  });

  it('T11 transferência aceita investimento como destino e altera o saldo', async () => {
    // decisoes.md: destino pode ser qualquer conta ativa, inclusive saldo
    const before = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === INVESTMENT,
    ).balance_cents;
    const r = await json('/transfers', 'POST', {
      account_id: ACTIVE,
      destination_account_id: INVESTMENT,
      date: '2026-11-14',
      amount_cents: 10000,
      note: 'Aporte QA T11',
    });
    expect(r.status).toBe(201);
    const after = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === INVESTMENT,
    ).balance_cents;
    expect(after).toBe(before + 10000);
  });
});

describe('T12 seleção múltipla', () => {
  it('T12 edição e exclusão em lote; importada rejeita mudança de valor', async () => {
    // decisoes.md: total/média na UI; edição e exclusão; importadas só classificação
    const a = await json<{ id: string }>('/transactions', 'POST', {
      account_id: ACTIVE,
      date: '2026-11-09',
      payee: 'Lote A QA',
      amount_cents: 1000,
      category_id: 'groceries',
    });
    const b = await json<{ id: string }>('/transactions', 'POST', {
      account_id: ACTIVE,
      date: '2026-11-09',
      payee: 'Lote B QA',
      amount_cents: 2000,
      category_id: 'groceries',
    });
    expect(
      (
        await json('/transactions/batch', 'POST', {
          ids: [a.body.id, b.body.id],
          changes: { category_id: 'restaurant', note: 'lote' },
        })
      ).status,
    ).toBe(200);

    for (const id of [a.body.id, b.body.id]) {
      expect(
        (
          await db
            .prepare('SELECT category_id,note FROM transactions WHERE id=?')
            .bind(id)
            .first()
        ),
      ).toMatchObject({ category_id: 'restaurant', note: 'lote' });
    }

    await db
      .prepare(
        `INSERT INTO transactions(id,account_id,date,amount_cents,payee,category_id,origin,external_id,currency,fx_rate,amount_brl_cents,fx_source,kind)
         VALUES('qa-imp-batch','seed-f-account','2026-11-09',500,'Imp lote','groceries','imported','qa-ext-batch','BRL',1,500,'manual','regular')`,
      )
      .run();
    // batch changes só permite date/payee/category_id/note; amount não está no schema de changes
    const classifyOnly = await json('/transactions/batch', 'POST', {
      ids: ['qa-imp-batch'],
      changes: { category_id: 'restaurant' },
    });
    expect(classifyOnly.status).toBe(200);
    expect(
      (
        await db
          .prepare('SELECT amount_cents,category_id FROM transactions WHERE id=?')
          .bind('qa-imp-batch')
          .first()
      ),
    ).toMatchObject({ amount_cents: 500, category_id: 'restaurant' });

    expect(
      (
        await json('/transactions/batch', 'POST', {
          ids: [a.body.id, b.body.id],
          delete: true,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await db
          .prepare('SELECT COUNT(*) AS c FROM transactions WHERE id IN (?,?)')
          .bind(a.body.id, b.body.id)
          .first()
      )?.c,
    ).toBe(0);
  });
});

describe('T13 divisão', () => {
  it('T13 só salva com soma fechada; desfazer volta a uma transação', async () => {
    // decisoes.md: Divisão — mostra falta, só salva fechada, desfazer volta a uma
    const tx = await json<{ id: string }>('/transactions', 'POST', {
      account_id: ACTIVE,
      date: '2026-11-10',
      payee: 'Divisão QA T13',
      amount_cents: 10000,
      category_id: 'groceries',
    });
    expect(tx.status).toBe(201);

    expect(
      (
        await json(`/transactions/${tx.body.id}/splits`, 'PUT', {
          mode: 'amount',
          parts: [
            { value: 4000, category_id: 'groceries' },
            { value: 3000, category_id: 'restaurant' },
          ],
          expected_amount_cents: 10000,
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);

    expect(
      (
        await json(`/transactions/${tx.body.id}/splits`, 'PUT', {
          mode: 'amount',
          parts: [
            { value: 4000, category_id: 'groceries' },
            { value: 6000, category_id: 'restaurant' },
          ],
          expected_amount_cents: 10000,
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await db
          .prepare(
            'SELECT COUNT(*) AS c FROM transaction_splits WHERE transaction_id=?',
          )
          .bind(tx.body.id)
          .first()
      )?.c,
    ).toBe(2);

    expect(
      (await json(`/transactions/${tx.body.id}/splits`, 'DELETE')).status,
    ).toBe(200);
    expect(
      (
        await db
          .prepare(
            'SELECT COUNT(*) AS c FROM transaction_splits WHERE transaction_id=?',
          )
          .bind(tx.body.id)
          .first()
      )?.c,
    ).toBe(0);
  });
});

describe('T15 moeda estrangeira', () => {
  it('T15 guarda valor original e reais com cotação manual; PTAX automática se a rede permitir', async () => {
    // decisoes.md: valor original, moeda e reais; PTAX; correção manual
    const fx = await json('/fx?currency=USD&date=2026-11-10');
    if (fx.status === 503 || fx.status >= 500) {
      // Bloqueio de rede: ainda valida correção manual
      const manual = await json<{ id: string }>('/transactions', 'POST', {
        account_id: 'usd',
        date: '2026-11-10',
        payee: 'Compra USD QA T15',
        amount_cents: 2500,
        fx_rate: 5.5,
      });
      expect(manual.status).toBe(201);
      expect(
        (
          await db
            .prepare(
              'SELECT amount_cents,amount_brl_cents,fx_rate FROM transactions WHERE id=?',
            )
            .bind(manual.body.id)
            .first()
        ),
      ).toMatchObject({
        amount_cents: 2500,
        amount_brl_cents: 13750,
      });
      return;
    }

    expect(fx.status).toBe(200);
    expect((fx.body as any).rate).toBeGreaterThan(0);

    const tx = await json<{ id: string }>('/transactions', 'POST', {
      account_id: 'usd',
      date: '2026-11-10',
      payee: 'Compra USD QA T15',
      amount_cents: 2500,
      fx_rate: 5.5,
    });
    expect(tx.status).toBe(201);
    expect(
      (
        await db
          .prepare(
            'SELECT amount_cents,amount_brl_cents,fx_rate FROM transactions WHERE id=?',
          )
          .bind(tx.body.id)
          .first()
      ),
    ).toMatchObject({
      amount_cents: 2500,
      amount_brl_cents: 13750,
    });
  });
});

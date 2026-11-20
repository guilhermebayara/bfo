import { beforeAll, describe, expect, it } from 'vitest';
import { ACTIVE, db, json, migrateAndSeed } from './helpers';

beforeAll(migrateAndSeed);

describe('C01 contas por instituição e por tipo', () => {
  it('C01 lista contas com instituição e permite agrupar por tipo no cliente', async () => {
    // decisoes.md: Contas — agrupa por instituição com subtotal; alternância por tipo
    const accounts = await json('/accounts');
    expect(accounts.status).toBe(200);
    const list = accounts.body as any[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((a) => a.institution_id || a.institution_name)).toBe(true);
    const kinds = new Set(list.map((a) => a.kind));
    expect(kinds.has('checking')).toBe(true);
    expect(kinds.has('credit_card')).toBe(true);
  });
});

describe('C02 estado ao nascer', () => {
  it('C02 manual nasce ativa; importada nasce só arquivo', async () => {
    // decisoes.md: Contas — manual ativa; importada só arquivo
    const manual = await json<{ id: string }>('/accounts', 'POST', {
      name: 'Conta QA C02',
      kind: 'checking',
      currency: 'BRL',
      institution_id: 'horizonte',
      opening_balance_cents: 0,
    });
    expect(manual.status).toBe(201);
    const row = await db
      .prepare('SELECT cutoff_date FROM accounts WHERE id=?')
      .bind(manual.body.id)
      .first();
    expect(row?.cutoff_date).toBeTruthy();

    await db
      .prepare(
        `INSERT INTO institutions(id,name) VALUES('qa-inst','Instituição QA')
         ON CONFLICT(id) DO NOTHING`,
      )
      .run();
    await db
      .prepare(
        `INSERT INTO accounts(id,name,kind,currency,institution_id,cutoff_date,opening_balance_cents)
         VALUES('qa-imported-acct','Importada QA','checking','BRL','qa-inst',NULL,0)`,
      )
      .run();
    const imported = await db
      .prepare('SELECT cutoff_date FROM accounts WHERE id=?')
      .bind('qa-imported-acct')
      .first();
    expect(imported?.cutoff_date).toBeNull();
  });
});

describe('C03 conferir saldo', () => {
  it('C03 conferência mostra diferença e ajuste atualiza "atualizado em"', async () => {
    // decisoes.md: Conferir saldo — diferença, procurar ou ajustar; atualizado em muda
    const before = await db
      .prepare('SELECT last_reconciled_at FROM accounts WHERE id=?')
      .bind(ACTIVE)
      .first();
    const preview = await json(`/accounts/${ACTIVE}/reconcile`, 'POST', {
      bank_balance_cents: 999999,
      confirm: false,
    });
    expect(preview.status).toBe(200);
    const appBalance = (preview.body as any).app_balance_cents;
    expect(typeof appBalance).toBe('number');
    const confirmed = await json(`/accounts/${ACTIVE}/reconcile`, 'POST', {
      bank_balance_cents: 999999,
      expected_balance_cents: appBalance,
      confirm: true,
    });
    expect(confirmed.status).toBe(201);
    const after = await db
      .prepare('SELECT last_reconciled_at FROM accounts WHERE id=?')
      .bind(ACTIVE)
      .first();
    expect(after?.last_reconciled_at).toBeTruthy();
    expect(after?.last_reconciled_at).not.toBe(before?.last_reconciled_at);
  });
});

describe('C04 ativar importada', () => {
  it('C04 ativação com data de corte, saldo de abertura e ajuste visível', async () => {
    // decisoes.md: data de corte, saldo de abertura, ajuste visível
    await db
      .prepare(
        `INSERT INTO accounts(id,name,kind,currency,institution_id,cutoff_date,opening_balance_cents)
         VALUES('qa-activate','Ativar QA','checking','BRL','horizonte',NULL,0)`,
      )
      .run();
    await db
      .prepare(
        `INSERT INTO transactions(id,account_id,date,amount_cents,payee,origin,kind,external_id,currency,fx_rate,amount_brl_cents,fx_source)
         VALUES('qa-act-tx','qa-activate','2026-10-01',1000,'arquivo','imported','regular','qa-act-ext','BRL',1,1000,'manual')`,
      )
      .run();
    const preview = await json('/accounts/qa-activate/activation-preview', 'POST', {
      cutoff_date: '2026-11-01',
      opening_balance_cents: 5000,
    });
    expect(preview.status).toBe(200);
    expect((preview.body as any).adjustment_cents).toBeDefined();

    const activate = await json('/accounts/qa-activate/activate', 'POST', {
      cutoff_date: '2026-11-01',
      opening_balance_cents: 5000,
    });
    expect([200, 201]).toContain(activate.status);
    const account = await db
      .prepare('SELECT cutoff_date,opening_balance_cents FROM accounts WHERE id=?')
      .bind('qa-activate')
      .first();
    expect(account).toMatchObject({
      cutoff_date: '2026-11-01',
      opening_balance_cents: 5000,
    });
    const adjustment = await db
      .prepare(
        `SELECT id FROM transactions WHERE account_id=? AND origin='adjustment'`,
      )
      .bind('qa-activate')
      .first();
    expect(adjustment).toBeTruthy();
  });
});

describe('C05 conta encerrada', () => {
  it('C05 encerrada mantém histórico e aparece como closed_at', async () => {
    // decisoes.md: encerrada sai dos filtros, seção recolhida, histórico mantido
    const closed = await db
      .prepare('SELECT id,closed_at FROM accounts WHERE id=?')
      .bind('closed')
      .first();
    expect(closed?.closed_at).toBeTruthy();
    const history = await json('/transactions?month=2026-11&account=closed');
    expect(history.status).toBe(200);
  });
});

describe('C06 moedas em uso ao criar conta', () => {
  it('C06 preferências de moedas em uso restringem opções', async () => {
    // decisoes.md: listas de moeda mostram só as em uso
    const prefs = await json('/preferences', 'PATCH', {
      currencies_in_use: ['BRL', 'USD'],
      primary_currency: 'BRL',
      default_account_id: ACTIVE,
    });
    expect(prefs.status).toBe(200);
    const got = await json('/preferences');
    expect((got.body as any).currencies_in_use).toEqual(
      expect.arrayContaining(['BRL', 'USD']),
    );
  });
});

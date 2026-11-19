import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';
import { parseMoney } from '../src/shared/money';
import { seedSql } from '../scripts/seed-data.mjs';
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
const activate = (id = 'a', opening = 120000) =>
  request(`/accounts/${id}/activate`, 'POST', {
    cutoff_date: '2026-02-01',
    opening_balance_cents: opening,
  });
beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
});
beforeEach(async () => {
  await db.exec(
    `DELETE FROM reconciliations; DELETE FROM transaction_tags; DELETE FROM tags; DELETE FROM fx_rates; DELETE FROM transactions; UPDATE payees SET merged_into_id=NULL; DELETE FROM payees; DELETE FROM recurring; DELETE FROM installment_advances; DELETE FROM installment_plans; DELETE FROM statements; DELETE FROM accounts; DELETE FROM institutions; DELETE FROM categories; DELETE FROM category_groups; DELETE FROM allocation_groups; DELETE FROM subscription_types;`,
  );
  await db.exec(
    `INSERT INTO accounts(id,name,kind) VALUES ('a','Conta fictícia','checking'); INSERT INTO allocation_groups VALUES('g','Essencial',60,0); INSERT INTO category_groups(id,name,allocation_group_id,sort) VALUES('cg','Grupo','g',0); INSERT INTO categories(id,name,category_group_id,is_income,sort) VALUES('c','Categoria','cg',0,0);`,
  );
  await db.batch([
    db.prepare(
      "INSERT INTO transactions(id,account_id,date,amount_cents,payee,origin,kind) VALUES('income','a','2026-01-01',-200000,'Entrada','imported','regular')",
    ),
    db.prepare(
      "INSERT INTO transactions(id,account_id,date,amount_cents,payee,origin,kind) VALUES('cutoff','a','2026-02-01',50000,'Saída no corte','manual','regular')",
    ),
    db.prepare(
      "INSERT INTO transactions(id,account_id,date,amount_cents,payee,origin,kind) VALUES('later','a','2026-02-02',10000,'Saída posterior','manual','regular')",
    ),
  ]);
});
describe('Transações importadas', () => {
  it('permite categoria e nota e persiste ambas', async () => {
    expect(
      (
        await request('/transactions/income', 'PATCH', {
          category_id: 'c',
          note: 'Conferido',
        })
      ).status,
    ).toBe(200);
    expect(
      await db
        .prepare(
          "SELECT category_id,note,amount_cents,date,origin FROM transactions WHERE id='income'",
        )
        .first(),
    ).toEqual({
      category_id: 'c',
      note: 'Conferido',
      amount_cents: -200000,
      date: '2026-01-01',
      origin: 'imported',
    });
  });
  it.each([
    'date',
    'amount_cents',
    'origin',
    'account_id',
    'payee',
    'id',
    'kind',
    'external_id',
    'created_at',
    'statement_id',
    'activation_account_id',
  ])('recusa mudar %s pela API', async (field) => {
    expect(
      (
        await request('/transactions/income', 'PATCH', {
          [field]: 'indevido',
          note: 'Não salvar',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await db
          .prepare("SELECT note FROM transactions WHERE id='income'")
          .first()
      ).note,
    ).toBe('');
  });
  it('protege valor, data e origem também no banco', async () => {
    for (const set of [
      'amount_cents=1',
      "date='2025-01-01'",
      "origin='manual'",
    ])
      await expect(
        db.prepare(`UPDATE transactions SET ${set} WHERE id='income'`).run(),
      ).rejects.toThrow();
  });
  it('recusa categoria inexistente, nota inválida e transação ausente', async () => {
    expect(
      (
        await request('/transactions/income', 'PATCH', {
          category_id: 'ausente',
        })
      ).status,
    ).toBe(400);
    expect(
      (await request('/transactions/income', 'PATCH', { note: 3 })).status,
    ).toBe(400);
    expect(
      (await request('/transactions/ausente', 'PATCH', { note: 'Teste' }))
        .status,
    ).toBe(404);
  });
});
describe('Centavos', () => {
  it.each([
    ['0,01', 1],
    ['1234,56', 123456],
    ['-32,90', -3290],
    ['10', 1000],
    ['1,1', 110],
  ])('converte %s sem fração de centavo', (input, want) =>
    expect(parseMoney(input)).toBe(want),
  );
  it.each(['1.234,56', '1,234', 'NaN', '', '1e3', '900719925474099100'])(
    'recusa formato inválido %s',
    (input) => expect(() => parseMoney(input)).toThrow(),
  );
  it.each([1.5, '100', null, 9007199254740992])(
    'API recusa valor não inteiro seguro %s',
    async (amount) =>
      expect(
        (
          await request('/accounts/a/activate', 'POST', {
            cutoff_date: '2026-02-01',
            opening_balance_cents: amount,
          })
        ).status,
      ).toBe(400),
  );
  it('banco recusa fração de centavo', async () => {
    await expect(
      db
        .prepare("UPDATE transactions SET amount_cents=2.5 WHERE id='later'")
        .run(),
    ).rejects.toThrow();
    await expect(
      db
        .prepare("UPDATE accounts SET opening_balance_cents=2.5 WHERE id='a'")
        .run(),
    ).rejects.toThrow();
  });
});
describe('Ativação e saldo', () => {
  it('mostra o arquivo antes da ativação; prévia não altera dados', async () => {
    const accounts = await (await request('/accounts')).json();
    expect(accounts[0].balance_cents).toBe(140000);
    const preview = await request('/accounts/a/activation-preview', 'POST', {
      cutoff_date: '2026-02-01',
      opening_balance_cents: 120000,
    });
    expect(await preview.json()).toEqual({
      archive_balance_cents: 150000,
      opening_balance_cents: 120000,
      adjustment_cents: 30000,
    });
    expect(
      (
        await db
          .prepare("SELECT cutoff_date FROM accounts WHERE id='a'")
          .first()
      ).cutoff_date,
    ).toBeNull();
    expect(
      (await db.prepare('SELECT COUNT(*) AS n FROM transactions').first()).n,
    ).toBe(3);
  });
  it('grava ajuste no corte e usa abertura menos lançamentos posteriores', async () => {
    const response = await activate();
    expect(response.status).toBe(201);
    const accounts = await (await request('/accounts')).json();
    expect(accounts[0].balance_cents).toBe(110000);
    const adjustment = await db
      .prepare(
        "SELECT amount_cents,date,origin FROM transactions WHERE activation_account_id='a'",
      )
      .first();
    expect(adjustment).toEqual({
      amount_cents: 30000,
      date: '2026-02-01',
      origin: 'adjustment',
    });
    expect((await activate()).status).toBe(409);
    expect(
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS n FROM transactions WHERE origin='adjustment'",
          )
          .first()
      ).n,
    ).toBe(1);
  });
  it('suporta abertura negativa e ajuste de entrada', async () => {
    expect((await activate('a', 180000)).status).toBe(201);
    expect(
      (
        await db
          .prepare(
            "SELECT amount_cents FROM transactions WHERE origin='adjustment'",
          )
          .first()
      ).amount_cents,
    ).toBe(-30000);
    await db
      .prepare(
        "INSERT INTO accounts(id,name,kind) VALUES('b','Cartão fictício','credit_card')",
      )
      .run();
    expect(
      (
        await request('/accounts/b/activate', 'POST', {
          cutoff_date: '2026-02-01',
          opening_balance_cents: -50000,
        })
      ).status,
    ).toBe(201);
    expect(
      (await (await request('/accounts')).json()).find((a) => a.id === 'b')
        .balance_cents,
    ).toBe(-50000);
  });
  it('registra ajuste zero e não duplica ativação concorrente', async () => {
    const responses = await Promise.all([
      activate('a', 150000),
      activate('a', 150000),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      (
        await db
          .prepare(
            "SELECT amount_cents FROM transactions WHERE origin='adjustment'",
          )
          .first()
      ).amount_cents,
    ).toBe(0);
  });
  it('recusa data impossível, conta ausente e arquivada', async () => {
    expect(
      (
        await request('/accounts/a/activate', 'POST', {
          cutoff_date: '2026-02-30',
          opening_balance_cents: 0,
        })
      ).status,
    ).toBe(400);
    expect((await activate('ausente')).status).toBe(404);
    await db.prepare("UPDATE accounts SET archived=1 WHERE id='a'").run();
    expect((await activate()).status).toBe(409);
  });
});
it('combina filtros e aplica paginação sem perder registros', async () => {
  const data = await (
    await request(
      '/transactions?account=a&origin=imported&from=2026-01-01&to=2026-01-31',
    )
  ).json();
  expect(data.total).toBe(1);
  expect(data.items[0].id).toBe('income');
  expect(
    (await request('/transactions?from=2026-03-01&to=2026-01-01')).status,
  ).toBe(400);
  expect((await request('/transactions?page=-1')).status).toBe(400);
});
it('seed é repetível, cobre 14 meses e mantém edições e contas ativadas', async () => {
  const seed = seedSql();
  await db.exec(seed);
  const months = await db
    .prepare(
      "SELECT COUNT(DISTINCT substr(date,1,7)) AS n FROM transactions WHERE origin='imported' AND id LIKE 'seed-%'",
    )
    .first();
  expect(months.n).toBe(7);
  await db
    .prepare(
      "UPDATE transactions SET note='Preservar' WHERE id='seed-2025-09-salary'",
    )
    .run();
  await request('/accounts/checking/activate', 'POST', {
    cutoff_date: '2026-01-01',
    opening_balance_cents: 10000,
  });
  const count = (
    await db.prepare('SELECT COUNT(*) AS n FROM transactions').first()
  ).n;
  await db.exec(seed);
  expect(
    (await db.prepare('SELECT COUNT(*) AS n FROM transactions').first()).n,
  ).toBe(count);
  expect(
    (
      await db
        .prepare("SELECT note FROM transactions WHERE id='seed-2025-09-salary'")
        .first()
    ).note,
  ).toBe('Preservar');
  expect(
    (
      await db
        .prepare("SELECT cutoff_date FROM accounts WHERE id='checking'")
        .first()
    ).cutoff_date,
  ).toBe('2026-01-01');
  expect(
    (
      await db
        .prepare(
          "SELECT bank_amount_cents-app_amount_cents AS difference FROM statement_checks WHERE id='seed-statement-check'",
        )
        .first()
    ).difference,
  ).toBe(1420);
  await db
    .prepare(
      "UPDATE transaction_splits SET note='Parte conferida' WHERE id='seed-f-part-1'",
    )
    .run();
  await db.exec(seed);
  expect(
    (
      await db
        .prepare("SELECT note FROM transaction_splits WHERE id='seed-f-part-1'")
        .first()
    ).note,
  ).toBe('Parte conferida');
  await db
    .prepare(
      "DELETE FROM transaction_splits WHERE transaction_id='seed-f-split'",
    )
    .run();
  await db.exec(seed);
  expect(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM transaction_splits WHERE transaction_id='seed-f-split'",
        )
        .first()
    ).n,
  ).toBe(0);
});
it('reverte o ajuste se a gravação da abertura falhar', async () => {
  await db.exec(
    "CREATE TRIGGER fail_activation BEFORE UPDATE ON accounts BEGIN SELECT RAISE(ABORT,'falha simulada'); END;",
  );
  try {
    expect((await activate()).status).toBe(500);
    expect(
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS n FROM transactions WHERE origin='adjustment'",
          )
          .first()
      ).n,
    ).toBe(0);
    expect(
      (
        await db
          .prepare("SELECT cutoff_date FROM accounts WHERE id='a'")
          .first()
      ).cutoff_date,
    ).toBeNull();
  } finally {
    await db.exec('DROP TRIGGER fail_activation;');
  }
});
it('rejeita escrita de outra origem e corpo sem JSON', async () => {
  expect(
    (
      await app.request(
        'https://bfo.test/api/transactions/income',
        {
          method: 'PATCH',
          headers: {
            Origin: 'https://outro.test',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ note: 'indevida' }),
        },
        env,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await app.request(
        'https://bfo.test/api/transactions/income',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ note: 'indevida' }),
        },
        env,
      )
    ).status,
  ).toBe(415);
});

const manual = (overrides: Record<string, unknown> = {}) =>
  request('/transactions', 'POST', {
    account_id: 'a',
    date: '2026-10-01',
    amount_cents: 12345,
    payee: 'Loja fictícia',
    category_id: 'c',
    tag_ids: [],
    ...overrides,
  });
describe('Sessão B', () => {
  it('cria conta manual ativa e permite lançamento no dia da criação', async () => {
    await db
      .prepare(
        "INSERT INTO institutions(id,name) VALUES('i','Instituição fictícia')",
      )
      .run();
    const response = await request('/accounts', 'POST', {
      name: 'Conta nova',
      kind: 'checking',
      currency: 'BRL',
      institution_id: 'i',
      opening_balance_cents: 50000,
    });
    expect(response.status).toBe(201);
    const { id } = await response.json();
    const account = (await (await request('/accounts')).json()).find(
      (a) => a.id === id,
    );
    expect(account.cutoff_date).toBeTruthy();
    expect(account.balance_cents).toBe(50000);
    expect(
      (
        await manual({
          account_id: id,
          date: new Date().toISOString().slice(0, 10),
        })
      ).status,
    ).toBe(201);
  });
  it('sugere categoria e tags do lançamento mais recente do beneficiário', async () => {
    await activate();
    await db
      .prepare("INSERT INTO tags VALUES('tag','Planejado','#888888')")
      .run();
    expect(
      (await manual({ date: '2026-09-01', category_id: null })).status,
    ).toBe(201);
    expect(
      (await manual({ date: '2026-10-01', tag_ids: ['tag'] })).status,
    ).toBe(201);
    expect(
      await (
        await request('/payees/suggestion?name=loja%20fict%C3%ADcia')
      ).json(),
    ).toEqual({ category_id: 'c', tag_ids: ['tag'] });
    const filtered = await (await request('/transactions?tag=tag')).json();
    expect(filtered.total).toBe(1);
    expect(filtered.items[0].tags[0].id).toBe('tag');
    expect(
      await (await request('/payees/suggestion?name=desconhecido')).json(),
    ).toEqual({ category_id: null, tag_ids: [] });
  });
  it('usa o cache PTAX e permite cotação manual com valor original preservado', async () => {
    await activate();
    await db.prepare("UPDATE accounts SET currency='USD' WHERE id='a'").run();
    await db
      .prepare("INSERT INTO fx_rates VALUES('USD','2026-10-01',5.1234)")
      .run();
    const response = await manual({ amount_cents: 101 });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      amount_brl_cents: 517,
      fx_rate: 5.1234,
      fx_source: 'ptax',
    });
    const custom = await manual({ amount_cents: -101, fx_rate: 4.9 });
    expect(custom.status).toBe(201);
    const { id } = await custom.json();
    expect(
      await db
        .prepare(
          'SELECT amount_cents,currency,amount_brl_cents,fx_source FROM transactions WHERE id=?',
        )
        .bind(id)
        .first(),
    ).toEqual({
      amount_cents: -101,
      currency: 'USD',
      amount_brl_cents: -495,
      fx_source: 'manual',
    });
    expect((await manual({ fx_rate: 0 })).status).toBe(400);
    expect((await manual({ fx_rate: -2 })).status).toBe(400);
    expect(
      (await manual({ amount_cents: Number.MAX_SAFE_INTEGER, fx_rate: 2 }))
        .status,
    ).toBe(400);
  });
  it('conferência mostra diferença e grava ajuste visível com saldo final correto', async () => {
    await activate();
    const preview = await (
      await request('/accounts/a/reconcile', 'POST', {
        bank_balance_cents: 100000,
      })
    ).json();
    expect(preview).toEqual({
      app_balance_cents: 110000,
      bank_balance_cents: 100000,
      adjustment_cents: 10000,
    });
    expect(
      (
        await request('/accounts/a/reconcile', 'POST', {
          bank_balance_cents: 100000,
          expected_balance_cents: 110000,
          confirm: true,
        })
      ).status,
    ).toBe(201);
    const account = (await (await request('/accounts')).json())[0];
    expect(account.balance_cents).toBe(100000);
    expect(account.last_reconciled_at).toBe(
      new Date().toISOString().slice(0, 10),
    );
    const record = await db.prepare('SELECT * FROM reconciliations').first();
    expect(record.adjustment_transaction_id).toBeTruthy();
    expect(
      await db
        .prepare('SELECT origin,amount_cents FROM transactions WHERE id=?')
        .bind(record.adjustment_transaction_id)
        .first(),
    ).toEqual({ origin: 'adjustment', amount_cents: 10000 });
    expect(
      (
        await request('/accounts/a/reconcile', 'POST', {
          bank_balance_cents: 100000,
          expected_balance_cents: 110000,
          confirm: true,
        })
      ).status,
    ).toBe(409);
  });
  it('confere saldo igual sem inventar lançamento e reverte tudo em falha', async () => {
    await activate();
    expect(
      (
        await request('/accounts/a/reconcile', 'POST', {
          bank_balance_cents: 110000,
          expected_balance_cents: 110000,
          confirm: true,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await db
          .prepare(
            'SELECT COUNT(*) AS n FROM reconciliations WHERE adjustment_transaction_id IS NULL',
          )
          .first()
      ).n,
    ).toBe(1);
    await db.exec(
      "CREATE TRIGGER fail_reconciliation BEFORE UPDATE OF last_reconciled_at ON accounts BEGIN SELECT RAISE(ABORT,'falha simulada'); END;",
    );
    try {
      expect(
        (
          await request('/accounts/a/reconcile', 'POST', {
            bank_balance_cents: 100000,
            expected_balance_cents: 110000,
            confirm: true,
          })
        ).status,
      ).toBe(500);
      expect(
        (await db.prepare('SELECT COUNT(*) AS n FROM reconciliations').first())
          .n,
      ).toBe(1);
      expect((await (await request('/accounts')).json())[0].balance_cents).toBe(
        110000,
      );
    } finally {
      await db.exec('DROP TRIGGER fail_reconciliation;');
    }
  });
  it('conta encerrada sai das opções sem perder histórico e recusa lançamento', async () => {
    await activate();
    await db
      .prepare("UPDATE accounts SET closed_at='2026-10-31' WHERE id='a'")
      .run();
    expect(await (await request('/account-options')).json()).toEqual([]);
    expect((await (await request('/accounts')).json())[0].closed_at).toBe(
      '2026-10-31',
    );
    expect((await (await request('/transactions')).json()).total).toBe(4);
    expect((await manual()).status).toBe(409);
  });
  it('recusa unificação em lote que alteraria o beneficiário exibido de uma importada', async () => {
    await activate();
    await db.exec(
      "INSERT INTO payees(id,name) VALUES('original','Entrada'),('target','Nome escolhido'); INSERT INTO transactions(id,account_id,date,amount_cents,payee,payee_id,origin,kind,category_id) VALUES('linked','a','2026-05-01',100,'Entrada','original','imported','regular','c');",
    );
    expect(
      (
        await request('/payees/merge', 'POST', {
          target_id: 'target',
          source_ids: ['original'],
        })
      ).status,
    ).toBe(409);
    expect(
      (await (await request('/transactions')).json()).items.find(
        (t) => t.id === 'linked',
      ).payee,
    ).toBe('Entrada');
    expect((await manual({ payee: 'Nome manual' })).status).toBe(201);
    const source = await db
      .prepare("SELECT id FROM payees WHERE name='Nome manual'")
      .first();
    expect(
      (
        await request('/payees/merge', 'POST', {
          target_id: 'target',
          source_ids: [source.id],
        })
      ).status,
    ).toBe(200);
  });
  it('edita os níveis de categorias e tags com referências validadas', async () => {
    const tag = await request('/tags', 'POST', {
      name: 'Evento',
      color: '#123456',
    });
    expect(tag.status).toBe(201);
    const { id } = await tag.json();
    expect(
      (
        await request(`/tags/${id}`, 'PATCH', {
          name: 'Evento novo',
          color: '#ffffff',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request('/tags', 'POST', {
          name: 'Insegura',
          color: 'url(https://exemplo.test)',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request('/categories/c', 'PATCH', {
          name: 'Nova categoria',
          category_group_id: 'cg',
          is_income: 1,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request('/category-groups/cg', 'PATCH', {
          allocation_group_id: 'ausente',
        })
      ).status,
    ).toBe(400);
    expect(
      (await request('/allocation-groups/g', 'PATCH', { target_percent: 101 }))
        .status,
    ).toBe(400);
  });
});

it('consulta PTAX, guarda cache e aceita fallback manual quando a API externa falha', async () => {
  await activate();
  await db.prepare("UPDATE accounts SET currency='USD' WHERE id='a'").run();
  const external = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json({ value: [{ cotacaoVenda: 5.2 }] }));
  try {
    expect(
      await (await request('/fx?currency=USD&date=2026-10-01')).json(),
    ).toEqual({ rate: 5.2, source: 'ptax' });
    expect((await manual()).status).toBe(201);
    expect(external).toHaveBeenCalledTimes(1);
    external.mockRejectedValue(new Error('serviço indisponível'));
    expect((await request('/fx?currency=EUR&date=2026-10-01')).status).toBe(
      503,
    );
    expect((await manual({ date: '2026-10-02' })).status).toBe(400);
    const fallback = await manual({ date: '2026-10-02', fx_rate: 5.4 });
    expect(fallback.status).toBe(201);
    expect(await fallback.json()).toMatchObject({
      fx_source: 'manual',
      amount_brl_cents: 66663,
    });
  } finally {
    external.mockRestore();
  }
});

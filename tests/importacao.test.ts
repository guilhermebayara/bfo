import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';
import {
  buildImport,
  collectFromApi,
  collectTransactionPages,
  lunchMoneyCents,
  normalizeFixtures,
  wipeImportSql,
  type LunchMoneySnapshot,
} from '../src/server/lunchmoney';
import me from './fixtures/lunchmoney/me.json';
import accounts from './fixtures/lunchmoney/manual_accounts.json';
import categories from './fixtures/lunchmoney/categories.json';
import tags from './fixtures/lunchmoney/tags.json';
import recurring from './fixtures/lunchmoney/recurring_items.json';
import balances from './fixtures/lunchmoney/balance_history.json';
import budgets from './fixtures/lunchmoney/budgets-summary.json';
import page1 from './fixtures/lunchmoney/transactions.pagina-1.json';
import page2 from './fixtures/lunchmoney/transactions.pagina-2.json';

const db = env.DB as D1Database;
const files = {
  'me.json': me,
  'manual_accounts.json': accounts,
  'categories.json': categories,
  'tags.json': tags,
  'recurring_items.json': recurring,
  'balance_history.json': balances,
  'budgets-summary.json': budgets,
  'transactions.pagina-1.json': page1,
  'transactions.pagina-2.json': page2,
};
const snapshot = normalizeFixtures(files);
const plan = buildImport(snapshot);
async function exec(statements: string[]) {
  await db.exec(statements.join(';\n'));
}
async function tx(id: string) {
  return db
    .prepare('SELECT * FROM transactions WHERE id=?')
    .bind(id)
    .first<Record<string, unknown>>();
}
beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
  await exec(wipeImportSql());
  await exec(plan.statements);
});

describe('arredondamento', () => {
  it('arredonda para o centavo mais próximo, afastando o meio de zero', () => {
    expect(lunchMoneyCents('1234.5678')).toBe(123457);
    expect(lunchMoneyCents('152.3400')).toBe(15234);
    expect(lunchMoneyCents('0.0100')).toBe(1);
    expect(lunchMoneyCents('-5200.0000')).toBe(-520000);
    expect(lunchMoneyCents('1.005')).toBe(101);
    expect(lunchMoneyCents('-1.005')).toBe(-101);
    expect(lunchMoneyCents('1.004')).toBe(100);
  });
});

describe('casos do LEIA-ME', () => {
  it('define a moeda principal a partir de me.json', async () => {
    const row = await db
      .prepare(
        'SELECT primary_currency,currencies_in_use FROM preferences WHERE id=1',
      )
      .first<{ primary_currency: string; currencies_in_use: string }>();
    expect(row?.primary_currency).toBe('BRL');
    expect(JSON.parse(row!.currencies_in_use)).toEqual(
      expect.arrayContaining(['BRL', 'USD']),
    );
  });

  it('importa contas ativas como só arquivo, agrupadas por instituição', async () => {
    const rows = await db
      .prepare(
        `SELECT a.id,a.kind,a.cutoff_date,a.closed_at,i.name AS institution FROM accounts a JOIN institutions i ON i.id=a.institution_id WHERE a.id IN ('lm:account:1','lm:account:2','lm:account:5') ORDER BY a.id`,
      )
      .all<{
        kind: string;
        cutoff_date: string | null;
        closed_at: string | null;
        institution: string;
      }>();
    expect(rows.results).toEqual([
      expect.objectContaining({
        kind: 'checking',
        cutoff_date: null,
        closed_at: null,
        institution: 'Banco Aurora',
      }),
      expect.objectContaining({
        kind: 'credit_card',
        cutoff_date: null,
        institution: 'Cartões Brisa',
      }),
      expect.objectContaining({
        kind: 'investment',
        institution: 'Corretora Horizonte',
      }),
    ]);
  });

  it('guarda a conta em dólar e inclui USD nas moedas em uso', async () => {
    const row = await db
      .prepare('SELECT currency,cutoff_date FROM accounts WHERE id=?')
      .bind('lm:account:3')
      .first<{ currency: string; cutoff_date: string | null }>();
    expect(row).toEqual({ currency: 'USD', cutoff_date: null });
  });

  it('encerra a conta fechada e mantém o histórico', async () => {
    const account = await db
      .prepare('SELECT closed_at,cutoff_date FROM accounts WHERE id=?')
      .bind('lm:account:4')
      .first<{ closed_at: string; cutoff_date: string | null }>();
    expect(account).toEqual({ closed_at: '2022-06-30', cutoff_date: null });
    const movement = await tx('lm:tx:90018');
    expect(movement?.account_id).toBe('lm:account:4');
    expect(movement?.amount_cents).toBe(21000);
  });

  it('cria grupos e categorias dentro deles', async () => {
    const row = await db
      .prepare(
        'SELECT c.category_group_id,g.name AS group_name FROM categories c JOIN category_groups g ON g.id=c.category_group_id WHERE c.id=?',
      )
      .bind('lm:category:201')
      .first<{ group_name: string }>();
    expect(row?.group_name).toBe('Moradia');
  });

  it('herda as marcas do grupo e deixa a herança visível', async () => {
    const income = await db
      .prepare('SELECT * FROM effective_categories WHERE id=?')
      .bind('lm:category:204')
      .first<Record<string, number>>();
    expect(income?.is_income).toBe(0);
    expect(income?.effective_income).toBe(1);
    expect(income?.inherited_income).toBe(1);
    const movement = await db
      .prepare('SELECT * FROM effective_categories WHERE id=?')
      .bind('lm:category:205')
      .first<Record<string, number>>();
    expect(movement?.effective_exclude_budget).toBe(1);
    expect(movement?.effective_exclude_totals).toBe(1);
    expect(movement?.inherited_exclude_totals).toBe(1);
  });

  it('mantém a categoria arquivada e a categoria sem grupo', async () => {
    const archived = await db
      .prepare('SELECT archived,category_group_id FROM categories WHERE id=?')
      .bind('lm:category:206')
      .first<{ archived: number; category_group_id: string }>();
    expect(archived?.archived).toBe(1);
    expect(archived?.category_group_id).toBe('lm:group:105');
    const loose = await db
      .prepare(
        'SELECT category_group_id,exclude_totals FROM categories WHERE id=?',
      )
      .bind('lm:category:208')
      .first<{ category_group_id: string | null; exclude_totals: number }>();
    expect(loose).toEqual({ category_group_id: null, exclude_totals: 1 });
    const listed = await app.request(
      'https://bfo.test/api/categories',
      {},
      env,
    );
    const body = (await listed.json()) as {
      id: string;
      group_name: string | null;
    }[];
    expect(
      body.find((item) => item.id === 'lm:category:208')?.group_name,
    ).toBeNull();
  });

  it('não cria a tag de pagamento de fatura', async () => {
    const row = await db
      .prepare('SELECT id FROM tags WHERE name=? COLLATE NOCASE')
      .bind('Pagamento de fatura')
      .first();
    expect(row).toBeNull();
  });

  it('importa a tag arquivada', async () => {
    const row = await db
      .prepare('SELECT archived FROM tags WHERE id=?')
      .bind('lm:tag:303')
      .first<{ archived: number }>();
    expect(row?.archived).toBe(1);
  });

  it('junta as duas páginas sem repetir ids', async () => {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS total FROM transactions WHERE id LIKE 'lm:tx:%'`,
      )
      .first<{ total: number }>();
    expect(row?.total).toBe(19);
    expect(plan.report.ignoradas).toBe(1);
  });

  it('arredonda 90001 e 90021 para centavos inteiros', async () => {
    expect((await tx('lm:tx:90001'))?.amount_cents).toBe(15234);
    expect((await tx('lm:tx:90021'))?.amount_cents).toBe(123457);
  });

  it('guarda a renda como entrada e preserva um centavo', async () => {
    const income = await tx('lm:tx:90002');
    expect(income?.amount_cents).toBe(-520000);
    expect(income?.amount_brl_cents).toBe(-520000);
    expect((await tx('lm:tx:90022'))?.amount_cents).toBe(1);
  });

  it('guarda valor original, moeda e reais da conta em dólar', async () => {
    const debit = await tx('lm:tx:90003');
    expect(debit).toMatchObject({
      amount_cents: 4250,
      currency: 'USD',
      amount_brl_cents: 23175,
    });
    const credit = await tx('lm:tx:90004');
    expect(credit).toMatchObject({
      amount_cents: -1525,
      currency: 'USD',
      amount_brl_cents: -8312,
    });
  });

  it('divide 90005 em duas partes que somam o total, sem duplicar o pai', async () => {
    const parent = await tx('lm:tx:90005');
    expect(parent?.amount_cents).toBe(30000);
    expect(await tx('lm:tx:90023')).toBeNull();
    expect(await tx('lm:tx:90024')).toBeNull();
    const parts = await db
      .prepare(
        'SELECT amount_cents,category_id,note FROM transaction_splits WHERE transaction_id=? ORDER BY position',
      )
      .bind('lm:tx:90005')
      .all<{ amount_cents: number; category_id: string; note: string }>();
    expect(parts.results.map((part) => part.amount_cents)).toEqual([
      18000, 12000,
    ]);
    expect(parts.results[0].category_id).toBe('lm:category:202');
    expect(parts.results[1].note).toBe('Parte da farmácia');
    const tag = await db
      .prepare('SELECT tag_id FROM split_tags WHERE split_id=?')
      .bind('lm:split:90023')
      .first<{ tag_id: string }>();
    expect(tag?.tag_id).toBe('lm:tag:302');
  });

  it('transforma o grupo de soma zero em uma transferência', async () => {
    const source = await tx('lm:tx:90007');
    const destination = await tx('lm:tx:90008');
    expect(source).toMatchObject({
      account_id: 'lm:account:1',
      amount_cents: 100000,
      kind: 'transfer',
      transfer_pair_id: 'lm:tx:90008',
      note: 'Aporte do mês',
    });
    expect(destination).toMatchObject({
      account_id: 'lm:account:5',
      amount_cents: -100000,
      kind: 'transfer',
    });
    expect(await tx('lm:tx:90006')).toBeNull();
  });

  it('reconhece o pagamento de fatura como transferência, sem tag e sem fatura', async () => {
    const source = await tx('lm:tx:90010');
    expect(source).toMatchObject({
      account_id: 'lm:account:1',
      kind: 'transfer',
      transfer_pair_id: 'lm:tx:90011',
      statement_id: null,
    });
    expect((await tx('lm:tx:90011'))?.account_id).toBe('lm:account:2');
    const tag = await db
      .prepare('SELECT 1 AS ok FROM transaction_tags WHERE transaction_id=?')
      .bind('lm:tx:90010')
      .first();
    expect(tag).toBeNull();
    const statements = await db
      .prepare('SELECT COUNT(*) AS total FROM statements WHERE account_id=?')
      .bind('lm:account:2')
      .first<{ total: number }>();
    expect(statements?.total).toBe(0);
  });

  it('lança cada filho do grupo comum com a nota do grupo', async () => {
    expect(await tx('lm:tx:90012')).toBeNull();
    expect((await tx('lm:tx:90013'))?.note).toBe(
      'Grupo do Lunch Money: Almoço com amigos',
    );
    expect((await tx('lm:tx:90014'))?.amount_cents).toBe(3500);
    expect((await tx('lm:tx:90013'))?.amount_cents).toBe(6000);
  });

  it('liga a transação passada ao recorrente ativo', async () => {
    const link = await db
      .prepare(
        'SELECT recurring_id FROM recurring_sources WHERE transaction_id=?',
      )
      .bind('lm:tx:90015')
      .first<{ recurring_id: string }>();
    expect(link?.recurring_id).toBe('lm:recurring:702');
    const item = await db
      .prepare(
        'SELECT payee,amount_cents,is_subscription,active,next_date FROM recurring WHERE id=?',
      )
      .bind('lm:recurring:702')
      .first<Record<string, unknown>>();
    expect(item).toMatchObject({
      payee: 'Imobiliária Exemplo',
      amount_cents: 185000,
      is_subscription: 0,
      active: 1,
      next_date: '2026-11-20',
    });
    const salary = await db
      .prepare('SELECT amount_cents,active FROM recurring WHERE id=?')
      .bind('lm:recurring:701')
      .first<{ amount_cents: number; active: number }>();
    expect(salary).toEqual({ amount_cents: -520000, active: 1 });
  });

  it('ignora delete_pending', async () => {
    expect(await tx('lm:tx:90016')).toBeNull();
    expect(plan.report.ignoradas).toBe(1);
  });

  it('entra pendente como lançamento normal com a nota combinada', async () => {
    const row = await tx('lm:tx:90017');
    expect(row).toMatchObject({
      origin: 'imported',
      kind: 'regular',
      amount_cents: 7890,
      note: 'pendente no Lunch Money',
    });
    expect(plan.report.pendentes).toBe(1);
  });

  it('mantém a categoria arquivada na transação antiga', async () => {
    expect((await tx('lm:tx:90019'))?.category_id).toBe('lm:category:206');
  });

  it('guarda o reembolso fora dos totais', async () => {
    expect((await tx('lm:tx:90020'))?.category_id).toBe('lm:category:208');
    const marks = await db
      .prepare(
        'SELECT effective_exclude_totals FROM effective_categories WHERE id=?',
      )
      .bind('lm:category:208')
      .first<{ effective_exclude_totals: number }>();
    expect(marks?.effective_exclude_totals).toBe(1);
    expect((await tx('lm:tx:90020'))?.amount_cents).toBe(-4000);
  });

  it('guarda a tag arquivada e o external_id de origem', async () => {
    const row = await tx('lm:tx:90025');
    expect(row?.external_id).toBe('ext-0001');
    const tag = await db
      .prepare('SELECT tag_id FROM transaction_tags WHERE transaction_id=?')
      .bind('lm:tx:90025')
      .first<{ tag_id: string }>();
    expect(tag?.tag_id).toBe('lm:tag:303');
    const ignored = await db
      .prepare('SELECT id FROM recurring WHERE id=?')
      .bind('lm:recurring:703')
      .first();
    expect(ignored).toBeNull();
  });

  it('guarda saldos e orçamentos sem expor na API da fase 1', async () => {
    const balance = await db
      .prepare('SELECT COUNT(*) AS total FROM imported_balances')
      .first<{ total: number }>();
    const budget = await db
      .prepare('SELECT COUNT(*) AS total FROM imported_budgets')
      .first<{ total: number }>();
    expect(balance?.total).toBe(15);
    expect(budget?.total).toBe(8);
    const usd = await db
      .prepare(
        'SELECT balance_cents,currency FROM imported_balances WHERE account_id=? AND date=?',
      )
      .bind('lm:account:3', '2026-10-31')
      .first<{ balance_cents: number; currency: string }>();
    expect(usd).toEqual({ balance_cents: 83050, currency: 'USD' });
    const health = await app.request('https://bfo.test/api/health', {}, env);
    expect(health.status).toBe(200);
    const body = JSON.stringify(
      await (
        await app.request('https://bfo.test/api/accounts', {}, env)
      ).json(),
    );
    expect(body).not.toContain('imported_balances');
  });

  it('resume a carga sem nomes e sem valores', () => {
    expect(plan.report).toMatchObject({
      contas: 5,
      instituicoes: 4,
      grupos: 5,
      categorias: 9,
      tags: 2,
      lancamentos: 15,
      transferencias: 1,
      pagamentos_de_fatura: 1,
      divisoes: 1,
      recorrentes: 2,
      recorrentes_ignorados: 1,
      historicos_de_saldo: 15,
      meses_de_orcamento: 8,
      ignoradas: 1,
      pendentes: 1,
      nao_mapeados: [],
    });
    expect(JSON.stringify(plan.report)).not.toMatch(
      /Mercado|5200|Aurora|pessoa@/i,
    );
  });
});

describe('apagar, refazer e idempotência', () => {
  it('a segunda carga não duplica e preserva classificação editada', async () => {
    await db
      .prepare('UPDATE categories SET name=? WHERE id=?')
      .bind('Mercado editado', 'lm:category:202')
      .run();
    await exec(plan.statements);
    const count = await db
      .prepare(
        `SELECT COUNT(*) AS total FROM transactions WHERE id LIKE 'lm:tx:%'`,
      )
      .first<{ total: number }>();
    expect(count?.total).toBe(19);
    const name = await db
      .prepare('SELECT name FROM categories WHERE id=?')
      .bind('lm:category:202')
      .first<{ name: string }>();
    expect(name?.name).toBe('Mercado editado');
  });

  it('apaga só a importação e o que depende dela', async () => {
    await db
      .prepare(
        `INSERT INTO accounts(id,name,kind,currency,cutoff_date) VALUES('manual-k','Conta manual da sessão','checking','BRL','2026-01-01')`,
      )
      .run();
    await db
      .prepare(
        `INSERT INTO transactions(id,account_id,date,amount_cents,payee,origin,kind,currency,fx_rate,amount_brl_cents,fx_source) VALUES('manual-k-tx','manual-k','2026-11-02',4321,'Lançamento manual da sessão','manual','regular','BRL',1,4321,'manual')`,
      )
      .run();
    await exec(wipeImportSql());
    const imported = await db
      .prepare(
        `SELECT COUNT(*) AS total FROM transactions WHERE id LIKE 'lm:%' OR external_id LIKE 'lm:%' OR external_id='ext-0001'`,
      )
      .first<{ total: number }>();
    expect(imported?.total).toBe(0);
    const manual = await tx('manual-k-tx');
    expect(manual?.payee).toBe('Lançamento manual da sessão');
    const balances = await db
      .prepare('SELECT COUNT(*) AS total FROM imported_balances')
      .first<{ total: number }>();
    expect(balances?.total).toBe(0);
    await exec(plan.statements);
    const again = await db
      .prepare(
        `SELECT COUNT(*) AS total FROM transactions WHERE id LIKE 'lm:tx:%'`,
      )
      .first<{ total: number }>();
    expect(again?.total).toBe(19);
    expect((await tx('manual-k-tx'))?.amount_cents).toBe(4321);
  });
});

describe('coleta paginada', () => {
  it('percorre as páginas enquanto has_more for verdadeiro', async () => {
    const pages = [page1, page2];
    const rows = await collectTransactionPages(async (offset) => {
      const page = pages[offset === 0 ? 0 : 1];
      return { transactions: page.transactions, has_more: page.has_more };
    });
    expect(rows).toHaveLength(25);
    expect(new Set(rows.map((row) => row.id)).size).toBe(25);
  });

  it('lista um item sem correspondência no relatório', () => {
    const extra: LunchMoneySnapshot = {
      ...snapshot,
      manual_accounts: [
        ...(snapshot.manual_accounts ?? []),
        {
          id: 99,
          name: 'Conta sem tipo',
          type: 'employee compensation',
          currency: 'brl',
        },
      ],
    };
    const mapped = buildImport(extra);
    expect(mapped.report.contas).toBe(5);
    expect(mapped.report.nao_mapeados).toEqual([
      {
        tipo: 'conta',
        id: '99',
        motivo: 'Tipo ou moeda sem correspondência.',
      },
    ]);
  });

  it('repete depois de 429 e não devolve o token na falha', async () => {
    const secret = 'token-secreto-de-teste';
    let meCalls = 0;
    const snapshot = await collectFromApi({
      token: secret,
      sleep: async () => {},
      now: () => 1_000,
      fetchImpl: async (input) => {
        const path = String(input).replace('https://api.lunchmoney.dev/v2', '');
        if (path === '/me') {
          meCalls += 1;
          if (meCalls === 1) {
            return new Response('', {
              status: 429,
              headers: { 'retry-after': '1' },
            });
          }
          return Response.json({ primary_currency: 'brl' });
        }
        if (path.startsWith('/transactions')) {
          return Response.json({ transactions: [], has_more: false });
        }
        const bodies: Record<string, unknown> = {
          '/manual_accounts': { manual_accounts: [] },
          '/plaid_accounts': { plaid_accounts: [] },
          '/categories?format=flattened': { categories: [] },
          '/tags': { tags: [] },
          '/recurring_items': { recurring_items: [] },
          '/balance_history': { balance_history: [] },
          '/budgets/summary': { budgets: [] },
        };
        return Response.json(bodies[path] ?? {});
      },
    });
    expect(snapshot.me.primary_currency).toBe('brl');
    expect(meCalls).toBe(2);
    await expect(
      collectFromApi({
        token: secret,
        sleep: async () => {},
        fetchImpl: async () => {
          throw new Error(`Authorization Bearer ${secret}`);
        },
      }),
    ).rejects.toThrow('Falha na coleta.');
  });
});

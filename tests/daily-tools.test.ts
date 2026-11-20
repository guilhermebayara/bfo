import { beforeAll, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';

const db = env.DB as D1Database;
const request = (path: string, day = '2026-11-15') =>
  app.request(
    `https://bfo.test/api${path}`,
    { headers: { 'X-BFO-Data': day } },
    env,
  );

type Row = {
  id: string;
  amount_cents: number;
  total_amount_cents: number;
  running_balance_cents?: number;
  running_balance_state?: string;
};
async function transactions(query: string, day?: string) {
  const response = await request('/transactions?' + query, day);
  expect(response.status, await response.clone().text()).toBe(200);
  return response.json<{
    items: Row[];
    total: number;
    total_amount_cents?: number;
    previous_balance_cents?: number;
  }>();
}

beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
  const sql = `
    INSERT INTO accounts(id,name,kind,cutoff_date,opening_balance_cents) VALUES
      ('daily-a','Conta fictícia A','checking','2026-11-01',10000),
      ('daily-b','Conta fictícia B','checking','2026-11-01',2000),
      ('daily-card','Cartão fictício','credit_card','2026-11-01',0),
      ('daily-csv','Conta fictícia CSV','checking','2026-11-01',0);
    INSERT INTO allocation_groups(id,name,target_percent) VALUES('daily-allocation','Fictício',0);
    INSERT INTO category_groups(id,name,allocation_group_id) VALUES
      ('daily-group','Casa fictícia','daily-allocation'),('daily-other','Outro grupo fictício','daily-allocation');
    INSERT INTO categories(id,name,category_group_id,is_income,exclude_totals) VALUES
      ('daily-income','Renda fictícia','daily-group',1,0),('daily-food','Comida fictícia','daily-group',0,0),
      ('daily-rent','Aluguel fictício','daily-group',0,0),('daily-excluded','Fora dos totais fictícia','daily-group',0,1),
      ('daily-other-expense','Outra despesa fictícia','daily-other',0,0);
    INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status) VALUES
      ('daily-old','daily-card','2026-09-21','2026-10-20','2026-11-02','closed'),
      ('daily-statement','daily-card','2026-10-21','2026-11-20','2026-12-02','open');
    INSERT INTO statement_carryovers(source_statement_id,destination_statement_id,amount_cents) VALUES
      ('daily-old','daily-statement',600);
    INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,category_id,origin,kind,statement_id,card_amount_cents) VALUES
      ('daily-income-row','daily-a','2026-11-12',-5000,-5000,'Renda fictícia','daily-income','manual','regular',NULL,NULL),
      ('daily-excluded-row','daily-a','2026-11-13',1000,1000,'Excluída fictícia','daily-excluded','imported','regular',NULL,NULL),
      ('daily-a-split','daily-a','2026-11-15',1500,1500,'Divisão fictícia','daily-food','manual','regular',NULL,NULL),
      ('daily-future','daily-a','2026-11-22',400,400,'Prevista fictícia','daily-rent','manual','regular',NULL,NULL),
      ('daily-legacy','daily-card','2026-10-25',1200,1200,'Compra antiga fictícia','daily-food','imported','regular',NULL,NULL),
      ('daily-moved','daily-card','2026-11-23',2400,2400,'Parcela movida fictícia','daily-rent','manual','installment','daily-statement',NULL),
      ('daily-charge','daily-card','2026-11-11',1700,1700,'Compra fictícia','daily-food','manual','regular','daily-statement',NULL),
      ('daily-payment','daily-b','2026-11-14',700,700,'Pagamento fictício',NULL,'manual','card_payment','daily-old',700),
      ('daily-x-out','daily-a','2026-11-15',600,600,'Transferência fictícia',NULL,'manual','transfer',NULL,NULL),
      ('daily-x-in','daily-b','2026-11-15',-600,-600,'Transferência fictícia',NULL,'manual','transfer',NULL,NULL);
    UPDATE transactions SET transfer_pair_id='daily-x-in' WHERE id='daily-x-out';
    UPDATE transactions SET transfer_pair_id='daily-x-out' WHERE id='daily-x-in';
    INSERT INTO transaction_splits(id,transaction_id,position,amount_cents,amount_brl_cents,category_id) VALUES
      ('daily-part-a','daily-a-split',0,700,700,'daily-food'),
      ('daily-part-b','daily-a-split',1,500,500,'daily-other-expense'),
      ('daily-part-c','daily-a-split',2,300,300,'daily-excluded');
    WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<51)
    INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,origin,kind)
      SELECT 'daily-csv-'||n,'daily-csv','2026-11-15',123,123,'Compra fictícia','manual','regular' FROM seq;
  `;
  await db.batch(
    sql
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => db.prepare(statement)),
  );
});

it('bate renda, despesas, grupo e categoria com as linhas e as partes que compõem cada total', async () => {
  const result = await request('/month-summary?month=2026-11');
  const summary = await result.json<
    {
      category_id: string;
      group_id: string;
      is_income: number;
      amount_cents: number;
    }[]
  >();
  for (const [filter, predicate, expected] of [
    [
      'summary=income',
      (r: (typeof summary)[number]) => r.is_income === 1,
      5000,
    ],
    [
      'summary=expense',
      (r: (typeof summary)[number]) => r.is_income === 0,
      3300 + 51 * 123,
    ],
    [
      'summary=expense&group=daily-group',
      (r: (typeof summary)[number]) =>
        r.is_income === 0 && r.group_id === 'daily-group',
      2800,
    ],
    [
      'summary=expense&group=daily-group&category=daily-food',
      (r: (typeof summary)[number]) => r.category_id === 'daily-food',
      2400,
    ],
  ] as const) {
    const rows = await transactions(`month=2026-11&${filter}`);
    const nextPage =
      rows.total > 50
        ? (await transactions(`month=2026-11&${filter}&page=2`)).items
        : [];
    expect(
      summary.filter(predicate).reduce((n, r) => n + r.amount_cents, 0),
    ).toBe(expected);
    expect(rows.total_amount_cents).toBe(expected);
    expect(
      [...rows.items, ...nextPage].reduce(
        (n, r) => n + r.total_amount_cents,
        0,
      ),
    ).toBe(expected);
    expect(rows.items.map((row) => row.id)).not.toContain('daily-excluded-row');
  }
  const december = await transactions('month=2026-12&summary=expense');
  expect(december.items).toMatchObject([
    { id: 'daily-moved', total_amount_cents: 2400 },
  ]);
});

it('mostra compras reais do ciclo incluindo compra antiga e parcela movida, com o saldo anterior explícito', async () => {
  const query = 'month=2026-11&account=daily-card&statement=daily-statement';
  const purchases = await transactions(query);
  const invoice = await transactions(query + '&statementTotal=1');
  expect(purchases.items.map((t) => t.id)).toEqual([
    'daily-moved',
    'daily-charge',
    'daily-legacy',
  ]);
  expect(purchases.items.reduce((n, t) => n + t.amount_cents, 0)).toBe(5300);
  expect(purchases.total_amount_cents).toBe(5300);
  expect(invoice.previous_balance_cents).toBe(600);
  expect(invoice.total_amount_cents).toBe(5900);
});

it('reconcilia o saldo corrido das duas pontas, do cartão e da previsão com Contas', async () => {
  const list = async (account: string, day?: string) =>
    transactions('month=2026-11&account=' + account, day);
  const accountBalances = async (day?: string) =>
    Object.fromEntries(
      (
        await (
          await request('/accounts', day)
        ).json<{ id: string; balance_cents: number }[]>()
      ).map((a) => [a.id, a.balance_cents]),
    );
  const balances = await accountBalances();
  const a = await list('daily-a');
  expect(a.items.slice(0, 3)).toMatchObject([
    {
      id: 'daily-future',
      running_balance_cents: 11500,
      running_balance_state: 'forecast',
    },
    { id: 'daily-a-split', running_balance_cents: 11900 },
    { id: 'daily-x-out', running_balance_cents: 13400 },
  ]);
  expect(a.items[1].running_balance_cents).toBe(balances['daily-a']);
  expect((await list('daily-b')).items[0]).toMatchObject({
    id: 'daily-x-out',
    running_balance_cents: 1900,
  });
  expect(balances['daily-b']).toBe(1900);
  const card = await list('daily-card');
  expect(card.items[1]).toMatchObject({
    id: 'daily-payment',
    running_balance_cents: -1000,
  });
  expect(card.items[1].running_balance_cents).toBe(balances['daily-card']);
  const now = await transactions(
    'month=2026-12&account=daily-a&balance=current',
  );
  expect(now.items).toHaveLength(4);
  expect(now.items[0].running_balance_cents).toBe(balances['daily-a']);
  const arrived = await list('daily-a', '2026-11-22');
  expect(arrived.items[0].running_balance_state).toBeNull();
  expect(arrived.items[0].running_balance_cents).toBe(
    (await accountBalances('2026-11-22'))['daily-a'],
  );
  expect(
    (await transactions('month=2026-11&account=daily-a&search=Prevista'))
      .items[0].running_balance_cents,
  ).toBeUndefined();
});

it('exporta todas as páginas, uma vez por transação, inclusive divisão e transferência', async () => {
  const all = await request(
    '/transactions.csv?month=2026-11&account=daily-csv',
  );
  expect(all.status).toBe(200);
  expect((await all.text()).trimEnd().split('\r\n')).toHaveLength(52);
  const singleAccount = await request(
    '/transactions.csv?month=2026-11&account=daily-a',
  );
  const lines = (await singleAccount.text()).trimEnd().split('\r\n');
  expect(lines.filter((line) => line.includes('Transferência'))).toEqual([
    '15/11/2026;Conta fictícia A;Transferência;;;6,00;BRL;6,00;;;Manual;;Conta fictícia B',
  ]);
  expect(lines.filter((line) => line.includes('Divisão fictícia'))).toEqual([
    expect.stringContaining(
      ';Comida fictícia, Fora dos totais fictícia, Outra despesa fictícia;Casa fictícia, Outro grupo fictício;-15,00;BRL;-15,00;;;Manual;Dividida;',
    ),
  ]);
});

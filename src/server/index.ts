import { Hono } from 'hono';
import { convertBetween } from '../shared/money';
import { splitAmounts } from '../shared/splits';
import {
  matchRecurring,
  shiftMonth,
  validMonth,
  monthBounds,
  datesInMonth,
  nextOccurrence,
  monthlyEquivalent,
  renewalSoon,
} from '../shared/recurring';
import type { Recurring } from '../shared/types';
import { ptax } from './fx';
import { installmentAmount, statementCycle, today } from './statements';
import type { Account, Statement, Transaction } from '../shared/types';
type Bindings = {
  DB: D1Database;
  DB_HOMOLOGACAO?: D1Database;
  ASSETS: Fetcher;
  ALLOW_TEST_CLOCK?: string;
};
const app = new Hono<{
  Bindings: Bindings;
  Variables: { DB: D1Database; today: string };
}>();
class InputError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}
const fail = (message: string, status: 400 | 404 | 409 = 400): never => {
  throw new InputError(message, status);
};
function date(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    return fail('Data inválida.');
  return value;
}
function cents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value))
    return fail('O valor deve ser um inteiro em centavos.');
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('Corpo inválido.');
  return value as Record<string, unknown>;
}
function keys(body: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(body).some((k) => !allowed.includes(k)))
    fail('Campo não permitido para este registro.');
}
app.onError((error, c) => {
  if (error instanceof InputError)
    return c.json({ error: error.message }, error.status);
  if (error instanceof SyntaxError)
    return c.json({ error: 'JSON inválido.' }, 400);
  if (String(error.cause ?? error).includes('Fatura já fechada.'))
    return c.json(
      { error: 'Uma das faturas deste lançamento já foi fechada.' },
      409,
    );
  if (
    /NOT NULL constraint failed: transactions.amount_cents|Transação importada:/.test(
      String(error.cause ?? error),
    )
  )
    return c.json(
      {
        error:
          'A transação mudou durante a edição. Confira os valores e tente novamente.',
      },
      409,
    );
  if (String(error.cause ?? error).includes('CHECK constraint failed: valid=1'))
    return c.json(
      {
        error: 'A fatura mudou durante a operação. Atualize e tente novamente.',
      },
      409,
    );
  if (String(error.cause ?? error).includes('UNIQUE constraint failed'))
    return c.json({ error: 'Já existe um registro com esse nome.' }, 409);
  console.error('Falha interna na operação D1.');
  return c.json(
    { error: 'Não foi possível concluir a operação. Tente novamente.' },
    500,
  );
});
app.use('/api/*', async (c, next) => {
  const url = new URL(c.req.url);
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.req.method)) {
    const origin = c.req.header('Origin');
    if (origin && origin !== url.origin)
      return c.json({ error: 'Origem não permitida.' }, 403);
    if (
      !c.req
        .header('Content-Type')
        ?.toLowerCase()
        .startsWith('application/json')
    )
      return c.json({ error: 'Envie JSON.' }, 415);
  }
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  // O cabeçalho só vale no teste. Em produção a variável não existe e o dia real permanece.
  const pinned = c.req.header('x-bfo-data');
  const localHost =
    url.hostname === '127.0.0.1' ||
    url.hostname === 'localhost' ||
    url.hostname === 'bfo.test' ||
    c.env.ALLOW_TEST_CLOCK === '1';
  c.set(
    'today',
    localHost &&
      pinned &&
      /^\d{4}-\d{2}-\d{2}$/.test(pinned) &&
      new Date(`${pinned}T00:00:00Z`).toISOString().slice(0, 10) === pinned
      ? pinned
      : today(),
  );
  const db =
    url.hostname === 'homologacao.bfo.bayara.design'
      ? c.env.DB_HOMOLOGACAO
      : c.env.DB;
  if (!db) throw new Error('Binding D1 ausente para este endereço.');
  c.set('DB', db);
  await next();
});
app.get('/api/health', async (c) => {
  await c.var.DB.prepare('SELECT 1').first();
  return c.json({ ok: true });
});
const balanceSql = (day: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail('Data inválida.');
  return `CASE WHEN a.cutoff_date IS NULL THEN
 -COALESCE((SELECT SUM(t.amount_cents) FROM account_movements t WHERE t.account_id=a.id AND t.date<='${day}'),0)
 ELSE a.opening_balance_cents-COALESCE((SELECT SUM(t.amount_cents) FROM account_movements t WHERE t.account_id=a.id AND t.date>a.cutoff_date AND t.date<='${day}'),0) END`;
};
app.get('/api/accounts', async (c) => {
  const { results } = await c.var.DB.prepare(
    `SELECT a.*, i.name AS institution_name, ${balanceSql(c.var.today)} AS balance_cents FROM accounts a LEFT JOIN institutions i ON i.id=a.institution_id ORDER BY i.sort,i.name,a.name`,
  ).all<Account>();
  return c.json(results);
});
app.get('/api/account-options', async (c) =>
  c.json(
    (
      await c.var.DB.prepare(
        'SELECT id,name,currency FROM accounts WHERE closed_at IS NULL AND archived=0 ORDER BY name',
      ).all()
    ).results,
  ),
);
app.get('/api/categories', async (c) =>
  c.json(
    (
      await c.var.DB.prepare(
        'SELECT c.*, g.name AS group_name, ag.name AS allocation_name FROM effective_categories c LEFT JOIN category_groups g ON g.id=c.category_group_id LEFT JOIN allocation_groups ag ON ag.id=g.allocation_group_id ORDER BY COALESCE(g.sort,9999),c.sort,c.name',
      ).all()
    ).results,
  ),
);
app.get('/api/transactions', async (c) => {
  const query = c.req.query();
  const conditions: string[] = [
    '(t.advance_id IS NULL OR t.installment_number IS NULL)',
    "(t.kind<>'transfer' OR t.transfer_pair_id IS NULL OR t.amount_cents>0)",
    'NOT EXISTS(SELECT 1 FROM installment_cancellations ic WHERE ic.transaction_id=t.id)',
  ];
  const params: string[] = [];
  if (query.month) {
    if (!validMonth(query.month)) fail('Mês inválido.');
    const bounds = monthBounds(query.month);
    conditions.push('t.date>=? AND t.date<=?');
    params.push(bounds.from, bounds.to);
  }
  for (const [key, column] of [
    ['account', 'account_id'],
    ['category', 'category_id'],
    ['origin', 'origin'],
  ] as const)
    if (query[key]) {
      conditions.push(
        key === 'category'
          ? '(CASE WHEN EXISTS(SELECT 1 FROM transaction_splits WHERE transaction_id=t.id) THEN EXISTS(SELECT 1 FROM transaction_splits WHERE transaction_id=t.id AND category_id=?) ELSE t.category_id=? END)'
          : key === 'account'
            ? "(t.account_id=? OR (t.kind='card_payment' AND EXISTS(SELECT 1 FROM statements s WHERE s.id=t.statement_id AND s.account_id=?)) OR (t.kind='transfer' AND EXISTS(SELECT 1 FROM transactions pair WHERE pair.id=t.transfer_pair_id AND pair.account_id=?)))"
            : `t.${column}=?`,
      );
      params.push(query[key]);
      if (key === 'category' || key === 'account') params.push(query[key]);
      if (key === 'account') params.push(query[key]);
    }
  if (
    query.origin &&
    !['manual', 'imported', 'adjustment'].includes(query.origin)
  )
    fail('Origem inválida.');
  if (query.tag) {
    conditions.push(
      '(CASE WHEN EXISTS(SELECT 1 FROM transaction_splits WHERE transaction_id=t.id) THEN EXISTS(SELECT 1 FROM transaction_splits p JOIN split_tags st ON st.split_id=p.id WHERE p.transaction_id=t.id AND st.tag_id=?) ELSE EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id=t.id AND tt.tag_id=?) END)',
    );
    params.push(query.tag, query.tag);
  }
  if (query.search) {
    conditions.push(
      '(t.payee LIKE ? OR t.note LIKE ? OR EXISTS(SELECT 1 FROM payees p LEFT JOIN payees canonical ON canonical.id=p.merged_into_id WHERE p.id=t.payee_id AND COALESCE(canonical.name,p.name) LIKE ?))',
    );
    params.push(...Array(3).fill(`%${query.search.slice(0, 200)}%`));
  }
  if (query.from) {
    conditions.push('t.date>=?');
    params.push(date(query.from));
  }
  if (query.to) {
    conditions.push('t.date<=?');
    params.push(date(query.to));
  }
  if (query.from && query.to && query.from > query.to)
    fail('O início do período deve ser anterior ao fim.');
  const page = Number(query.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000)
    fail('Página inválida.');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = await c.var.DB.prepare(
    `SELECT COUNT(*) AS count FROM transactions t ${where}`,
  )
    .bind(...params)
    .first<{ count: number }>();
  const { results } = await c.var.DB.prepare(
    `SELECT t.*, COALESCE((SELECT a.name FROM transactions pair JOIN accounts a ON a.id=pair.account_id WHERE pair.id=t.transfer_pair_id),(SELECT a.name FROM statements s JOIN accounts a ON a.id=s.account_id WHERE s.id=t.statement_id AND t.kind='card_payment')) AS destination_name, COALESCE((SELECT pair.account_id FROM transactions pair WHERE pair.id=t.transfer_pair_id),(SELECT s.account_id FROM statements s WHERE s.id=t.statement_id AND t.kind='card_payment')) AS destination_account_id, COALESCE((SELECT pair.amount_cents FROM transactions pair WHERE pair.id=t.transfer_pair_id),-t.card_amount_cents) AS destination_amount_cents, COALESCE((SELECT pair.currency FROM transactions pair WHERE pair.id=t.transfer_pair_id),(SELECT a.currency FROM statements s JOIN accounts a ON a.id=s.account_id WHERE s.id=t.statement_id AND t.kind='card_payment')) AS destination_currency, (SELECT status FROM statements WHERE id=t.statement_id OR (t.statement_id IS NULL AND t.kind='regular' AND t.origin<>'adjustment' AND account_id=t.account_id AND t.date BETWEEN period_start AND closing_date) LIMIT 1) AS statement_status, (SELECT COUNT(*) FROM transaction_splits WHERE transaction_id=t.id) AS split_count, ip.count AS installment_count, CASE WHEN t.origin='imported' THEN t.payee ELSE COALESCE(canonical.name,p.name,t.payee) END AS payee, COALESCE(p.merged_into_id,p.id) AS payee_id, a.name AS account_name, ag.name AS allocation_name, (SELECT json_group_array(json_object('id',tags.id,'name',tags.name,'color',tags.color)) FROM transaction_tags tt JOIN tags ON tags.id=tt.tag_id WHERE tt.transaction_id=t.id) AS tags_json FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN installment_plans ip ON ip.id=t.installment_plan_id LEFT JOIN payees p ON p.id=t.payee_id LEFT JOIN payees canonical ON canonical.id=p.merged_into_id LEFT JOIN categories cat ON cat.id=t.category_id LEFT JOIN category_groups cg ON cg.id=cat.category_group_id LEFT JOIN allocation_groups ag ON ag.id=cg.allocation_group_id ${where} ORDER BY t.date DESC,t.id LIMIT 50 OFFSET ?`,
  )
    .bind(...params, (page - 1) * 50)
    .all();
  const tagged = results.map(({ tags_json, ...t }) => ({
    ...t,
    tags: JSON.parse(String(tags_json)),
  }));
  return c.json({ items: tagged, total: total!.count, page, page_size: 50 });
});
async function cardCalendar(
  db: D1Database,
  card: Pick<Account, 'id' | 'closing_day' | 'due_day'>,
) {
  const rows = (
    await db
      .prepare('SELECT * FROM statements WHERE account_id=?')
      .bind(card.id)
      .all<Statement>()
  ).results;
  const scheduled = new Map(
    rows.map((s) => [s.scheduled_closing_date ?? s.closing_date, s]),
  );
  return {
    statements: scheduled,
    resolve(day: string, offset = 0, respectEarly = true) {
      const base = statementCycle(day, card.closing_day!, card.due_day!);
      const shortened = scheduled.get(base.closingDate);
      const shift =
        respectEarly && shortened && day > shortened.closing_date ? 1 : 0;
      const cycle = statementCycle(
        day,
        card.closing_day!,
        card.due_day!,
        offset + shift,
      );
      const scheduledClosingDate = cycle.closingDate,
        existing = scheduled.get(scheduledClosingDate);
      if (existing) {
        cycle.periodStart = existing.period_start;
        cycle.closingDate = existing.closing_date;
        cycle.dueDate = existing.due_date;
      } else {
        const previous = statementCycle(
            day,
            card.closing_day!,
            card.due_day!,
            offset + shift - 1,
          ),
          early = scheduled.get(previous.closingDate);
        if (early && early.closing_date < previous.closingDate)
          cycle.periodStart = new Date(
            Date.parse(early.closing_date) + 86400000,
          )
            .toISOString()
            .slice(0, 10);
      }
      if (offset)
        cycle.date = [
          cycle.periodStart,
          cycle.date,
          cycle.closingDate,
        ].sort()[1];
      return { ...cycle, scheduledClosingDate };
    },
  };
}
async function resolvedCycle(
  db: D1Database,
  card: Pick<Account, 'id' | 'closing_day' | 'due_day'>,
  day: string,
  offset = 0,
  respectEarly = true,
) {
  return (await cardCalendar(db, card)).resolve(day, offset, respectEarly);
}
function insertCycle(
  db: D1Database,
  account: string,
  cycle: Awaited<ReturnType<typeof resolvedCycle>>,
  id: string = `cycle:${account}:${cycle.scheduledClosingDate}`,
) {
  return db
    .prepare(
      "INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status,scheduled_closing_date) VALUES(?,?,?,?,?,'open',?) ON CONFLICT DO NOTHING",
    )
    .bind(
      id,
      account,
      cycle.periodStart,
      cycle.closingDate,
      cycle.dueDate,
      cycle.scheduledClosingDate,
    );
}
function validatedNote(value: unknown) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 2000)
    return fail('Nota deve ter até 2000 caracteres.');
  return value;
}
async function validatedTags(
  db: D1Database,
  value: unknown,
): Promise<string[]> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50)
    return fail('Tags inválidas.');
  const tags = [...new Set(value)] as string[];
  for (const id of tags) await exists(db, 'tags', id);
  return tags;
}
app.post('/api/transfers', async (c) => {
  const b = object(await c.req.json()),
    db = c.var.DB;
  keys(b, [
    'account_id',
    'destination_account_id',
    'date',
    'amount_cents',
    'fx_rate',
    'destination_fx_rate',
    'note',
    'tag_ids',
  ]);
  const day = date(b.date),
    amount = cents(b.amount_cents);
  if (amount <= 0) fail('Informe um valor positivo.');
  if (day > c.var.today) fail('A data está no futuro.');
  const source = await db
    .prepare(
      "SELECT * FROM accounts WHERE id=? AND kind IN ('checking','cash') AND closed_at IS NULL AND archived=0 AND cutoff_date<?",
    )
    .bind(text(b.account_id, 'Origem'), day)
    .first<Account>();
  const dest = await db
    .prepare(
      "SELECT * FROM accounts WHERE id=? AND kind<>'credit_card' AND closed_at IS NULL AND archived=0 AND cutoff_date<?",
    )
    .bind(text(b.destination_account_id, 'Destino'), day)
    .first<Account>();
  if (!source || !dest || source.id === dest.id)
    return fail(
      'Escolha contas ativas e diferentes. Para cartão, selecione uma fatura.',
    );
  const tags = await validatedTags(db, b.tag_ids);
  const note = validatedNote(b.note);
  const q = await fx(db, source.currency, day, b.fx_rate);
  const dq =
    source.currency === dest.currency
      ? q
      : await fx(db, dest.currency, day, b.destination_fx_rate);
  const destAmount = converted(amount, q.rate, dq.rate);
  if (destAmount <= 0) fail('O valor convertido é menor que um centavo.');
  const id = crypto.randomUUID(),
    pair = crypto.randomUUID();
  const insert = (
    tx: string,
    account: Account,
    value: number,
    quote: { rate: number; source: string },
    other: string,
  ) =>
    db
      .prepare(
        "INSERT INTO transactions(id,account_id,date,amount_cents,currency,fx_rate,amount_brl_cents,fx_source,payee,origin,kind,transfer_pair_id,category_id,note) VALUES(?,?,?,?,?,?,?,?,?,'manual','transfer',?,'transfer',?)",
      )
      .bind(
        tx,
        account.id,
        day,
        value,
        account.currency,
        quote.rate,
        converted(value, quote.rate),
        quote.source,
        'Transferência',
        other,
        note,
      );
  await db.batch([
    insert(id, source, amount, q, pair),
    insert(pair, dest, -destAmount, dq, id),
    ...[id, pair].flatMap((tx) =>
      tags.map((tag) =>
        db.prepare('INSERT INTO transaction_tags VALUES(?,?)').bind(tx, tag),
      ),
    ),
  ]);
  return c.json({ id }, 201);
});
app.get('/api/preferences', async (c) => {
  const p = (await c.var.DB.prepare(
    'SELECT default_account_id,primary_currency,currencies_in_use FROM preferences WHERE id=1',
  ).first())!;
  return c.json({
    ...p,
    currencies_in_use: JSON.parse(String(p.currencies_in_use)),
  });
});
app.patch('/api/preferences', async (c) => {
  const b = object(await c.req.json()),
    db = c.var.DB;
  keys(b, ['default_account_id', 'primary_currency', 'currencies_in_use']);
  const old = (await db
    .prepare(
      'SELECT default_account_id,primary_currency,currencies_in_use FROM preferences WHERE id=1',
    )
    .first())!;
  const account =
    'default_account_id' in b ? b.default_account_id : old.default_account_id;
  if (account !== null) {
    const a = await db
      .prepare(
        "SELECT id FROM accounts WHERE id=? AND kind IN ('checking','credit_card','cash') AND closed_at IS NULL AND archived=0 AND cutoff_date IS NOT NULL",
      )
      .bind(account)
      .first();
    if (!a) fail('Escolha uma conta de movimento ativa.');
  }
  const primary = currency(b.primary_currency ?? old.primary_currency);
  const used = b.currencies_in_use ?? JSON.parse(String(old.currencies_in_use));
  if (
    !Array.isArray(used) ||
    !used.length ||
    used.some((v) => typeof v !== 'string')
  )
    fail('Escolha as moedas em uso.');
  const codes = [...new Set((used as string[]).map(currency))];
  if (!codes.includes(primary) || !codes.includes('BRL'))
    fail('Inclua a moeda principal e BRL nas moedas em uso.');
  const existing = (
    await db
      .prepare('SELECT DISTINCT currency FROM accounts')
      .all<{ currency: string }>()
  ).results;
  if (existing.some((a) => !codes.includes(a.currency)))
    fail('Uma moeda de conta cadastrada deve permanecer em uso.');
  await db
    .prepare(
      'UPDATE preferences SET default_account_id=?,primary_currency=?,currencies_in_use=? WHERE id=1',
    )
    .bind(account, primary, JSON.stringify(codes))
    .run();
  return c.json({ ok: true });
});
app.patch('/api/accounts/:id', async (c) => {
  const b = object(await c.req.json()),
    db = c.var.DB;
  keys(b, ['name', 'currency', 'credit_limit_cents']);
  await exists(db, 'accounts', c.req.param('id'));
  const writes: D1PreparedStatement[] = [];
  if ('name' in b)
    writes.push(
      db
        .prepare('UPDATE accounts SET name=? WHERE id=?')
        .bind(text(b.name), c.req.param('id')),
    );
  if ('currency' in b) {
    const code = currency(b.currency);
    const a = await db
      .prepare('SELECT currency,opening_balance_cents FROM accounts WHERE id=?')
      .bind(c.req.param('id'))
      .first();
    if (
      code !== a!.currency &&
      (a!.opening_balance_cents !== 0 ||
        (await db
          .prepare('SELECT 1 FROM transactions WHERE account_id=? LIMIT 1')
          .bind(c.req.param('id'))
          .first()))
    )
      fail('Conta com saldo ou histórico mantém a moeda original.', 409);
    const p = (await db
      .prepare('SELECT currencies_in_use FROM preferences WHERE id=1')
      .first())!;
    if (!JSON.parse(String(p.currencies_in_use)).includes(code))
      fail('Escolha uma moeda em uso.');

    writes.push(
      db
        .prepare('UPDATE accounts SET currency=? WHERE id=?')
        .bind(code, c.req.param('id')),
    );
  }
  if ('credit_limit_cents' in b) {
    const a = await db
      .prepare('SELECT kind FROM accounts WHERE id=?')
      .bind(c.req.param('id'))
      .first();
    if (a?.kind !== 'credit_card')
      fail('Limite disponível apenas para cartão.');
    const limit =
      b.credit_limit_cents === null ? null : cents(b.credit_limit_cents);
    if (limit !== null && limit < 0) fail('Limite inválido.');
    writes.push(
      db
        .prepare('UPDATE accounts SET credit_limit_cents=? WHERE id=?')
        .bind(limit, c.req.param('id')),
    );
  }
  if (!writes.length) fail('Informe os campos.');
  await db.batch(writes);
  return c.json({ ok: true });
});
app.get('/api/month-summary', async (c) => {
  const month = c.req.query('month') ?? c.var.today.slice(0, 7);
  if (!validMonth(month)) fail('Mês inválido.');
  const rows = await c.var.DB.prepare(
    `SELECT t.category_id,COALESCE(cat.name,'Sem categoria') AS category_name,COALESCE(g.name,'Sem grupo') AS group_name,t.is_income,t.exclude_budget,
    SUM(CASE WHEN t.is_income=1 THEN -t.amount_brl_cents ELSE t.amount_brl_cents END) AS amount_cents
    FROM monthly_totals t LEFT JOIN categories cat ON cat.id=t.category_id LEFT JOIN category_groups g ON g.id=cat.category_group_id
    WHERE t.spending_month=? GROUP BY t.category_id,t.is_income,t.exclude_budget ORDER BY t.is_income DESC,g.sort,g.name,cat.name`,
  )
    .bind(month)
    .all();
  return c.json(rows.results);
});
app.post('/api/transactions/batch', async (c) => {
  const db = c.var.DB,
    b = object(await c.req.json());
  keys(b, [
    'ids',
    'changes',
    'add_tag_ids',
    'remove_tag_ids',
    'recurring_id',
    'delete',
  ]);
  if (
    !Array.isArray(b.ids) ||
    !b.ids.length ||
    b.ids.length > 50 ||
    b.ids.some((id) => typeof id !== 'string')
  )
    fail('Selecione de 1 a 50 transações.');
  const ids = [...new Set(b.ids as string[])];
  const changes = b.changes === undefined ? {} : object(b.changes);
  keys(changes, ['date', 'payee', 'category_id', 'note']);
  if (b.delete !== undefined && b.delete !== true) fail('Exclusão inválida.');
  if (
    !b.delete &&
    !Object.keys(changes).length &&
    !b.add_tag_ids &&
    !b.remove_tag_ids &&
    !('recurring_id' in b)
  )
    fail('Escolha uma alteração.');
  if (
    b.delete &&
    (Object.keys(changes).length ||
      b.add_tag_ids ||
      b.remove_tag_ids ||
      'recurring_id' in b)
  )
    fail('Exclusão deve ser feita separadamente.');
  const tagLists: Record<string, string[]> = {};
  for (const key of ['add_tag_ids', 'remove_tag_ids']) {
    const list = b[key] ?? [];
    if (!Array.isArray(list) || list.length > 50) fail('Tags inválidas.');
    for (const tag of list as string[]) await exists(db, 'tags', tag);
    tagLists[key] = list as string[];
  }
  const writes: D1PreparedStatement[] = [];
  for (const id of ids) {
    const t = await db
      .prepare('SELECT * FROM transactions WHERE id=?')
      .bind(id)
      .first<import('../shared/types').Transaction>();
    if (!t) fail('Transação não encontrada.', 404);
    if (b.delete) {
      if (t!.origin !== 'manual' || t!.kind !== 'regular')
        fail('Só lançamentos manuais comuns podem ser excluídos.', 409);
      const closed = await db
        .prepare(
          "SELECT 1 FROM statements WHERE status<>'open' AND (id=? OR (account_id=? AND ? BETWEEN period_start AND closing_date))",
        )
        .bind(t!.statement_id, t!.account_id, t!.date)
        .first();
      if (closed) fail('Fatura fechada: exclusão protegida.', 409);
      writes.push(
        db
          .prepare(
            "UPDATE transactions SET amount_cents=CASE WHEN origin='manual' AND kind='regular' AND date IS ? AND amount_cents IS ? AND NOT EXISTS(SELECT 1 FROM statements WHERE status<>'open' AND (id=transactions.statement_id OR (account_id=transactions.account_id AND transactions.date BETWEEN period_start AND closing_date))) THEN amount_cents ELSE NULL END WHERE id=?",
          )
          .bind(t!.date, t!.amount_cents, id),
      );
      writes.push(db.prepare('DELETE FROM transactions WHERE id=?').bind(id));
      continue;
    }
    const parts = await db
      .prepare(
        'SELECT id FROM transaction_splits WHERE transaction_id=? ORDER BY position',
      )
      .bind(id)
      .all<{ id: string }>();
    const patch = { ...changes };
    if (parts.results.length && 'category_id' in patch) {
      if (patch.category_id !== null)
        await exists(db, 'categories', patch.category_id);
      writes.push(
        db
          .prepare(
            'UPDATE transaction_splits SET category_id=? WHERE transaction_id=?',
          )
          .bind(patch.category_id, id),
      );
      delete patch.category_id;
    }
    const targets = parts.results.length
      ? parts.results.map((p) => p.id)
      : [id];
    if (b.add_tag_ids || b.remove_tag_ids) {
      if (!parts.results.length) {
        const tags = await db
          .prepare('SELECT tag_id FROM transaction_tags WHERE transaction_id=?')
          .bind(id)
          .all<{ tag_id: string }>();
        patch.tag_ids = [
          ...new Set([
            ...tags.results.map((t) => t.tag_id),
            ...tagLists.add_tag_ids,
          ]),
        ].filter((t) => !tagLists.remove_tag_ids.includes(t));
      } else
        for (const target of targets) {
          for (const tag of tagLists.remove_tag_ids)
            writes.push(
              db
                .prepare('DELETE FROM split_tags WHERE split_id=? AND tag_id=?')
                .bind(target, tag),
            );
          for (const tag of tagLists.add_tag_ids)
            writes.push(
              db
                .prepare('INSERT OR IGNORE INTO split_tags VALUES(?,?)')
                .bind(target, tag),
            );
        }
    }
    if (Object.keys(patch).length)
      writes.push(...(await prepareTransactionPatch(db, id, patch)));
    if ('recurring_id' in b) {
      if (t!.kind !== 'regular' || t!.origin === 'adjustment')
        fail('Escolha uma transação comum para ligar ao recorrente.');
      if (b.recurring_id !== null) {
        if (typeof b.recurring_id !== 'string') fail('Recorrente inválido.');
        const r = await db
          .prepare('SELECT account_id FROM recurring WHERE id=?')
          .bind(b.recurring_id)
          .first();
        if (!r || r.account_id !== t!.account_id)
          fail('O recorrente deve pertencer à mesma conta.');
      }
      writes.push(
        db
          .prepare('DELETE FROM recurring_sources WHERE transaction_id=?')
          .bind(id),
      );
      if (b.recurring_id !== null)
        writes.push(
          db
            .prepare('INSERT INTO recurring_sources VALUES(?,?)')
            .bind(b.recurring_id, id),
        );
    }
  }
  if (writes.length) await db.batch(writes);
  return c.json({ ok: true, count: ids.length });
});

async function prepareTransactionPatch(
  db: D1Database,
  id: string,
  body: Record<string, unknown>,
) {
  const t = await db
    .prepare('SELECT * FROM transactions WHERE id=?')
    .bind(id)
    .first<import('../shared/types').Transaction>();
  if (!t) return fail('Transação não encontrada.', 404);
  const split = await db
    .prepare('SELECT 1 FROM transaction_splits WHERE transaction_id=?')
    .bind(t.id)
    .first();
  if (
    split &&
    [
      'account_id',
      'date',
      'amount_cents',
      'fx_rate',
      'category_id',
      'tag_ids',
    ].some((k) => k in body)
  )
    fail(
      'Desfaça a divisão antes de alterar valor, data, conta ou classificação.',
      409,
    );
  const editable = t.origin === 'manual' && t.kind === 'regular';
  keys(
    body,
    editable
      ? [
          'category_id',
          'note',
          'account_id',
          'date',
          'amount_cents',
          'payee',
          'tag_ids',
          'fx_rate',
        ]
      : t.origin === 'imported'
        ? ['category_id', 'note', 'tag_ids']
        : t.origin === 'manual' &&
            ['transfer', 'card_payment', 'installment'].includes(t.kind)
          ? ['category_id', 'note', 'tag_ids']
          : ['category_id', 'note'],
  );
  if (!Object.keys(body).length) fail('Informe os campos.');
  for (const field of [
    'account_id',
    'date',
    'amount_cents',
    'payee',
    'fx_rate',
  ])
    if (field in body && body[field] === null)
      fail('Campo obrigatório não pode ser nulo.');
  const update: Record<string, unknown> = {};
  if ('category_id' in body) {
    if (
      t.kind === 'card_payment' ||
      (t.origin === 'adjustment' && t.statement_id)
    )
      fail('A categoria deste lançamento é protegida.');
    if (body.category_id !== null)
      await exists(db, 'categories', body.category_id);
    update.category_id = body.category_id;
  }
  if ('note' in body) {
    if (typeof body.note !== 'string' || body.note.length > 2000)
      fail('Nota deve ter até 2000 caracteres.');
    update.note = body.note;
  }
  const writes: D1PreparedStatement[] = [];
  const financial = [
    'account_id',
    'date',
    'amount_cents',
    'payee',
    'fx_rate',
  ].some((k) => k in body);
  if (financial) {
    {
      const st = await db
        .prepare(
          "SELECT status FROM statements WHERE id=? OR (? IS NULL AND account_id=? AND ? BETWEEN period_start AND closing_date AND status<>'open') ORDER BY status LIMIT 1",
        )
        .bind(t.statement_id, t.statement_id, t.account_id, t.date)
        .first();
      if (st && st.status !== 'open')
        fail('Uma das faturas deste lançamento já foi fechada.', 409);
    }
    const account = await db
      .prepare('SELECT * FROM accounts WHERE id=?')
      .bind(body.account_id ?? t.account_id)
      .first<Account>();
    if (
      !account ||
      account.closed_at ||
      account.archived ||
      !account.cutoff_date
    )
      fail('Escolha uma conta ativa.');
    if (!['checking', 'credit_card', 'cash'].includes(account!.kind))
      fail('Conta de saldo recebe transferências.');
    const day = date(body.date ?? t.date);
    if (day <= account!.cutoff_date!)
      fail('O lançamento deve ser posterior ao corte.');
    const amount = cents(body.amount_cents ?? t.amount_cents);
    if (!amount) fail('Informe valor diferente de zero.');
    const name = text(body.payee ?? t.payee, 'Beneficiário');
    const q =
      !('fx_rate' in body) && account!.currency === t.currency && day === t.date
        ? { rate: t.fx_rate, source: t.fx_source }
        : await fx(db, account!.currency, day, body.fx_rate);
    let statement: string | null = null;
    if (account!.kind === 'credit_card') {
      if (!account!.closing_day || !account!.due_day)
        fail('Configure o cartão.');
      const cycle = await resolvedCycle(db, account!, day);
      const existing = await db
        .prepare(
          'SELECT id,status FROM statements WHERE account_id=? AND scheduled_closing_date=?',
        )
        .bind(account!.id, cycle.scheduledClosingDate)
        .first<{ id: string; status: string }>();
      if (existing && existing.status !== 'open')
        fail('Uma das faturas deste lançamento já foi fechada.', 409);
      statement =
        existing?.id ?? `cycle:${account!.id}:${cycle.scheduledClosingDate}`;
      writes.push(insertCycle(db, account!.id, cycle, statement));
    }
    writes.push(
      db
        .prepare(
          'INSERT INTO payees(id,name) VALUES(?,?) ON CONFLICT(name) DO NOTHING',
        )
        .bind(crypto.randomUUID(), name),
    );
    Object.assign(update, {
      account_id: account!.id,
      date: day,
      amount_cents: amount,
      payee: name,
      currency: account!.currency,
      fx_rate: q.rate,
      fx_source: q.source,
      amount_brl_cents: converted(amount, q.rate),
      statement_id: statement,
    });
    // O nome pode ser novo; o vínculo é resolvido dentro do mesmo batch.
    writes.push(
      db
        .prepare(
          'UPDATE transactions SET payee_id=(SELECT COALESCE(merged_into_id,id) FROM payees WHERE name=? COLLATE NOCASE) WHERE id=?',
        )
        .bind(name, t.id),
    );
  }
  if ('tag_ids' in body) {
    if (!Array.isArray(body.tag_ids) || body.tag_ids.length > 50)
      fail('Tags inválidas.');
    const tags = [...new Set(body.tag_ids as string[])];
    for (const id of tags) await exists(db, 'tags', id);
    writes.push(
      db
        .prepare('DELETE FROM transaction_tags WHERE transaction_id=?')
        .bind(t.id),
    );
    for (const tag of tags)
      writes.push(
        db.prepare('INSERT INTO transaction_tags VALUES(?,?)').bind(t.id, tag),
      );
  }
  if (Object.keys(update).length)
    writes.push(
      db
        .prepare(
          `UPDATE transactions SET ${Object.keys(update)
            .map((k) => `${k}=?`)
            .join(',')} WHERE id=?`,
        )
        .bind(...Object.values(update), t.id),
    );
  if (t.kind === 'transfer') {
    const pair = await db
      .prepare('SELECT transfer_pair_id FROM transactions WHERE id=?')
      .bind(t.id)
      .first<{ transfer_pair_id: string }>();
    if (pair?.transfer_pair_id) {
      for (const key of ['category_id', 'note'] as const)
        if (key in update)
          writes.push(
            db
              .prepare(`UPDATE transactions SET ${key}=? WHERE id=?`)
              .bind(update[key], pair.transfer_pair_id),
          );
      if ('tag_ids' in body) {
        writes.push(
          db
            .prepare('DELETE FROM transaction_tags WHERE transaction_id=?')
            .bind(pair.transfer_pair_id),
        );
        for (const tag of body.tag_ids as string[])
          writes.push(
            db
              .prepare('INSERT OR IGNORE INTO transaction_tags VALUES(?,?)')
              .bind(pair.transfer_pair_id, tag),
          );
      }
    }
  }
  if (writes.length) {
    // A validação faz parte do batch: evita que duas edições sobrescrevam valores lidos antes da outra.
    // Uma divergência viola NOT NULL e desfaz todo o batch, inclusive tags e beneficiário.
    const snapshot = [
      'account_id',
      'date',
      'amount_cents',
      'amount_brl_cents',
      'currency',
      'fx_rate',
      'fx_source',
      'payee',
      'category_id',
      'note',
      'statement_id',
    ] as const;
    writes.unshift(
      db
        .prepare(
          `UPDATE transactions SET amount_cents=CASE WHEN ${snapshot.map((key) => `${key} IS ?`).join(' AND ')} THEN amount_cents ELSE NULL END WHERE id=?`,
        )
        .bind(...snapshot.map((key) => t[key]), t.id),
    );
  }
  return writes;
}
app.patch('/api/transactions/:id', async (c) => {
  const writes = await prepareTransactionPatch(
    c.var.DB,
    c.req.param('id'),
    object(await c.req.json()),
  );
  if (writes.length) await c.var.DB.batch(writes);
  return c.json({ ok: true });
});

async function activation(
  db: D1Database,
  id: string,
  body: Record<string, unknown>,
  day: string,
) {
  keys(body, ['cutoff_date', 'opening_balance_cents', 'fx_rate']);
  const cutoff = date(body.cutoff_date);
  if (cutoff > day) fail('A data de corte não pode estar no futuro.');
  const opening = cents(body.opening_balance_cents);
  const account = await db
    .prepare('SELECT * FROM accounts WHERE id=?')
    .bind(id)
    .first<Account>();
  if (!account) return fail('Conta não encontrada.', 404);
  if (account.cutoff_date) fail('Esta conta já está ativa.', 409);
  if (account.archived || account.closed_at)
    fail('Conta arquivada não pode ser ativada.', 409);
  const archive = await db
    .prepare(
      'SELECT -COALESCE(SUM(amount_cents),0) AS balance FROM account_movements WHERE account_id=? AND date<=?',
    )
    .bind(id, cutoff)
    .first<{ balance: number }>();
  const adjustment = archive!.balance - opening;
  cents(archive!.balance);
  cents(adjustment);
  const q = await fx(db, account.currency, cutoff, body.fx_rate);
  const brl = converted(adjustment, q.rate);
  return { cutoff, opening, archive: archive!.balance, adjustment, q, brl };
}
app.post('/api/accounts/:id/activation-preview', async (c) => {
  const a = await activation(
    c.var.DB,
    c.req.param('id'),
    object(await c.req.json()),
    c.var.today,
  );
  return c.json({
    archive_balance_cents: a.archive,
    opening_balance_cents: a.opening,
    adjustment_cents: a.adjustment,
  });
});
app.post('/api/accounts/:id/activate', async (c) => {
  const body = object(await c.req.json());
  const accountId = c.req.param('id');
  const a = await activation(c.var.DB, accountId, body, c.var.today);
  const id = crypto.randomUUID();
  // O batch valida que o saldo do arquivo continua igual antes de gravar o ajuste.
  const result = await c.var.DB.batch([
    c.var.DB.prepare(
      `INSERT INTO transactions (id,account_id,date,amount_cents,payee,note,origin,kind,activation_account_id,currency,fx_rate,amount_brl_cents,fx_source)
   SELECT ?,a.id,?,?,
   'Ajuste de abertura','Diferença entre o arquivo e o saldo de abertura informado.','adjustment','regular',a.id,a.currency,?,?,?
   FROM accounts a WHERE a.id=? AND a.cutoff_date IS NULL AND a.archived=0 AND a.closed_at IS NULL
   AND (SELECT -COALESCE(SUM(amount_cents),0) FROM account_movements WHERE account_id=a.id AND date<=?)=?`,
    ).bind(
      id,
      a.cutoff,
      a.adjustment,
      a.q.rate,
      a.brl,
      a.q.source,
      accountId,
      a.cutoff,
      a.archive,
    ),
    c.var.DB.prepare(
      `UPDATE accounts SET cutoff_date=?,opening_balance_cents=? WHERE id=? AND cutoff_date IS NULL AND EXISTS (SELECT 1 FROM transactions WHERE id=?)`,
    ).bind(a.cutoff, a.opening, accountId, id),
  ]);
  if (result[1].meta.changes !== 1)
    fail('A conta ou o saldo do arquivo mudou. Confira novamente.', 409);
  return c.json({ ok: true, adjustment_id: id }, 201);
});
function text(value: unknown, label = 'Nome', max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    return fail(`${label} inválido.`);
  return value.trim();
}
function currency(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value))
    return fail('Moeda inválida.');
  return value;
}
async function exists(db: D1Database, table: string, id: unknown) {
  if (
    typeof id !== 'string' ||
    !(await db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(id).first())
  )
    fail('Referência não encontrada.');
}
async function quote(db: D1Database, code: string, day: string) {
  if (code === 'BRL') return 1;
  const cached = await db
    .prepare('SELECT rate FROM fx_rates WHERE currency=? AND date=?')
    .bind(code, day)
    .first<{ rate: number }>();
  if (cached) return cached.rate;
  const rate = await ptax(code, day);
  await db
    .prepare(
      'INSERT INTO fx_rates(currency,date,rate) VALUES(?,?,?) ON CONFLICT(currency,date) DO NOTHING',
    )
    .bind(code, day, rate)
    .run();
  return rate;
}
async function fx(db: D1Database, code: string, day: string, manual: unknown) {
  if (manual !== undefined) {
    if (
      typeof manual !== 'number' ||
      !Number.isFinite(manual) ||
      manual <= 0 ||
      manual > 1000000
    )
      fail('Cotação inválida.');
    if (code === 'BRL' && manual !== 1) fail('A cotação de BRL deve ser 1.');
    return { rate: manual as number, source: 'manual' };
  }
  if (code === 'BRL') return { rate: 1, source: 'manual' };
  try {
    return { rate: await quote(db, code, day), source: 'ptax' };
  } catch {
    return fail('PTAX indisponível. Informe a cotação manualmente.');
  }
}
function converted(amount: number, rate: number, toRate = 1) {
  try {
    return convertBetween(amount, rate, toRate);
  } catch {
    return fail('Valor convertido fora do limite.');
  }
}
app.get('/api/fx', async (c) => {
  const code = currency(c.req.query('currency'));
  const day = date(c.req.query('date'));
  try {
    return c.json({ rate: await quote(c.var.DB, code, day), source: 'ptax' });
  } catch {
    return c.json(
      {
        rate: null,
        error: 'PTAX indisponível. Preencha a cotação manualmente.',
      },
      503,
    );
  }
});
app.get('/api/institutions', async (c) =>
  c.json(
    (
      await c.var.DB.prepare(
        'SELECT * FROM institutions ORDER BY sort,name',
      ).all()
    ).results,
  ),
);
app.post('/api/accounts', async (c) => {
  const b = object(await c.req.json());
  keys(b, [
    'name',
    'kind',
    'currency',
    'institution_id',
    'opening_balance_cents',
    'closing_day',
    'due_day',
    'credit_limit_cents',
  ]);
  const name = text(b.name);
  const pref = (await c.var.DB.prepare(
    'SELECT primary_currency,currencies_in_use FROM preferences WHERE id=1',
  ).first())!;
  const code = currency(b.currency ?? pref.primary_currency);
  if (!JSON.parse(String(pref.currencies_in_use)).includes(code))
    fail('Escolha uma moeda em uso.');
  if (
    ![
      'checking',
      'credit_card',
      'cash',
      'investment',
      'property',
      'loan',
    ].includes(String(b.kind))
  )
    fail('Tipo inválido.');
  await exists(c.var.DB, 'institutions', b.institution_id);
  const opening = cents(b.opening_balance_cents ?? 0);
  for (const field of ['closing_day', 'due_day'])
    if (
      b[field] != null &&
      (!Number.isInteger(b[field]) ||
        Number(b[field]) < 1 ||
        Number(b[field]) > 31)
    )
      fail('Dia inválido.');
  if (b.kind === 'credit_card' && (b.closing_day == null || b.due_day == null))
    fail('Informe os dias de fechamento e vencimento do cartão.');
  const limit =
    b.credit_limit_cents == null ? null : cents(b.credit_limit_cents);
  if (limit !== null && (limit < 0 || b.kind !== 'credit_card'))
    fail('Limite inválido.');
  const id = crypto.randomUUID();
  // Corte no dia anterior permite lançamentos no próprio dia da criação.
  await c.var.DB.prepare(
    "INSERT INTO accounts(id,name,kind,currency,institution_id,opening_balance_cents,cutoff_date,closing_day,due_day,credit_limit_cents) VALUES(?,?,?,?,?,?,date(?,'-1 day'),?,?,?)",
  )
    .bind(
      id,
      name,
      b.kind,
      code,
      b.institution_id,
      opening,
      c.var.today,
      b.closing_day ?? null,
      b.due_day ?? null,
      limit,
    )
    .run();
  return c.json({ id }, 201);
});
app.post('/api/installment-preview', async (c) => {
  const db = c.var.DB,
    b = object(await c.req.json());
  keys(b, [
    'account_id',
    'date',
    'count',
    'current',
    'amount_cents',
    'per_part',
  ]);
  const day = date(b.date),
    count = cents(b.count),
    current = cents(b.current),
    amount = cents(b.amount_cents);
  if (
    count < 2 ||
    count > 120 ||
    current < 1 ||
    current > count ||
    amount <= 0 ||
    (b.per_part !== true && b.per_part !== false)
  )
    fail('Preencha os dados das parcelas.');
  const card = await db
    .prepare(
      "SELECT * FROM accounts WHERE id=? AND kind='credit_card' AND archived=0 AND closed_at IS NULL AND cutoff_date IS NOT NULL",
    )
    .bind(text(b.account_id))
    .first<Account>();
  if (!card) return fail('Escolha um cartão ativo.');
  const total = cents(b.per_part ? amount * count : amount);
  if (total < count) fail('Cada parcela deve ter pelo menos um centavo.');
  const calendar = await cardCalendar(db, card);
  const rows = [];
  for (let i = 0; i < count; i++) {
    const cycle = calendar.resolve(day, i + 1 - current);
    const st = calendar.statements.get(cycle.scheduledClosingDate);
    rows.push({
      number: i + 1,
      date: cycle.date,
      due_date: cycle.dueDate,
      amount_cents: installmentAmount(total, count, i),
      retroactive: i + 1 < current,
      before_cutoff: cycle.date <= card.cutoff_date!,
      closed: !!st && st.status !== 'open',
    });
  }
  return c.json({ total_cents: total, rows });
});

app.post('/api/transactions', async (c) => {
  const b = object(await c.req.json());
  keys(b, [
    'account_id',
    'date',
    'amount_cents',
    'payee',
    'category_id',
    'note',
    'tag_ids',
    'fx_rate',
    'installment_count',
    'installment_current',
    'installment_amount_cents',
  ]);
  if (typeof b.account_id !== 'string') fail('Conta inválida.');
  const day = date(b.date);
  const count = cents(b.installment_count ?? 1);
  const current = cents(b.installment_current ?? 1);
  const perPart =
    b.installment_amount_cents === undefined
      ? null
      : cents(b.installment_amount_cents);
  if (current < 1 || current > count || count < 1 || count > 120)
    fail('Parcela atual inválida.');
  const amount = cents(perPart === null ? b.amount_cents : perPart * count);
  if (
    perPart !== null &&
    (perPart < 1 || count < 2 || b.amount_cents !== undefined)
  )
    fail('Informe o valor da parcela e o total de parcelas.');
  if (!amount) fail('Informe valor diferente de zero.');
  const name = text(b.payee, 'Beneficiário');
  const account = await c.var.DB.prepare('SELECT * FROM accounts WHERE id=?')
    .bind(b.account_id)
    .first<Account>();
  if (!account) fail('Conta não encontrada.', 404);
  if (account!.closed_at || account!.archived) fail('Conta encerrada.', 409);
  if (!account!.cutoff_date) fail('Ative a conta antes de lançar.', 409);
  if (count === 1 && day <= account!.cutoff_date!)
    fail('O lançamento deve ser posterior ao corte.');
  if (b.category_id != null)
    await exists(c.var.DB, 'categories', b.category_id);
  if (
    b.note !== undefined &&
    (typeof b.note !== 'string' || b.note.length > 2000)
  )
    fail('Nota inválida.');
  if (
    !Array.isArray(b.tag_ids ?? []) ||
    ((b.tag_ids as unknown[]) ?? []).length > 50
  )
    fail('Tags inválidas.');
  const tags = [...new Set((b.tag_ids ?? []) as string[])];
  for (const id of tags) await exists(c.var.DB, 'tags', id);
  if (!['checking', 'cash', 'credit_card'].includes(account!.kind))
    fail('Conta de saldo recebe transferências.');
  const card = account!.kind === 'credit_card';
  if (count < 1 || count > 120 || (count > 1 && (!card || amount < count)))
    fail(
      'Informe de 2 a 120 parcelas para uma compra no cartão, com pelo menos um centavo por parcela.',
    );
  if (card && (!account!.closing_day || !account!.due_day))
    fail('O cartão precisa de dias de fechamento e vencimento.', 409);

  const db = c.var.DB;
  const planId = count > 1 ? crypto.randomUUID() : null;
  // A compra usa a cotação do dia em que foi feita, inclusive para as parcelas futuras.
  const q = await fx(db, account!.currency, day, b.fx_rate);
  const totalBrl = converted(amount, q.rate);
  const writes = [
    db
      .prepare(
        'INSERT INTO payees(id,name) VALUES(?,?) ON CONFLICT(name) DO NOTHING',
      )
      .bind(crypto.randomUUID(), name),
  ];
  if (planId)
    writes.push(
      db
        .prepare(
          'INSERT INTO installment_plans(id,account_id,description,total_cents,count,first_date,category_id) VALUES(?,?,?,?,?,?,?)',
        )
        .bind(
          planId,
          account!.id,
          name,
          amount,
          count,
          statementCycle(
            day,
            account!.closing_day!,
            account!.due_day!,
            1 - current,
          ).date,
          b.category_id ?? null,
        ),
    );

  const entries = [];
  const calendar = card ? await cardCalendar(db, account!) : null;
  let allocatedBrl = 0;
  let allocatedNative = 0;
  for (let i = 0; i < count; i++) {
    const cycle = card ? calendar!.resolve(day, i + 1 - current) : null;
    const part = installmentAmount(amount, count, i);
    allocatedNative += part;
    const cumulative = converted(allocatedNative, q.rate);
    entries.push({
      id: crypto.randomUUID(),
      cycle,
      date: cycle?.date ?? day,
      retroactive: Number(
        Boolean(planId) && (cycle?.date ?? day) <= account!.cutoff_date!,
      ),
      allowClosed: Number(Boolean(planId) && (current > 1 || perPart !== null)),
      amount: part,
      brl: cumulative - allocatedBrl,
      number: planId ? i + 1 : null,
    });
    allocatedBrl = cumulative;
  }
  const payload = JSON.stringify(entries);
  if (card)
    writes.push(
      db
        .prepare(
          `INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status,scheduled_closing_date)
     SELECT 'cycle:'||?1||':'||(value->>'$.cycle.scheduledClosingDate'),?1,value->>'$.cycle.periodStart',value->>'$.cycle.closingDate',value->>'$.cycle.dueDate','open',value->>'$.cycle.scheduledClosingDate'
     FROM json_each(?2) WHERE true ON CONFLICT DO NOTHING`,
        )
        .bind(account!.id, payload),
    );
  writes.push(
    db
      .prepare(
        `INSERT INTO transactions(id,account_id,date,amount_cents,currency,fx_rate,amount_brl_cents,fx_source,payee,payee_id,category_id,note,origin,kind,statement_id,installment_plan_id,installment_number,retroactive,added_to_closed)
     SELECT entry.value->>'id',?,entry.value->>'date',entry.value->>'amount',?,?,entry.value->>'brl',?,?,
       COALESCE(p.merged_into_id,p.id),?,?,'manual',?,s.id,?,entry.value->>'number',entry.value->>'retroactive',CASE WHEN s.status<>'open' AND entry.value->>'allowClosed'=1 THEN 1 ELSE 0 END
     FROM json_each(?) entry CROSS JOIN payees p
     LEFT JOIN statements s ON s.account_id=? AND s.scheduled_closing_date=entry.value->>'$.cycle.scheduledClosingDate'
     WHERE p.name=? COLLATE NOCASE`,
      )
      .bind(
        account!.id,
        account!.currency,
        q.rate,
        q.source,
        name,
        b.category_id ?? null,
        b.note ?? '',
        planId ? 'installment' : 'regular',
        planId,
        payload,
        account!.id,
        name,
      ),
  );
  if (tags.length)
    writes.push(
      db
        .prepare(
          `INSERT INTO transaction_tags(transaction_id,tag_id)
     SELECT entry.value->>'id', tag.value FROM json_each(?) entry CROSS JOIN json_each(?) tag`,
        )
        .bind(payload, JSON.stringify(tags)),
    );
  await db.batch(writes);
  return c.json(
    {
      id: entries[0].id,
      installment_plan_id: planId,
      amount_brl_cents: totalBrl,
      fx_rate: q.rate,
      fx_source: q.source,
    },
    201,
  );
});
app.get('/api/installment-plans/:id', async (c) => {
  const db = c.var.DB;
  const plan = await db
    .prepare(
      'SELECT p.*,a.currency FROM installment_plans p JOIN accounts a ON a.id=p.account_id WHERE p.id=?',
    )
    .bind(c.req.param('id'))
    .first();
  if (!plan) return fail('Compra parcelada não encontrada.', 404);
  const { results } = await db
    .prepare(
      'SELECT t.id,t.date,t.amount_cents,t.amount_brl_cents,t.note,t.installment_number,t.retroactive,t.added_to_closed,t.advance_id,(SELECT reason FROM installment_cancellations WHERE transaction_id=t.id) AS cancelled_reason,s.due_date,s.closing_date,s.status,s.id AS statement_id FROM transactions t LEFT JOIN statements s ON s.id=t.statement_id WHERE t.installment_plan_id=? ORDER BY t.date,t.id',
    )
    .bind(plan.id)
    .all();
  const advances = await db
    .prepare(
      'SELECT * FROM installment_advances WHERE installment_plan_id=? ORDER BY created_at,id',
    )
    .bind(plan.id)
    .all();
  const discount = advances.results.reduce(
    (sum, a) => sum + Number(a.face_cents) - Number(a.paid_cents),
    0,
  );
  const card = (await db
    .prepare('SELECT * FROM accounts WHERE id=?')
    .bind(plan.account_id)
    .first<Account>())!;
  const cycle = await resolvedCycle(db, card, c.var.today);
  return c.json({
    plan,
    installments: results,
    advances: advances.results,
    real_cost_cents: Number(
      (await db
        .prepare(
          'SELECT COALESCE(SUM(amount_cents),0) AS total FROM active_transactions WHERE installment_plan_id=?',
        )
        .bind(plan.id)
        .first())!.total,
    ),
    current_closing_date: cycle.closingDate,
  });
});

app.post('/api/installment-plans/:id/advance', async (c) => {
  const db = c.var.DB;
  const b = object(await c.req.json());
  keys(b, ['count', 'paid_cents', 'expected_face_cents', 'fx_rate']);
  const count = cents(b.count),
    paid = cents(b.paid_cents);
  if (count < 1 || count > 120 || paid < 0) fail('Antecipação inválida.');
  const plan = await db
    .prepare(
      'SELECT p.*,a.currency,a.closing_day,a.due_day,a.cutoff_date,a.closed_at,a.archived FROM installment_plans p JOIN accounts a ON a.id=p.account_id WHERE p.id=?',
    )
    .bind(c.req.param('id'))
    .first();
  if (!plan) return fail('Compra parcelada não encontrada.', 404);
  const day = c.var.today;
  if (
    plan.closed_at ||
    plan.archived ||
    !plan.cutoff_date ||
    day <= String(plan.cutoff_date)
  )
    fail('Conta indisponível.', 409);
  const cycle = await resolvedCycle(
    db,
    {
      id: String(plan.account_id),
      closing_day: Number(plan.closing_day),
      due_day: Number(plan.due_day),
    },
    day,
  );
  const future = await db
    .prepare(
      `SELECT t.id,t.amount_cents,t.category_id,t.note FROM active_transactions t JOIN statements s ON s.id=t.statement_id
    WHERE t.installment_plan_id=? AND t.installment_number IS NOT NULL AND t.advance_id IS NULL AND s.status='open' AND s.closing_date>?
    ORDER BY t.installment_number LIMIT ?`,
    )
    .bind(plan.id, cycle.closingDate, count)
    .all<{
      id: string;
      amount_cents: number;
      category_id: string | null;
      note: string;
    }>();
  const face = future.results.reduce((sum, t) => sum + t.amount_cents, 0);
  if (future.results.length !== count)
    fail('Não há essa quantidade de parcelas futuras abertas.', 409);
  if (paid > face) fail('O valor cobrado não pode superar o valor cheio.');
  if (cents(b.expected_face_cents) !== face)
    fail('As parcelas mudaram. Confira o valor cheio novamente.', 409);
  const q = await fx(db, String(plan.currency), day, b.fx_rate);
  const advanceId = crypto.randomUUID(),
    transactionId = crypto.randomUUID();
  const ids = JSON.stringify(future.results.map((t) => t.id));
  const classifications: {
    amount: number;
    category: string | null;
    note: string;
    tags: string[];
  }[] = [];
  for (const t of future.results) {
    const parts = await db
      .prepare(
        'SELECT id,amount_cents,category_id,note FROM transaction_splits WHERE transaction_id=? ORDER BY position',
      )
      .bind(t.id)
      .all<{
        id: string;
        amount_cents: number;
        category_id: string | null;
        note: string;
      }>();
    for (const part of parts.results.length ? parts.results : [t]) {
      const tags = await db
        .prepare(
          parts.results.length
            ? 'SELECT tag_id FROM split_tags WHERE split_id=? ORDER BY tag_id'
            : 'SELECT tag_id FROM transaction_tags WHERE transaction_id=? ORDER BY tag_id',
        )
        .bind(part.id)
        .all<{ tag_id: string }>();
      classifications.push({
        amount: part.amount_cents,
        category: part.category_id,
        note: part.note,
        tags: tags.results.map((t) => t.tag_id),
      });
    }
  }
  const splitWrites: D1PreparedStatement[] = [];
  let accumulated = 0,
    allocated = 0,
    allocatedBrl = 0;
  const totalBrl = converted(paid, q.rate);
  const allocatedParts = classifications.flatMap((part, index) => {
    accumulated += part.amount;
    const through =
      index === classifications.length - 1
        ? paid
        : Number((BigInt(paid) * BigInt(accumulated)) / BigInt(face));
    const amount = through - allocated;
    allocated = through;
    const throughBrl =
      index === classifications.length - 1
        ? totalBrl
        : paid
          ? Number((BigInt(totalBrl) * BigInt(through)) / BigInt(paid))
          : 0;
    const brl = throughBrl - allocatedBrl;
    allocatedBrl = throughBrl;
    return amount ? [{ ...part, amount, brl }] : [];
  });
  if (allocatedParts.length > 1)
    for (const [index, part] of allocatedParts.entries()) {
      const id = crypto.randomUUID();
      splitWrites.push(
        db
          .prepare(
            'INSERT INTO transaction_splits(id,transaction_id,position,amount_cents,amount_brl_cents,category_id,note) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM transactions WHERE id=?)',
          )
          .bind(
            id,
            transactionId,
            index,
            part.amount,
            part.brl,
            part.category,
            part.note,
            transactionId,
          ),
      );
      for (const tag of part.tags)
        splitWrites.push(
          db
            .prepare(
              'INSERT INTO split_tags SELECT ?,? WHERE EXISTS(SELECT 1 FROM transaction_splits WHERE id=?)',
            )
            .bind(id, tag, id),
        );
    }
  const results = await db.batch([
    insertCycle(db, String(plan.account_id), cycle),
    db
      .prepare(
        `INSERT INTO installment_advances(id,installment_plan_id,count,face_cents,paid_cents)
      SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM active_transactions t JOIN statements s ON s.id=t.statement_id WHERE t.id IN (SELECT value FROM json_each(?)) AND t.advance_id IS NULL AND s.status='open' AND s.closing_date>?)=?
      AND EXISTS(SELECT 1 FROM statements WHERE account_id=? AND closing_date=? AND status='open')`,
      )
      .bind(
        advanceId,
        plan.id,
        count,
        face,
        paid,
        ids,
        cycle.closingDate,
        count,
        plan.account_id,
        cycle.closingDate,
      ),
    db
      .prepare(
        `UPDATE transactions SET advance_id=? WHERE id IN (SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM installment_advances WHERE id=?)`,
      )
      .bind(advanceId, ids, advanceId),
    db
      .prepare(
        `INSERT INTO transactions(id,account_id,date,amount_cents,currency,fx_rate,amount_brl_cents,fx_source,payee,category_id,note,origin,kind,statement_id,installment_plan_id,advance_id)
      SELECT ?,?,?,?, ?,?,?,?, ?,?,?,'manual','installment',s.id,?,? FROM statements s WHERE s.account_id=? AND s.closing_date=? AND EXISTS(SELECT 1 FROM installment_advances WHERE id=?)`,
      )
      .bind(
        transactionId,
        plan.account_id,
        day,
        paid,
        plan.currency,
        q.rate,
        converted(paid, q.rate),
        q.source,
        plan.description,
        allocatedParts[0]?.category ?? plan.category_id,
        `Antecipação de ${count} parcelas.`,
        plan.id,
        advanceId,
        plan.account_id,
        cycle.closingDate,
        advanceId,
      ),
    ...splitWrites,
    ...(allocatedParts.length === 1
      ? allocatedParts[0].tags.map((tag) =>
          db
            .prepare(
              'INSERT INTO transaction_tags SELECT ?,? WHERE EXISTS(SELECT 1 FROM transactions WHERE id=?)',
            )
            .bind(transactionId, tag, transactionId),
        )
      : []),
  ]);
  if (!results[1].meta.changes)
    fail('As parcelas ou a fatura atual mudaram. Atualize a compra.', 409);
  return c.json(
    {
      id: advanceId,
      transaction_id: transactionId,
      face_cents: face,
      paid_cents: paid,
      discount_cents: face - paid,
    },
    201,
  );
});
app.get('/api/transactions/:id/splits', async (c) => {
  const db = c.var.DB;
  await exists(db, 'transactions', c.req.param('id'));
  const { results } = await db
    .prepare(
      `SELECT p.*, (SELECT json_group_array(json_object('id',t.id,'name',t.name,'color',t.color)) FROM split_tags st JOIN tags t ON t.id=st.tag_id WHERE st.split_id=p.id) AS tags_json FROM transaction_splits p WHERE p.transaction_id=? ORDER BY p.position`,
    )
    .bind(c.req.param('id'))
    .all();
  return c.json(
    results.map(({ tags_json, ...p }) => ({
      ...p,
      tags: JSON.parse(String(tags_json)),
    })),
  );
});
app.put('/api/transactions/:id/splits', async (c) => {
  const db = c.var.DB;
  const t = await db
    .prepare('SELECT * FROM transactions WHERE id=?')
    .bind(c.req.param('id'))
    .first<import('../shared/types').Transaction>();
  if (!t) return fail('Transação não encontrada.', 404);
  if (
    !['regular', 'installment'].includes(t.kind) ||
    t.origin === 'adjustment' ||
    (t.advance_id && t.installment_number !== null)
  )
    fail('Este lançamento não permite divisão.', 409);
  const b = object(await c.req.json());
  keys(b, ['mode', 'parts', 'expected_amount_cents']);
  if (cents(b.expected_amount_cents) !== t.amount_cents)
    fail('O valor original mudou. Abra a divisão novamente.', 409);
  if (!Array.isArray(b.parts) || b.parts.length < 2 || b.parts.length > 50)
    fail('Partes inválidas.');
  const parts = (b.parts as unknown[]).map(object);
  let amounts: number[];
  try {
    amounts = splitAmounts(
      t.amount_cents,
      String(b.mode),
      parts.map((p) => cents(p.value)),
    );
  } catch (e) {
    return fail((e as Error).message);
  }
  for (const p of parts) {
    keys(p, ['value', 'category_id', 'note', 'tag_ids']);
    if (p.category_id != null) await exists(db, 'categories', p.category_id);
    if (
      typeof (p.note ?? '') !== 'string' ||
      String(p.note ?? '').length > 2000
    )
      fail('Nota inválida.');
    if (
      !Array.isArray(p.tag_ids ?? []) ||
      ((p.tag_ids ?? []) as unknown[]).length > 50
    )
      fail('Tags inválidas.');
    p.tag_ids = [...new Set((p.tag_ids ?? []) as string[])];
    for (const id of p.tag_ids as string[]) await exists(db, 'tags', id);
  }
  let allocated = 0,
    native = 0;
  const rows = parts.map((p, i) => {
    native += Math.abs(amounts[i]);
    const cumulative =
      Number(
        (BigInt(native) * BigInt(Math.abs(t.amount_brl_cents))) /
          BigInt(Math.abs(t.amount_cents)),
      ) * Math.sign(t.amount_cents);
    const brl = cumulative - allocated;
    allocated = cumulative;
    return {
      id: crypto.randomUUID(),
      position: i,
      amount: amounts[i],
      brl,
      category: p.category_id ?? null,
      note: p.note ?? '',
      tags: p.tag_ids,
    };
  });
  // Uma única transação D1 preserva o original e substitui todas as partes.
  await db.batch([
    db
      .prepare('DELETE FROM transaction_splits WHERE transaction_id=?')
      .bind(t.id),
    db
      .prepare(
        `INSERT INTO transaction_splits(id,transaction_id,position,amount_cents,amount_brl_cents,category_id,note)
      SELECT value->>'id',?,value->>'position',CASE WHEN (SELECT COUNT(*) FROM transactions WHERE id=? AND amount_cents=? AND amount_brl_cents=? AND date=? AND account_id=? AND fx_rate=?)=1 THEN value->>'amount' ELSE 0 END,value->>'brl',value->>'category',value->>'note' FROM json_each(?)`,
      )
      .bind(
        t.id,
        t.id,
        t.amount_cents,
        t.amount_brl_cents,
        t.date,
        t.account_id,
        t.fx_rate,
        JSON.stringify(rows),
      ),
    db
      .prepare(
        `INSERT INTO split_tags(split_id,tag_id) SELECT p.value->>'id',tag.value FROM json_each(?) p JOIN transaction_splits saved ON saved.id=p.value->>'id' CROSS JOIN json_each(p.value->'tags') tag`,
      )
      .bind(JSON.stringify(rows)),
  ]);
  return c.json({ ok: true });
});
app.delete('/api/transactions/:id/splits', async (c) => {
  await exists(c.var.DB, 'transactions', c.req.param('id'));
  await c.var.DB.prepare(
    'DELETE FROM transaction_splits WHERE transaction_id=?',
  )
    .bind(c.req.param('id'))
    .run();
  return c.json({ ok: true });
});

function guardStatement(db: D1Database, st: Statement) {
  return db
    .prepare(
      `INSERT INTO operation_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM statement_totals WHERE id=? AND status=? AND total_cents=? AND bank_amount_cents IS ? AND closing_date=? AND paid_cents=? AND carried_out_cents=?) THEN 1 ELSE 0 END`,
    )
    .bind(
      crypto.randomUUID(),
      st.id,
      st.status,
      st.total_cents,
      st.bank_amount_cents,
      st.closing_date,
      st.paid_cents ?? 0,
      st.carried_out_cents ?? 0,
    );
}
const clearGuards = (db: D1Database) =>
  db.prepare('DELETE FROM operation_guards');
// A guarda fica no mesmo batch que a alteração, para não gravar sobre uma leitura antiga.
function guardTransaction(db: D1Database, t: Transaction) {
  return db
    .prepare(
      `UPDATE transactions SET amount_cents=CASE WHEN amount_cents=? AND amount_brl_cents=? AND date=? AND category_id IS ? AND note=? AND payee=? AND statement_id IS ? AND advance_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM installment_cancellations WHERE transaction_id=transactions.id)
    AND NOT EXISTS(SELECT 1 FROM statements WHERE id=transactions.statement_id AND status<>'open')
    THEN amount_cents ELSE NULL END WHERE id=?`,
    )
    .bind(
      t.amount_cents,
      t.amount_brl_cents,
      t.date,
      t.category_id,
      t.note,
      t.payee,
      t.statement_id,
      t.id,
    );
}
async function statementSnapshot(db: D1Database, id: string) {
  return JSON.stringify({
    statement: await db
      .prepare('SELECT * FROM statement_totals WHERE id=?')
      .bind(id)
      .first(),
    items: (
      await db
        .prepare(
          `SELECT t.id,t.date,t.payee,t.amount_cents,t.category_id,t.note,
    (SELECT json_group_array(tag_id) FROM transaction_tags WHERE transaction_id=t.id) AS tags,
    (SELECT json_group_array(json_object('valor',amount_cents,'categoria',category_id,'nota',note)) FROM transaction_splits WHERE transaction_id=t.id) AS parts
    FROM transactions t JOIN statement_items i ON i.id=t.id WHERE i.statement_id=? ORDER BY t.id`,
        )
        .bind(id)
        .all()
    ).results,
  });
}
function statementEvent(
  db: D1Database,
  id: string,
  action: string,
  reason: string,
  day: string,
  before: string,
) {
  return db
    .prepare(
      `INSERT INTO statement_events(id,statement_id,action,reason,date,before_json,after_json)
    SELECT ?,?,?,?,?,?,json_object('total_cents',total_cents,'bank_amount_cents',bank_amount_cents,'status',status,'closing_date',closing_date,'paid_cents',paid_cents,'carried_out_cents',carried_out_cents,'previous_balance_cents',previous_balance_cents,
    'items',json((SELECT json_group_array(json_object('id',t.id,'data',t.date,'beneficiario',t.payee,'valor',t.amount_cents,'categoria',t.category_id,'nota',t.note,
    'tags',(SELECT json_group_array(tag_id) FROM transaction_tags WHERE transaction_id=t.id),
    'parts',(SELECT json_group_array(json_object('valor',amount_cents,'categoria',category_id,'nota',note)) FROM transaction_splits WHERE transaction_id=t.id))) FROM transactions t JOIN statement_items i ON i.id=t.id WHERE i.statement_id=s.id))) FROM statement_totals s WHERE id=?`,
    )
    .bind(crypto.randomUUID(), id, action, reason, day, before, id);
}
app.post('/api/transactions/:id/installment-edit', async (c) => {
  const db = c.var.DB,
    b = object(await c.req.json());
  keys(b, [
    'scope',
    'amount_cents',
    'payee',
    'category_id',
    'note',
    'tag_ids',
    'date',
  ]);
  if (!['one', 'future'].includes(String(b.scope)))
    fail('Escolha só esta ou esta e as futuras.');
  const t = await db
    .prepare('SELECT * FROM active_transactions WHERE id=?')
    .bind(c.req.param('id'))
    .first<Transaction>();
  if (
    !t ||
    t.kind !== 'installment' ||
    !t.installment_number ||
    t.advance_id ||
    t.origin !== 'manual'
  )
    return fail('Parcela indisponível.', 409);
  const account = await db
    .prepare('SELECT * FROM accounts WHERE id=?')
    .bind(t.account_id)
    .first<Account>();
  if (!account || account.archived || account.closed_at)
    return fail('Conta encerrada.', 409);
  if ('category_id' in b && b.category_id !== null)
    await exists(db, 'categories', b.category_id);
  if ('note' in b) validatedNote(b.note);
  const tags = 'tag_ids' in b ? await validatedTags(db, b.tag_ids) : null;
  if ('amount_cents' in b && cents(b.amount_cents) <= 0)
    fail('Informe um valor positivo.');
  const name = 'payee' in b ? text(b.payee, 'Beneficiário') : null;
  const shift = 'date' in b ? Date.parse(date(b.date)) - Date.parse(t.date) : 0;
  const rows = (
    await db
      .prepare(
        `SELECT * FROM active_transactions WHERE installment_plan_id=? AND installment_number>=? AND installment_number IS NOT NULL AND advance_id IS NULL ${b.scope === 'one' ? 'AND id=?' : ''} ORDER BY installment_number`,
      )
      .bind(
        ...(b.scope === 'one'
          ? [t.installment_plan_id, t.installment_number, t.id]
          : [t.installment_plan_id, t.installment_number]),
      )
      .all<Transaction>()
  ).results;
  const writes: D1PreparedStatement[] = [];
  const statementIds = [...new Set(rows.map((t) => t.statement_id!))];
  const snapshots = await Promise.all(
    statementIds.map((id) => statementSnapshot(db, id)),
  );
  for (const row of rows) {
    const statement = await readStatement(db, row.statement_id!);
    if (statement.status !== 'open')
      fail('Reabra as faturas fechadas antes de editar parcelas.', 409);
    if (
      await db
        .prepare('SELECT 1 FROM transaction_splits WHERE transaction_id=?')
        .bind(row.id)
        .first()
    )
      fail('Desfaça a divisão antes de editar a parcela.', 409);
    const day = new Date(Date.parse(row.date) + shift)
      .toISOString()
      .slice(0, 10);
    if (
      'date' in b &&
      (day <= account.cutoff_date! ||
        day < statement.period_start ||
        day > statement.closing_date)
    )
      fail(
        'A data deve ficar no ciclo da parcela. Use mover de fatura para trocar o ciclo.',
      );
    const amount =
      'amount_cents' in b ? cents(b.amount_cents) : row.amount_cents;
    writes.unshift(guardStatement(db, statement));
    writes.push(
      guardTransaction(db, row),
      db
        .prepare(
          'UPDATE transactions SET amount_cents=?,amount_brl_cents=?,payee=?,payee_id=CASE WHEN ? IS NULL THEN payee_id ELSE NULL END,category_id=?,note=?,date=? WHERE id=?',
        )
        .bind(
          amount,
          converted(amount, row.fx_rate),
          name ?? row.payee,
          name,
          'category_id' in b ? b.category_id : row.category_id,
          'note' in b ? b.note : row.note,
          day,
          row.id,
        ),
    );
    if (tags) {
      writes.push(
        db
          .prepare('DELETE FROM transaction_tags WHERE transaction_id=?')
          .bind(row.id),
      );
      writes.push(
        ...tags.map((tag) =>
          db
            .prepare('INSERT INTO transaction_tags VALUES(?,?)')
            .bind(row.id, tag),
        ),
      );
    }
  }
  writes.push(
    ...statementIds.map((id, i) =>
      statementEvent(
        db,
        id,
        'edit',
        'Edição de parcela: ' +
          (b.scope === 'one' ? 'só esta' : 'esta e as futuras'),
        c.var.today,
        snapshots[i],
      ),
    ),
  );
  await db.batch([...writes, clearGuards(db)]);
  return c.json({ updated: rows.length });
});
app.post('/api/transactions/:id/cancel-future', async (c) => {
  const db = c.var.DB,
    b = object(await c.req.json());
  keys(b, ['reason']);
  const reason = text(b.reason, 'Motivo', 2000);
  const t = await db
    .prepare('SELECT * FROM active_transactions WHERE id=?')
    .bind(c.req.param('id'))
    .first<Transaction>();
  if (!t?.installment_number || t.origin !== 'manual' || t.advance_id)
    return fail('Selecione uma parcela ativa.', 409);
  const account = await db
    .prepare('SELECT closed_at,archived FROM accounts WHERE id=?')
    .bind(t.account_id)
    .first();
  if (account?.closed_at || account?.archived) fail('Conta encerrada.', 409);
  const rows = (
    await db
      .prepare(
        'SELECT * FROM active_transactions WHERE installment_plan_id=? AND installment_number>? AND advance_id IS NULL ORDER BY installment_number',
      )
      .bind(t.installment_plan_id, t.installment_number)
      .all<Transaction>()
  ).results;
  if (!rows.length) fail('Não há parcelas futuras para cancelar.', 409);
  const writes: D1PreparedStatement[] = [];
  for (const row of rows) {
    const st = await readStatement(db, row.statement_id!);
    if (st.status !== 'open')
      fail('Reabra as faturas das parcelas futuras antes de cancelar.', 409);
    const before = await statementSnapshot(db, st.id);
    writes.unshift(guardStatement(db, st));
    writes.push(
      guardTransaction(db, row),
      db
        .prepare(
          'INSERT INTO installment_cancellations(transaction_id,reason) VALUES(?,?)',
        )
        .bind(row.id, reason),
      statementEvent(db, st.id, 'cancel', reason, c.var.today, before),
    );
  }
  await db.batch([...writes, clearGuards(db)]);
  return c.json({ cancelled: rows.length });
});
app.post('/api/transactions/:id/move-statement', async (c) => {
  const db = c.var.DB,
    b = object(await c.req.json());
  keys(b, ['direction']);
  if (!['previous', 'next'].includes(String(b.direction)))
    fail('Escolha a fatura anterior ou seguinte.');
  const t = await db
    .prepare('SELECT * FROM active_transactions WHERE id=?')
    .bind(c.req.param('id'))
    .first<Transaction>();
  if (
    !t ||
    t.origin !== 'manual' ||
    !['regular', 'installment'].includes(t.kind) ||
    t.advance_id
  )
    return fail('Compra indisponível para mover.', 409);
  const account = await db
    .prepare("SELECT * FROM accounts WHERE id=? AND kind='credit_card'")
    .bind(t.account_id)
    .first<Account>();
  if (!account || account.archived || account.closed_at)
    return fail('Escolha um cartão ativo.');
  const source = t.statement_id
    ? await readStatement(db, t.statement_id)
    : await db
        .prepare(
          'SELECT * FROM statement_totals WHERE account_id=? AND ? BETWEEN period_start AND closing_date',
        )
        .bind(account.id, t.date)
        .first<Statement>();
  if (!source || source.status !== 'open')
    return fail('Reabra a fatura de origem antes de mover.', 409);
  const cycle = await resolvedCycle(
    db,
    account,
    source.scheduled_closing_date ?? source.closing_date,
    b.direction === 'previous' ? -1 : 1,
    false,
  );
  if (cycle.closingDate <= account.cutoff_date!)
    fail('A fatura de destino fica antes do corte.');
  const target = await db
    .prepare(
      'SELECT * FROM statement_totals WHERE account_id=? AND scheduled_closing_date=?',
    )
    .bind(account.id, cycle.scheduledClosingDate)
    .first<Statement>();
  if (target && target.status !== 'open')
    fail('Reabra a fatura de destino antes de mover.', 409);
  const targetId =
    target?.id ?? `cycle:${account.id}:${cycle.scheduledClosingDate}`;
  const sourceBefore = await statementSnapshot(db, source.id),
    targetBefore = target ? await statementSnapshot(db, targetId) : '{}';
  await db.batch([
    guardStatement(db, source),
    ...(target ? [guardStatement(db, target)] : []),
    insertCycle(db, account.id, cycle, targetId),
    guardTransaction(db, t),
    db
      .prepare(
        `UPDATE transactions SET statement_id=? WHERE id=? AND EXISTS(SELECT 1 FROM statements WHERE id=? AND status='open')`,
      )
      .bind(targetId, t.id, targetId),
    statementEvent(
      db,
      source.id,
      'move',
      'Compra movida para a fatura ' +
        (b.direction === 'previous' ? 'anterior' : 'seguinte'),
      c.var.today,
      sourceBefore,
    ),
    statementEvent(
      db,
      targetId,
      'move',
      'Compra recebida de outra fatura',
      c.var.today,
      targetBefore,
    ),
    clearGuards(db),
  ]);
  return c.json({ statement_id: targetId });
});
app.post('/api/statements/:id/reopen', async (c) => {
  const db = c.var.DB,
    b = object(await c.req.json());
  keys(b, ['reason', 'date']);
  const reason = text(b.reason, 'Motivo', 2000),
    day = date(b.date);
  if (day > c.var.today) fail('A data está no futuro.');
  const st = await readStatement(db, c.req.param('id'));
  if (st.status !== 'closed') fail('Selecione uma fatura fechada.', 409);
  const carried = await db
    .prepare(
      'SELECT s.* FROM statement_carryovers c JOIN statement_totals s ON s.id=c.destination_statement_id WHERE c.source_statement_id=?',
    )
    .bind(st.id)
    .first<Statement>();
  if (carried && carried.status !== 'open')
    fail('Reabra primeiro a fatura que recebeu o saldo anterior.', 409);
  const before = await statementSnapshot(db, st.id);
  await db.batch([
    guardStatement(db, st),
    ...(carried ? [guardStatement(db, carried)] : []),
    db
      .prepare(
        "UPDATE statements SET status='open',bank_amount_cents=NULL,closed_at=NULL WHERE id=? AND status='closed'",
      )
      .bind(st.id),
    db
      .prepare('DELETE FROM statement_carryovers WHERE source_statement_id=?')
      .bind(st.id),
    statementEvent(db, st.id, 'reopen', reason, day, before),
    clearGuards(db),
  ]);
  return c.json({ ok: true });
});
app.post('/api/statements/:id/early-close', async (c) => {
  const db = c.var.DB,
    b = object(await c.req.json());
  keys(b, ['date']);
  const day = date(b.date);
  const st = await readStatement(db, c.req.param('id'));
  if (st.status !== 'open') fail('Selecione uma fatura aberta.', 409);
  if (day < st.period_start || day >= st.closing_date || day > c.var.today)
    fail('Escolha uma data dentro do ciclo e anterior ao fechamento.');
  const account = (await db
    .prepare('SELECT * FROM accounts WHERE id=?')
    .bind(st.account_id)
    .first<Account>())!;
  const next = statementCycle(
    st.scheduled_closing_date ?? st.closing_date,
    account.closing_day!,
    account.due_day!,
    1,
  );
  const target = await db
    .prepare(
      'SELECT * FROM statement_totals WHERE account_id=? AND scheduled_closing_date=?',
    )
    .bind(account.id, next.closingDate)
    .first<Statement>();
  if (target && target.status !== 'open')
    fail('Reabra a próxima fatura antes de antecipar o fechamento.', 409);
  const items = (
    await db
      .prepare(
        'SELECT t.* FROM transactions t JOIN statement_items i ON i.id=t.id WHERE i.statement_id=? AND t.date>?',
      )
      .bind(st.id, day)
      .all<Transaction>()
  ).results;
  if (items.some((t) => t.origin !== 'manual'))
    fail('O ciclo contém lançamentos protegidos após a data escolhida.', 409);
  const targetId = target?.id ?? `cycle:${account.id}:${next.closingDate}`,
    before = await statementSnapshot(db, st.id);
  const following = new Date(Date.parse(day) + 86400000)
    .toISOString()
    .slice(0, 10);
  const cycle = {
    ...next,
    periodStart: following,
    scheduledClosingDate: next.closingDate,
  };
  await db.batch([
    guardStatement(db, st),
    ...(target ? [guardStatement(db, target)] : []),
    insertCycle(db, account.id, cycle, targetId),
    ...items.map((t) => guardTransaction(db, t)),
    db
      .prepare('UPDATE statements SET period_start=? WHERE id=?')
      .bind(following, targetId),
    ...items.map((t) =>
      db
        .prepare('UPDATE transactions SET statement_id=? WHERE id=?')
        .bind(targetId, t.id),
    ),
    db
      .prepare(
        "UPDATE statements SET closing_date=? WHERE id=? AND status='open'",
      )
      .bind(day, st.id),
    statementEvent(
      db,
      st.id,
      'early-close',
      'Fechamento antecipado; próximas datas preservadas',
      day,
      before,
    ),
    clearGuards(db),
  ]);
  return c.json({ ok: true, requires_check: true });
});

app.get('/api/cards/:id/statements', async (c) => {
  const db = c.var.DB;
  const card = await db
    .prepare("SELECT * FROM accounts WHERE id=? AND kind='credit_card'")
    .bind(c.req.param('id'))
    .first<Account>();
  if (!card) return fail('Cartão não encontrado.', 404);
  if (!card.closing_day || !card.due_day)
    return fail('O cartão precisa de dias de fechamento e vencimento.', 409);
  const current = await resolvedCycle(db, card, c.var.today);
  // Datas extremas de cada mês bastam para identificar ciclos com compras antigas.
  const { results: legacy } = await db
    .prepare(
      "SELECT MIN(date) AS first,MAX(date) AS last FROM transactions WHERE account_id=? AND statement_id IS NULL AND kind='regular' AND origin<>'adjustment' GROUP BY substr(date,1,7)",
    )
    .bind(card.id)
    .all<{ first: string; last: string }>();
  const cycles = new Map<string, Awaited<ReturnType<typeof resolvedCycle>>>();
  if (!card.closed_at && !card.archived)
    cycles.set(current.closingDate, current);
  for (const { first, last } of legacy) {
    for (const day of [first, last]) {
      const cycle = await resolvedCycle(db, card, day);
      cycles.set(cycle.closingDate, cycle);
    }
  }
  if (cycles.size)
    await db.batch(
      [...cycles.values()].map((cycle) => insertCycle(db, card.id, cycle)),
    );
  return c.json(
    (
      await db
        .prepare(
          `SELECT s.*, COALESCE(s.bank_amount_cents,s.total_cents)-s.paid_cents-s.carried_out_cents AS remaining_cents, s.closing_date=? AS is_current,
      CASE WHEN EXISTS(SELECT 1 FROM statement_revisions WHERE statement_id=s.id) THEN s.bank_amount_cents-s.total_cents ELSE COALESCE((SELECT bank_amount_cents-app_amount_cents FROM statement_checks
                WHERE statement_id=s.id ORDER BY rowid DESC LIMIT 1),
               s.bank_amount_cents-s.total_cents) END AS difference_cents
     FROM statement_totals s WHERE s.account_id=? ORDER BY s.closing_date DESC`,
        )
        .bind(current.closingDate, card.id)
        .all()
    ).results,
  );
});

app.get('/api/statements/:id', async (c) => {
  const db = c.var.DB;
  const id = c.req.param('id');
  const [statement, items, checks] = await db.batch([
    db.prepare('SELECT id FROM statements WHERE id=?').bind(id),
    db
      .prepare(
        'SELECT i.*,p.count AS installment_count FROM statement_items i LEFT JOIN installment_plans p ON p.id=i.installment_plan_id WHERE i.statement_id=? ORDER BY i.date,i.id',
      )
      .bind(id),
    db
      .prepare(
        'SELECT * FROM statement_checks WHERE statement_id=? ORDER BY rowid DESC',
      )
      .bind(id),
  ]);
  if (!statement.results.length) return fail('Fatura não encontrada.', 404);
  const revisions = await db
    .prepare(
      'SELECT * FROM statement_revisions WHERE statement_id=? ORDER BY rowid DESC',
    )
    .bind(id)
    .all();
  const events = await db
    .prepare(
      'SELECT * FROM statement_events WHERE statement_id=? ORDER BY rowid DESC',
    )
    .bind(id)
    .all();
  const carryovers = await db
    .prepare(
      'SELECT c.*,s.due_date FROM statement_carryovers c JOIN statements s ON s.id=c.source_statement_id WHERE destination_statement_id=?',
    )
    .bind(id)
    .all();
  return c.json({
    events: events.results,
    carryovers: carryovers.results,
    items: items.results,
    checks: checks.results,
    revisions: revisions.results,
  });
});

async function readStatement(db: D1Database, id: string) {
  const row = await db
    .prepare(
      'SELECT s.*,a.name,a.currency,a.closed_at AS account_closed_at,a.archived,a.cutoff_date FROM statement_totals s JOIN accounts a ON a.id=s.account_id WHERE s.id=?',
    )
    .bind(id)
    .first<
      Statement & {
        name: string;
        currency: string;
        account_closed_at: string | null;
        archived: number;
        cutoff_date: string | null;
      }
    >();
  if (!row) return fail('Fatura não encontrada.', 404);
  if (row.archived || row.account_closed_at)
    return fail('Cartão encerrado.', 409);
  return row;
}

app.post('/api/statements/:id/check', async (c) => {
  const db = c.var.DB;
  const statement = await readStatement(db, c.req.param('id'));
  if (statement.status !== 'open') return fail('Fatura já fechada.', 409);
  const b = object(await c.req.json());
  keys(b, ['bank_amount_cents', 'expected_total_cents', 'action', 'fx_rate']);
  const bank = cents(b.bank_amount_cents);
  const total = cents(statement.total_cents);
  const difference = cents(bank - total);
  const preview = {
    bank_amount_cents: bank,
    app_amount_cents: total,
    difference_cents: difference,
  };
  if (b.action === undefined) return c.json(preview);
  if (b.action !== 'search' && b.action !== 'close')
    return fail('Ação inválida.');
  if (b.action === 'search' && !difference)
    return fail('A fatura está conciliada.');
  if (cents(b.expected_total_cents) !== total)
    return fail('Total alterado. Confira a fatura novamente.', 409);
  const id = crypto.randomUUID();
  const adjustmentId = crypto.randomUUID();
  const previousOpening = await db
    .prepare(
      "SELECT action,before_json FROM statement_events WHERE statement_id=? AND action IN ('reopen','close') ORDER BY rowid DESC LIMIT 1",
    )
    .bind(statement.id)
    .first<{ action: string; before_json: string }>();
  const before =
    previousOpening?.action === 'reopen'
      ? previousOpening.before_json
      : await statementSnapshot(db, statement.id);
  const writes = [
    db
      .prepare(
        `INSERT INTO statement_checks(id,statement_id,app_amount_cents,bank_amount_cents,action)
     SELECT ?,id,total_cents,?,? FROM statement_totals WHERE id=? AND status='open' AND total_cents=?`,
      )
      .bind(id, bank, b.action, statement.id, total),
  ];
  if (b.action === 'close') {
    if (difference) {
      const q = await fx(
        db,
        statement.currency,
        statement.closing_date,
        b.fx_rate,
      );
      writes.push(
        db
          .prepare(
            `INSERT INTO transactions(id,account_id,date,amount_cents,currency,fx_rate,amount_brl_cents,fx_source,payee,category_id,origin,kind,statement_id)
           SELECT ?,account_id,closing_date,?,?,?,?,?,'Diferença de fatura','statement-difference','adjustment','regular',id
           FROM statements WHERE id=? AND EXISTS (SELECT 1 FROM statement_checks WHERE id=?)`,
          )
          .bind(
            adjustmentId,
            difference,
            statement.currency,
            q.rate,
            converted(difference, q.rate),
            q.source,
            statement.id,
            id,
          ),
        db
          .prepare(
            'UPDATE statement_checks SET adjustment_transaction_id=? WHERE id=?',
          )
          .bind(adjustmentId, id),
      );
    }
    writes.push(
      db
        .prepare(
          `UPDATE statements SET status=CASE WHEN (SELECT paid_cents FROM statement_totals WHERE id=statements.id)>=? AND (SELECT paid_cents FROM statement_totals WHERE id=statements.id)>0 THEN 'paid' ELSE 'closed' END,bank_amount_cents=?,closed_at=CURRENT_TIMESTAMP
       WHERE id=? AND EXISTS (SELECT 1 FROM statement_checks WHERE id=?)`,
        )
        .bind(bank, bank, statement.id, id),
    );
  }
  if (b.action === 'close') {
    if ((statement.paid_cents ?? 0) > 0 && bank > (statement.paid_cents ?? 0))
      writes.push(
        ...(await carryoverWrites(
          db,
          statement,
          bank - (statement.paid_cents ?? 0),
        )),
      );
    writes.push(
      statementEvent(
        db,
        statement.id,
        'close',
        'Conferência ao fechar a fatura',
        c.var.today,
        before,
      ),
    );
  }
  const [check] = await db.batch([...writes, clearGuards(db)]);
  if (check.meta.changes !== 1)
    return fail('Fatura alterada. Confira novamente.', 409);
  return c.json(preview, 201);
});

async function carryoverWrites(
  db: D1Database,
  statement: Statement,
  amount: number,
  paymentId?: string,
) {
  const account = (await db
    .prepare('SELECT * FROM accounts WHERE id=?')
    .bind(statement.account_id)
    .first<Account>())!;
  const cycle = statementCycle(
    statement.scheduled_closing_date ?? statement.closing_date,
    account.closing_day!,
    account.due_day!,
    1,
  );
  const target = await db
    .prepare(
      'SELECT * FROM statement_totals WHERE account_id=? AND scheduled_closing_date=?',
    )
    .bind(account.id, cycle.closingDate)
    .first<Statement>();
  if (target && target.status !== 'open')
    fail(
      'Reabra a fatura seguinte antes de transportar o saldo anterior.',
      409,
    );
  const id = target?.id ?? `cycle:${account.id}:${cycle.closingDate}`;
  return [
    ...(target ? [guardStatement(db, target)] : []),
    insertCycle(
      db,
      account.id,
      { ...cycle, scheduledClosingDate: cycle.closingDate },
      id,
    ),
    db
      .prepare(
        `INSERT INTO statement_carryovers(source_statement_id,destination_statement_id,amount_cents) SELECT ?,?,? WHERE ${paymentId ? 'EXISTS(SELECT 1 FROM transactions WHERE id=?)' : "EXISTS(SELECT 1 FROM statements WHERE id=? AND status='closed')"}`,
      )
      .bind(statement.id, id, amount, paymentId ?? statement.id),
  ];
}
app.post('/api/statements/:id/pay', async (c) => {
  const db = c.var.DB;
  const statement = await readStatement(db, c.req.param('id'));
  if (statement.status !== 'closed')
    return fail('Só é possível pagar uma fatura fechada.', 409);
  const b = object(await c.req.json());
  keys(b, [
    'account_id',
    'date',
    'card_fx_rate',
    'account_fx_rate',
    'amount_cents',
    'note',
    'tag_ids',
  ]);
  const day = date(b.date);
  const source = await db
    .prepare(
      "SELECT * FROM accounts WHERE id=? AND kind='checking' AND closed_at IS NULL AND archived=0",
    )
    .bind(text(b.account_id, 'Conta corrente'))
    .first<Account>();
  if (!source?.cutoff_date || day <= source.cutoff_date)
    return fail('Escolha uma conta corrente ativa na data do pagamento.');
  if (day > c.var.today) return fail('A data do pagamento está no futuro.');
  if (!statement.cutoff_date || day <= statement.cutoff_date)
    return fail('O pagamento deve ser posterior ao corte do cartão.');
  const total = cents(statement.bank_amount_cents ?? statement.total_cents);
  const paid = (await db
    .prepare(
      "SELECT COALESCE(SUM(card_amount_cents),0) AS amount FROM transactions WHERE statement_id=? AND kind='card_payment'",
    )
    .bind(statement.id)
    .first<{ amount: number }>())!.amount;
  const remaining = total - paid - (statement.carried_out_cents ?? 0);
  if (remaining <= 0 && (statement.carried_out_cents ?? 0) > 0)
    fail('O restante foi transportado para a fatura seguinte.', 409);
  const note = validatedNote(b.note),
    tags = await validatedTags(db, b.tag_ids);
  const amount =
    b.amount_cents === undefined ? remaining : cents(b.amount_cents);
  if (amount > remaining || (amount <= 0 && remaining !== 0))
    return fail(
      'Informe um pagamento positivo até o saldo restante da fatura.',
    );
  if (amount < 0)
    return fail('A fatura está com saldo credor e não exige pagamento.');
  const cardQuote = amount
    ? await fx(db, statement.currency, day, b.card_fx_rate)
    : { rate: 1, source: 'manual' };
  const q =
    source.currency === statement.currency
      ? cardQuote
      : amount
        ? await fx(db, source.currency, day, b.account_fx_rate)
        : { rate: 1, source: 'manual' };
  const sourceAmount =
    source.currency === statement.currency
      ? amount
      : converted(amount, cardQuote.rate, q.rate);
  if (amount && !sourceAmount)
    return fail('O valor convertido é menor que um centavo na conta corrente.');
  const brl = converted(sourceAmount, q.rate);
  const month = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(statement.due_date));
  const name = `Fatura ${statement.name} ${month}`;
  const id = crypto.randomUUID();
  const carry =
    amount < remaining
      ? await carryoverWrites(db, statement, remaining - amount, id)
      : [];
  const before = await statementSnapshot(db, statement.id);
  const [, payment] = await db.batch([
    guardStatement(db, statement),
    db
      .prepare(
        `INSERT INTO transactions(id,account_id,date,amount_cents,currency,fx_rate,amount_brl_cents,fx_source,payee,origin,kind,statement_id,card_amount_cents,note)
       SELECT ?,a.id,?,?,?,?,?,?,?,'manual','card_payment',s.id,?,?
       FROM statements s JOIN accounts a ON a.id=?
       WHERE s.id=? AND s.status='closed' AND a.closed_at IS NULL AND a.archived=0 AND a.cutoff_date<?
       AND NOT EXISTS(SELECT 1 FROM statement_carryovers WHERE source_statement_id=s.id)
       AND COALESCE((SELECT SUM(card_amount_cents) FROM transactions WHERE statement_id=s.id AND kind='card_payment'),0)=?`,
      )
      .bind(
        id,
        day,
        sourceAmount,
        source.currency,
        q.rate,
        brl,
        q.source,
        name,
        amount,
        note,
        source.id,
        statement.id,
        day,
        paid,
      ),
    db
      .prepare(
        `UPDATE statements SET status=CASE WHEN ? >= ? THEN 'paid' ELSE 'closed' END,bank_amount_cents=?
       WHERE id=? AND EXISTS (SELECT 1 FROM transactions WHERE id=?)`,
      )
      .bind(paid + amount, total, total, statement.id, id),
    ...tags.map((tag) =>
      db
        .prepare(
          'INSERT INTO transaction_tags(transaction_id,tag_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM transactions WHERE id=?)',
        )
        .bind(id, tag, id),
    ),
    ...carry,
    statementEvent(
      db,
      statement.id,
      'payment',
      amount < remaining
        ? 'Pagamento parcial com saldo anterior na fatura seguinte'
        : 'Pagamento de fatura',
      day,
      before,
    ),
    clearGuards(db),
  ]);
  if (payment.meta.changes !== 1)
    return fail('Fatura ou conta alterada. Atualize a página.', 409);
  return c.json({ id }, 201);
});

function tagIdList(value: unknown) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  return (Array.isArray(parsed) ? parsed : [])
    .filter((id): id is string => typeof id === 'string')
    .sort();
}
app.get('/api/payees', async (c) => {
  const { results } = await c.var.DB.prepare(
    `SELECT p.id,p.name,p.has_default,p.default_category_id,COUNT(t.id) AS count,MIN(t.date) AS first_date,MAX(t.date) AS last_date,COALESCE((SELECT json_group_array(d.tag_id) FROM payee_default_tags d WHERE d.payee_id=p.id),'[]') AS default_tag_ids FROM payees p LEFT JOIN payees alias ON alias.id=p.id OR alias.merged_into_id=p.id LEFT JOIN transactions t ON t.payee_id=alias.id WHERE p.merged_into_id IS NULL GROUP BY p.id,p.name,p.has_default,p.default_category_id ORDER BY p.name`,
  ).all<{
    id: string;
    name: string;
    has_default: number;
    default_category_id: string | null;
    count: number;
    first_date: string | null;
    last_date: string | null;
    default_tag_ids: string;
  }>();
  return c.json(
    results.map((p) => ({
      ...p,
      default_tag_ids: tagIdList(p.default_tag_ids),
    })),
  );
});
app.get('/api/payees/suggestion', async (c) => {
  const name = text(c.req.query('name'), 'Beneficiário');
  const canonical = await c.var.DB.prepare(
    `SELECT id,has_default,default_category_id FROM payees WHERE id=(SELECT COALESCE(merged_into_id,id) FROM payees WHERE name=? COLLATE NOCASE)`,
  )
    .bind(name)
    .first<{
      id: string;
      has_default: number;
      default_category_id: string | null;
    }>();
  // O padrão, quando existe, substitui a última vez por inteiro, inclusive categoria vazia ou lista de tags vazia.
  if (canonical?.has_default) {
    const tags = (
      await c.var.DB.prepare(
        'SELECT tag_id FROM payee_default_tags WHERE payee_id=? ORDER BY tag_id',
      )
        .bind(canonical.id)
        .all<{ tag_id: string }>()
    ).results.map((t) => t.tag_id);
    return c.json({
      category_id: canonical.default_category_id,
      tag_ids: tags,
      source: 'default',
    });
  }
  const last = await c.var.DB.prepare(
    `SELECT t.id,t.category_id FROM transactions t JOIN payees p ON p.id=t.payee_id WHERE COALESCE(p.merged_into_id,p.id)=(SELECT COALESCE(merged_into_id,id) FROM payees WHERE name=? COLLATE NOCASE) AND t.origin<>'adjustment' ORDER BY t.date DESC,t.created_at DESC,t.id DESC LIMIT 1`,
  )
    .bind(name)
    .first<{ id: string; category_id: string | null }>();
  const tags = last
    ? (
        await c.var.DB.prepare(
          'SELECT tag_id FROM transaction_tags WHERE transaction_id=?',
        )
          .bind(last.id)
          .all<{ tag_id: string }>()
      ).results.map((t) => t.tag_id)
    : [];
  return c.json({
    category_id: last?.category_id ?? null,
    tag_ids: tags,
    source: last ? 'last' : 'none',
  });
});
app.patch('/api/payees/:id', async (c) => {
  const b = object(await c.req.json());
  keys(b, ['category_id', 'tag_ids']);
  if (!('category_id' in b) || !('tag_ids' in b))
    fail('Informe a categoria e as tags padrão.');
  const db = c.var.DB;
  const id = c.req.param('id');
  const payee = await db
    .prepare('SELECT id FROM payees WHERE id=? AND merged_into_id IS NULL')
    .bind(id)
    .first();
  if (!payee) fail('Beneficiário não encontrado.', 404);
  if (b.category_id !== null) await exists(db, 'categories', b.category_id);
  const tags = await validatedTags(db, b.tag_ids);
  const clear = b.category_id === null && !tags.length;
  await db.batch([
    db
      .prepare(
        'UPDATE payees SET has_default=?,default_category_id=? WHERE id=? AND merged_into_id IS NULL',
      )
      .bind(clear ? 0 : 1, clear ? null : b.category_id, id),
    db.prepare('DELETE FROM payee_default_tags WHERE payee_id=?').bind(id),
    ...(!clear
      ? tags.map((tag) =>
          db
            .prepare(
              'INSERT INTO payee_default_tags(payee_id,tag_id) VALUES(?,?)',
            )
            .bind(id, tag),
        )
      : []),
  ]);
  return c.json({ ok: true });
});
app.post('/api/payees/merge', async (c) => {
  const b = object(await c.req.json());
  keys(b, ['target_id', 'source_ids']);
  if (
    !Array.isArray(b.source_ids) ||
    !b.source_ids.length ||
    b.source_ids.length > 100 ||
    b.source_ids.includes(b.target_id)
  )
    fail('Selecione nomes distintos do destino.');
  if (typeof b.target_id !== 'string') fail('Destino inválido.');
  const target = await c.var.DB.prepare(
    'SELECT id FROM payees WHERE id=? AND merged_into_id IS NULL',
  )
    .bind(b.target_id)
    .first();
  if (!target) fail('Destino inválido.');
  const sources = [...new Set(b.source_ids as string[])];
  for (const id of sources) {
    await exists(c.var.DB, 'payees', id);
    const source = await c.var.DB.prepare(
      'SELECT merged_into_id FROM payees WHERE id=?',
    )
      .bind(id)
      .first();
    if (source!.merged_into_id) fail('Beneficiário já unificado.', 409);
    const imported = await c.var.DB.prepare(
      "SELECT 1 FROM transactions t JOIN payees p ON p.id=t.payee_id WHERE t.origin='imported' AND (p.id=? OR p.merged_into_id=?) LIMIT 1",
    )
      .bind(id, id)
      .first();
    if (imported)
      fail('Beneficiário de transação importada não pode mudar.', 409);
  }
  // Na unificação em lote permanece o padrão do destino. O padrão dos nomes de origem deixa de valer.
  await c.var.DB.batch(
    sources.map((id) =>
      c.var.DB.prepare(
        'UPDATE payees SET merged_into_id=? WHERE id=? OR merged_into_id=?',
      ).bind(b.target_id, id, id),
    ),
  );
  return c.json({ ok: true });
});
app.post('/api/accounts/:id/reconcile', async (c) => {
  const b = object(await c.req.json());
  keys(b, [
    'bank_balance_cents',
    'expected_balance_cents',
    'confirm',
    'fx_rate',
  ]);
  if ('confirm' in b && typeof b.confirm !== 'boolean')
    fail('Confirmação inválida.');
  const bank = cents(b.bank_balance_cents);
  const a = await c.var.DB.prepare(
    `SELECT a.*,${balanceSql(c.var.today)} AS balance_cents FROM accounts a WHERE id=?`,
  )
    .bind(c.req.param('id'))
    .first<Account>();
  if (!a) fail('Conta não encontrada.', 404);
  if (a!.closed_at || a!.archived || !a!.cutoff_date)
    fail('Confira uma conta ativa.', 409);
  if (a!.cutoff_date! >= c.var.today)
    fail('A conferência deve ser posterior ao corte.', 409);
  const adjustment = cents(a!.balance_cents - bank);
  if (b.confirm !== true)
    return c.json({
      app_balance_cents: a!.balance_cents,
      bank_balance_cents: bank,
      adjustment_cents: adjustment,
    });
  if (cents(b.expected_balance_cents) !== a!.balance_cents)
    fail('Saldo alterado. Confira novamente.', 409);
  const day = c.var.today;
  const q = await fx(c.var.DB, a!.currency, day, b.fx_rate);
  const id = crypto.randomUUID();
  const tx = crypto.randomUUID();
  const brl = converted(adjustment, q.rate);
  const results = await c.var.DB.batch([
    c.var.DB.prepare(
      `INSERT INTO reconciliations(id,account_id,date,bank_balance_cents,app_balance_cents) SELECT ?,a.id,?,?,? FROM accounts a WHERE a.id=? AND a.closed_at IS NULL AND a.archived=0 AND a.cutoff_date IS NOT NULL AND ${balanceSql(c.var.today)}=?`,
    ).bind(id, day, bank, a!.balance_cents, a!.id, a!.balance_cents),
    c.var.DB.prepare(
      "INSERT INTO transactions(id,account_id,date,amount_cents,currency,fx_rate,amount_brl_cents,fx_source,payee,note,origin,kind) SELECT ?,account_id,date,app_balance_cents-bank_balance_cents,?,?,?,?,'Conferência de saldo','Ajuste visível da conferência de saldo.','adjustment','regular' FROM reconciliations WHERE id=? AND app_balance_cents<>bank_balance_cents",
    ).bind(tx, a!.currency, q.rate, brl, q.source, id),
    c.var.DB.prepare(
      'UPDATE reconciliations SET adjustment_transaction_id=(SELECT id FROM transactions WHERE id=?) WHERE id=?',
    ).bind(tx, id),
    c.var.DB.prepare(
      'UPDATE accounts SET last_reconciled_at=? WHERE id=? AND EXISTS(SELECT 1 FROM reconciliations WHERE id=?)',
    ).bind(day, a!.id, id),
  ]);
  if (results[0].meta.changes !== 1)
    fail('Saldo alterado. Confira novamente.', 409);
  return c.json({ ok: true, id }, 201);
});
// Tabelas e campos vêm desta lista fixa; valores sempre usam bind.
const configTables = {
  institutions: ['name'],
  'subscription-types': ['name'],
  tags: ['name', 'color'],
  'allocation-groups': ['name', 'target_percent'],
  'category-groups': [
    'name',
    'allocation_group_id',
    'is_income',
    'exclude_budget',
    'exclude_totals',
  ],
  categories: [
    'name',
    'category_group_id',
    'is_income',
    'exclude_budget',
    'exclude_totals',
  ],
} as const;
for (const [route, fields] of Object.entries(configTables)) {
  const table = route.replaceAll('-', '_');
  if (route !== 'categories' && route !== 'institutions')
    app.get(`/api/${route}`, async (c) =>
      c.json(
        (await c.var.DB.prepare(`SELECT * FROM ${table} ORDER BY name`).all())
          .results,
      ),
    );
  for (const method of ['post', 'patch'] as const)
    app[method](
      `/api/${route}${method === 'patch' ? '/:id' : ''}`,
      async (c) => {
        const b = object(await c.req.json());
        keys(b, [...fields]);
        if (!Object.keys(b).length) fail('Informe os campos.');
        if (method === 'post' || 'name' in b) b.name = text(b.name);
        if (
          route === 'tags' &&
          (method === 'post' || 'color' in b) &&
          (typeof b.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(b.color))
        )
          fail('Cor inválida.');
        if (
          route === 'allocation-groups' &&
          (method === 'post' || 'target_percent' in b) &&
          (!Number.isInteger(b.target_percent) ||
            Number(b.target_percent) < 0 ||
            Number(b.target_percent) > 100)
        )
          fail('Percentual inválido.');
        if (
          route === 'category-groups' &&
          (method === 'post' || 'allocation_group_id' in b)
        )
          await exists(c.var.DB, 'allocation_groups', b.allocation_group_id);
        if (route === 'categories' || route === 'category-groups') {
          for (const flag of ['is_income', 'exclude_budget', 'exclude_totals'])
            if (flag in b && ![0, 1].includes(b[flag] as number))
              fail('Marca de categoria inválida.');
        }
        if (route === 'categories') {
          if (method === 'post' || 'category_group_id' in b)
            await exists(c.var.DB, 'category_groups', b.category_group_id);
          if ('is_income' in b && ![0, 1].includes(b.is_income as number))
            fail('Tipo de categoria inválido.');
        }
        const id = method === 'post' ? crypto.randomUUID() : c.req.param('id');
        if (method === 'patch') await exists(c.var.DB, table, id);
        const columns = Object.keys(b);
        if (method === 'post')
          await c.var.DB.prepare(
            `INSERT INTO ${table}(id,${columns.join(',')}) VALUES(?,${columns.map(() => '?').join(',')})`,
          )
            .bind(id, ...Object.values(b))
            .run();
        else
          await c.var.DB.prepare(
            `UPDATE ${table} SET ${columns.map((k) => `${k}=?`).join(',')} WHERE id=?`,
          )
            .bind(...Object.values(b), id)
            .run();
        return c.json({ id }, method === 'post' ? 201 : 200);
      },
    );
}
const recurringSql = `SELECT r.*,a.name AS account_name,a.currency,c.name AS category_name,ag.name AS allocation_name,st.name AS type_name
 FROM recurring r JOIN accounts a ON a.id=r.account_id LEFT JOIN categories c ON c.id=r.category_id
 LEFT JOIN category_groups cg ON cg.id=c.category_group_id LEFT JOIN allocation_groups ag ON ag.id=cg.allocation_group_id
 LEFT JOIN subscription_types st ON st.id=r.subscription_type_id`;
app.get('/api/recurring', async (c) => {
  const month = c.req.query('month') ?? c.var.today.slice(0, 7);
  if (!validMonth(month)) fail('Mês inválido.');
  const db = c.var.DB;
  const { results: rows } = await db
    .prepare(recurringSql + ' ORDER BY c.name,r.payee')
    .all<Recurring>();
  if (c.req.query('catalog') === '1')
    return c.json({
      items: rows.map((r) => ({
        ...r,
        due_date: nextOccurrence(r, c.var.today),
        arrived: false,
        actual_cents: 0,
        transaction_id: null,
      })),
      summary: {},
    });
  const { results: transactions } = await db
    .prepare(
      `SELECT t.id,t.account_id,t.amount_cents,t.date,CASE WHEN t.origin='imported' THEN t.payee ELSE COALESCE(canonical.name,p.name,t.payee) END AS payee,
    (SELECT recurring_id FROM recurring_sources WHERE transaction_id=t.id) AS source_id
    FROM active_transactions t LEFT JOIN payees p ON p.id=t.payee_id LEFT JOIN payees canonical ON canonical.id=p.merged_into_id
    WHERE t.date>=? AND t.date<=? AND (t.kind='regular' OR (t.kind='installment' AND t.installment_number IS NOT NULL)) AND t.origin<>'adjustment' ORDER BY t.date,t.id`,
    )
    .bind(
      new Date(
        Date.parse(monthBounds(shiftMonth(month, -1)).from) - 7 * 86400000,
      )
        .toISOString()
        .slice(0, 10),
      new Date(Date.parse(monthBounds(shiftMonth(month, 1)).to) + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
    )
    .all<{
      id: string;
      account_id: string;
      amount_cents: number;
      date: string;
      payee: string;
      source_id: string | null;
    }>();
  const items = matchRecurring(rows, transactions, month).map(
    ({ r, due, match }) => ({
      ...r,
      due_date: due,
      arrived: !!match,
      transaction_id: match?.id ?? null,
      actual_cents: match?.amount_cents ?? 0,
    }),
  );
  const summary: Record<
    string,
    Record<string, { expected: number; actual: number }>
  > = {};
  for (const item of items) {
    const bucket = (summary[item.currency] ??= {
      income: { expected: 0, actual: 0 },
      expense: { expected: 0, actual: 0 },
    });
    const side = bucket[item.amount_cents < 0 ? 'income' : 'expense'];
    side.expected += Math.abs(item.amount_cents);
    side.actual += Math.abs(item.actual_cents);
  }
  return c.json({ items, summary });
});
async function projectedRecurring(
  db: D1Database,
  fromMonth: string,
  toMonth: string,
) {
  const rows = (
    await db
      .prepare(
        recurringSql +
          ' WHERE r.active=1 AND a.closed_at IS NULL AND a.archived=0',
      )
      .all<Recurring>()
  ).results;
  const tx = (
    await db
      .prepare(
        `SELECT t.id,t.account_id,t.amount_cents,t.date,COALESCE(p.name,t.payee) AS payee,(SELECT recurring_id FROM recurring_sources WHERE transaction_id=t.id) AS source_id FROM active_transactions t LEFT JOIN payees p ON p.id=t.payee_id WHERE (kind='regular' OR (kind='installment' AND installment_number IS NOT NULL)) AND origin<>'adjustment' AND date BETWEEN date(?,'-7 days') AND date(?,'+7 days')`,
      )
      .bind(
        monthBounds(shiftMonth(fromMonth, -1)).from,
        monthBounds(shiftMonth(toMonth, 1)).to,
      )
      .all<{
        id: string;
        account_id: string;
        amount_cents: number;
        date: string;
        payee: string;
        source_id: string | null;
      }>()
  ).results;
  const projected: { r: Recurring; date: string }[] = [];
  for (let month = fromMonth; month <= toMonth; month = shiftMonth(month, 1)) {
    for (const { r, due, match } of matchRecurring(rows, tx, month))
      if (!match) projected.push({ r, date: due });
  }
  return projected;
}
app.get('/api/cards/:id/commitment', async (c) => {
  const db = c.var.DB,
    card = await db
      .prepare("SELECT * FROM accounts WHERE id=? AND kind='credit_card'")
      .bind(c.req.param('id'))
      .first<Account>();
  if (!card) return fail('Cartão não encontrado.', 404);
  const last = (
    await db
      .prepare(
        'SELECT MAX(closing_date) AS last FROM statements WHERE account_id=?',
      )
      .bind(card.id)
      .first<{ last: string | null }>()
  )?.last;
  const month = c.var.today.slice(0, 7);
  const horizon =
    last && last > monthBounds(shiftMonth(month, 1)).to
      ? last
      : monthBounds(shiftMonth(month, 1)).to;
  const projections = await projectedRecurring(db, month, horizon.slice(0, 7));
  let expected = 0;
  for (const p of projections.filter(
    (p) =>
      p.r.account_id === card.id && p.date >= c.var.today && p.date <= horizon,
  )) {
    const cycle = await resolvedCycle(db, card, p.date);
    const st = await db
      .prepare(
        'SELECT status FROM statements WHERE account_id=? AND scheduled_closing_date=?',
      )
      .bind(card.id, cycle.scheduledClosingDate)
      .first();
    if (!st || st.status === 'open')
      expected = cents(expected + p.r.amount_cents);
  }
  const outstanding = Number(
    (await db
      .prepare(
        "SELECT COALESCE(SUM(COALESCE(bank_amount_cents,total_cents)-paid_cents-carried_out_cents),0) AS amount FROM statement_totals WHERE account_id=? AND status<>'paid'",
      )
      .bind(card.id)
      .first())!.amount,
  );
  const committed = Math.max(0, cents(outstanding + expected));
  return c.json({
    committed_cents: committed,
    credit_limit_cents: card.credit_limit_cents,
    available_cents:
      card.credit_limit_cents == null
        ? null
        : cents(card.credit_limit_cents - committed),
    recurring_until: horizon,
  });
});
app.get('/api/upcoming', async (c) => {
  const db = c.var.DB,
    from = c.var.today,
    to = monthBounds(shiftMonth(from.slice(0, 7), 1)).to;
  type Component = {
    id: string;
    type: string;
    label: string;
    amount_cents: number;
  };
  type Due = {
    id: string;
    type: string;
    label: string;
    date: string;
    amount_cents: number;
    currency: string;
    account_id: string;
    account_name: string;
    components: Component[];
  };
  const accounts = (
    await db
      .prepare(
        'SELECT * FROM accounts WHERE cutoff_date IS NOT NULL AND archived=0 AND closed_at IS NULL',
      )
      .all<Account>()
  ).results;
  const items: Due[] = [];
  const statements = (
    await db
      .prepare(
        `SELECT s.*,COALESCE(bank_amount_cents,total_cents)-paid_cents-carried_out_cents AS remaining_cents FROM statement_totals s WHERE s.due_date BETWEEN ? AND ? AND s.status<>'paid'`,
      )
      .bind(from, to)
      .all<Statement>()
  ).results;
  for (const st of statements) {
    const a = accounts.find((a) => a.id === st.account_id);
    if (!a) continue;
    const components = (
      await db
        .prepare(
          `SELECT id,payee AS label,CASE WHEN installment_number IS NOT NULL THEN 'installment' ELSE 'purchase' END AS type,amount_cents FROM statement_items WHERE statement_id=?`,
        )
        .bind(st.id)
        .all<Component>()
    ).results;
    if (st.previous_balance_cents)
      components.push({
        id: 'balance-' + st.id,
        type: 'balance',
        label: 'Saldo anterior',
        amount_cents: st.previous_balance_cents,
      });
    items.push({
      id: st.id,
      type: 'statement',
      label: 'Fatura ' + a.name,
      date: st.due_date,
      amount_cents: st.remaining_cents!,
      currency: a.currency,
      account_id: a.id,
      account_name: a.name,
      components,
    });
  }
  const projected = await projectedRecurring(
    db,
    shiftMonth(from.slice(0, 7), -1),
    to.slice(0, 7),
  );
  for (const p of projected) {
    const a = accounts.find((a) => a.id === p.r.account_id);
    if (!a) continue;
    if (a.kind !== 'credit_card') {
      if (p.date >= from && p.date <= to)
        items.push({
          id: p.r.id + p.date,
          type: 'recurring',
          label: p.r.payee,
          date: p.date,
          amount_cents: p.r.amount_cents,
          currency: a.currency,
          account_id: a.id,
          account_name: a.name,
          components: [],
        });
      continue;
    }
    const cycle = await resolvedCycle(db, a, p.date);
    if (cycle.dueDate < from || cycle.dueDate > to) continue;
    let st = await db
      .prepare(
        'SELECT id,status FROM statements WHERE account_id=? AND scheduled_closing_date=?',
      )
      .bind(a.id, cycle.scheduledClosingDate)
      .first<{ id: string; status: string }>();
    if (st && st.status !== 'open') continue;
    if (!st) {
      await insertCycle(db, a.id, cycle).run();
      st = await db
        .prepare(
          'SELECT id,status FROM statements WHERE account_id=? AND scheduled_closing_date=?',
        )
        .bind(a.id, cycle.scheduledClosingDate)
        .first<{ id: string; status: string }>();
    }
    let invoice = items.find(
      (i) =>
        i.account_id === a.id &&
        i.date === cycle.dueDate &&
        i.type === 'statement',
    );
    if (!invoice) {
      invoice = {
        id: st?.id ?? a.id + cycle.closingDate,
        type: 'statement',
        label: 'Fatura ' + a.name,
        date: cycle.dueDate,
        amount_cents: 0,
        currency: a.currency,
        account_id: a.id,
        account_name: a.name,
        components: [],
      };
      items.push(invoice);
    }
    invoice.amount_cents = cents(invoice.amount_cents + p.r.amount_cents);
    invoice.components.push({
      id: p.r.id + p.date,
      type: 'recurring',
      label: p.r.payee + ' (previsto)',
      amount_cents: p.r.amount_cents,
    });
  }
  return c.json({
    from,
    to,
    items: items
      .filter((i) => i.amount_cents !== 0)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.label.localeCompare(b.label),
      ),
  });
});

app.get('/api/subscriptions', async (c) => {
  const { results } = await c.var.DB.prepare(
    recurringSql +
      ' WHERE r.is_subscription=1 AND r.active=1 ORDER BY st.sort,r.payee',
  ).all<Recurring>();
  return c.json(
    results.map((r) => ({
      ...r,
      next_charge: nextOccurrence(r, c.var.today),
      monthly_cents: monthlyEquivalent(
        r.amount_cents,
        r.cadence,
        r.interval_days,
      ),
      renewal_soon: renewalSoon(r.renewal_date, c.var.today, r.notice_days),
    })),
  );
});
for (const method of ['post', 'patch'] as const)
  app[method](
    `/api/recurring${method === 'patch' ? '/:id' : ''}`,
    async (c) => {
      const db = c.var.DB;
      const b = object(await c.req.json());
      keys(b, [
        'account_id',
        'payee',
        'amount_cents',
        'category_id',
        'cadence',
        'next_date',
        'interval_days',
        'description',
        'is_subscription',
        'subscription_type_id',
        'renewal_date',
        'notice_days',
        'active',
        'transaction_id',
      ]);
      const id = method === 'patch' ? c.req.param('id') : crypto.randomUUID();
      const old =
        method === 'patch'
          ? await db
              .prepare('SELECT * FROM recurring WHERE id=?')
              .bind(id)
              .first()
          : null;
      if (method === 'patch' && !old) fail('Recorrente não encontrado.', 404);
      const r = { ...old, ...b };
      const account = await db
        .prepare(
          "SELECT id FROM accounts WHERE id=? AND kind IN ('checking','cash','credit_card') AND archived=0 AND closed_at IS NULL",
        )
        .bind(text(r.account_id, 'Conta'))
        .first();
      if (!account) fail('Conta indisponível.');
      r.payee = text(r.payee, 'Beneficiário');
      r.amount_cents = cents(r.amount_cents);
      if (!r.amount_cents) fail('Informe valor diferente de zero.');
      if (r.category_id != null) await exists(db, 'categories', r.category_id);
      if (
        !['monthly', 'yearly', 'weekly', 'custom'].includes(String(r.cadence))
      )
        fail('Frequência inválida.');
      r.next_date = date(r.next_date);
      if (
        r.cadence === 'custom' &&
        (!Number.isInteger(r.interval_days) ||
          Number(r.interval_days) < 1 ||
          Number(r.interval_days) > 3660)
      )
        fail('Informe o intervalo em dias, de 1 a 3660.');
      r.is_subscription = r.is_subscription ?? 0;
      r.active = r.active ?? 1;
      if (
        ![0, 1].includes(r.is_subscription as number) ||
        ![0, 1].includes(r.active as number)
      )
        fail('Estado inválido.');
      if (r.subscription_type_id != null)
        await exists(db, 'subscription_types', r.subscription_type_id);
      if (
        r.interval_days != null &&
        (!Number.isSafeInteger(r.interval_days) ||
          Number(r.interval_days) < 1 ||
          Number(r.interval_days) > 3660)
      )
        fail('Intervalo inválido.');
      if (r.is_subscription === 1) {
        await exists(db, 'subscription_types', r.subscription_type_id);
        if (r.renewal_date == null) fail('Informe a renovação.');
      }
      r.notice_days = cents(r.notice_days ?? 30);
      if (Number(r.notice_days) < 0 || Number(r.notice_days) > 3660)
        fail('Prazo de aviso deve ficar entre 0 e 3660 dias.');
      if (r.renewal_date != null) r.renewal_date = date(r.renewal_date);
      if (
        typeof (r.description ?? '') !== 'string' ||
        String(r.description ?? '').length > 2000
      )
        fail('Descrição inválida.');
      const fields = [
        'account_id',
        'payee',
        'amount_cents',
        'category_id',
        'cadence',
        'next_date',
        'interval_days',
        'description',
        'is_subscription',
        'subscription_type_id',
        'renewal_date',
        'notice_days',
        'active',
      ];
      const values = fields.map(
        (k) => r[k] ?? (k === 'description' ? '' : null),
      );
      const writes = [
        method === 'post'
          ? db
              .prepare(
                `INSERT INTO recurring(id,${fields.join(',')}) VALUES(?,${fields.map(() => '?').join(',')})`,
              )
              .bind(id, ...values)
          : db
              .prepare(
                `UPDATE recurring SET ${fields.map((k) => `${k}=?`).join(',')} WHERE id=?`,
              )
              .bind(...values, id),
      ];
      if (b.transaction_id !== undefined) {
        const t = await db
          .prepare(
            "SELECT id FROM active_transactions WHERE id=? AND account_id=? AND (kind='regular' OR (kind='installment' AND installment_number IS NOT NULL)) AND origin<>'adjustment'",
          )
          .bind(text(b.transaction_id), r.account_id)
          .first();
        if (!t) fail('Escolha uma compra ou parcela ativa.');
        writes.push(
          db
            .prepare(
              'INSERT INTO recurring_sources(recurring_id,transaction_id) VALUES(?,?)',
            )
            .bind(id, b.transaction_id),
        );
      }
      await db.batch(writes);
      return c.json({ id }, method === 'post' ? 201 : 200);
    },
  );
app.all('/api/*', (c) => c.json({ error: 'Rota não encontrada.' }, 404));
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));
export default app;

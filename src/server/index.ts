import { Hono } from 'hono';
import { ptax, convert } from './fx';
import type { Account } from '../shared/types';
type Bindings = { DB: D1Database; ASSETS: Fetcher };
const app = new Hono<{ Bindings: Bindings }>();
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
    fail(
      'Campo não permitido. Somente categoria e nota podem ser editadas nesta sessão.',
    );
}
app.onError((error, c) => {
  if (error instanceof InputError)
    return c.json({ error: error.message }, error.status);
  if (error instanceof SyntaxError)
    return c.json({ error: 'JSON inválido.' }, 400);
  if (String(error.cause ?? error).includes('UNIQUE constraint failed'))
    return c.json({ error: 'Já existe um registro com esse nome.' }, 409);
  console.error('Falha interna na operação D1.');
  return c.json(
    { error: 'Não foi possível concluir a operação. Tente novamente.' },
    500,
  );
});
app.use('/api/*', async (c, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.req.method)) {
    const origin = c.req.header('Origin');
    if (origin && origin !== new URL(c.req.url).origin)
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
  await next();
});
app.get('/api/health', async (c) => {
  await c.env.DB.prepare('SELECT 1').first();
  return c.json({ ok: true });
});
const balanceSql = `CASE WHEN a.cutoff_date IS NULL THEN
 -COALESCE((SELECT SUM(t.amount_cents) FROM transactions t WHERE t.account_id=a.id AND t.date<=date('now')),0)
 ELSE a.opening_balance_cents-COALESCE((SELECT SUM(t.amount_cents) FROM transactions t WHERE t.account_id=a.id AND t.date>a.cutoff_date AND t.date<=date('now')),0) END`;
app.get('/api/accounts', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, i.name AS institution_name, ${balanceSql} AS balance_cents FROM accounts a LEFT JOIN institutions i ON i.id=a.institution_id ORDER BY i.sort,i.name,a.name`,
  ).all<Account>();
  return c.json(results);
});
app.get('/api/account-options', async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        'SELECT id,name,currency FROM accounts WHERE closed_at IS NULL AND archived=0 ORDER BY name',
      ).all()
    ).results,
  ),
);
app.get('/api/categories', async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        'SELECT c.*, g.name AS group_name, ag.name AS allocation_name FROM categories c JOIN category_groups g ON g.id=c.category_group_id JOIN allocation_groups ag ON ag.id=g.allocation_group_id ORDER BY g.sort,c.sort,c.name',
      ).all()
    ).results,
  ),
);
app.get('/api/transactions', async (c) => {
  const query = c.req.query();
  const conditions: string[] = [];
  const params: string[] = [];
  for (const [key, column] of [
    ['account', 'account_id'],
    ['category', 'category_id'],
    ['origin', 'origin'],
  ] as const)
    if (query[key]) {
      conditions.push(`t.${column}=?`);
      params.push(query[key]);
    }
  if (
    query.origin &&
    !['manual', 'imported', 'adjustment'].includes(query.origin)
  )
    fail('Origem inválida.');
  if (query.tag) {
    conditions.push(
      'EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id=t.id AND tt.tag_id=?)',
    );
    params.push(query.tag);
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
  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM transactions t ${where}`,
  )
    .bind(...params)
    .first<{ count: number }>();
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, COALESCE(canonical.name,p.name,t.payee) AS payee, COALESCE(p.merged_into_id,p.id) AS payee_id, a.name AS account_name, ag.name AS allocation_name, (SELECT json_group_array(json_object('id',tags.id,'name',tags.name,'color',tags.color)) FROM transaction_tags tt JOIN tags ON tags.id=tt.tag_id WHERE tt.transaction_id=t.id) AS tags_json FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN payees p ON p.id=t.payee_id LEFT JOIN payees canonical ON canonical.id=p.merged_into_id LEFT JOIN categories cat ON cat.id=t.category_id LEFT JOIN category_groups cg ON cg.id=cat.category_group_id LEFT JOIN allocation_groups ag ON ag.id=cg.allocation_group_id ${where} ORDER BY t.date DESC,t.id LIMIT 50 OFFSET ?`,
  )
    .bind(...params, (page - 1) * 50)
    .all();
  const tagged = results.map(({ tags_json, ...t }) => ({
    ...t,
    tags: JSON.parse(String(tags_json)),
  }));
  return c.json({ items: tagged, total: total!.count, page, page_size: 50 });
});
app.patch('/api/transactions/:id', async (c) => {
  const body = object(await c.req.json());
  keys(body, ['category_id', 'note']);
  if (!Object.keys(body).length) fail('Informe categoria ou nota.');
  const transaction = await c.env.DB.prepare(
    'SELECT id FROM transactions WHERE id=?',
  )
    .bind(c.req.param('id'))
    .first();
  if (!transaction) fail('Transação não encontrada.', 404);
  const fields: string[] = [];
  const values: (string | null)[] = [];
  if ('category_id' in body) {
    if (body.category_id !== null && typeof body.category_id !== 'string')
      fail('Categoria inválida.');
    if (
      body.category_id !== null &&
      !(await c.env.DB.prepare('SELECT id FROM categories WHERE id=?')
        .bind(body.category_id)
        .first())
    )
      fail('Categoria não encontrada.');
    fields.push('category_id=?');
    values.push(body.category_id as string | null);
  }
  if ('note' in body) {
    if (typeof body.note !== 'string' || body.note.length > 2000)
      fail('Nota deve ter até 2000 caracteres.');
    fields.push('note=?');
    values.push(body.note as string);
  }
  await c.env.DB.prepare(
    `UPDATE transactions SET ${fields.join(',')} WHERE id=?`,
  )
    .bind(...values, c.req.param('id'))
    .run();
  return c.json({ ok: true });
});
async function activation(
  db: D1Database,
  id: string,
  body: Record<string, unknown>,
) {
  keys(body, ['cutoff_date', 'opening_balance_cents', 'fx_rate']);
  const cutoff = date(body.cutoff_date);
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
      'SELECT -COALESCE(SUM(amount_cents),0) AS balance FROM transactions WHERE account_id=? AND date<=?',
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
    c.env.DB,
    c.req.param('id'),
    object(await c.req.json()),
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
  const a = await activation(c.env.DB, accountId, body);
  const id = crypto.randomUUID();
  // D1 batch is transactional. Compute the adjustment again inside the write transaction.
  const result = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO transactions (id,account_id,date,amount_cents,payee,note,origin,kind,activation_account_id,currency,fx_rate,amount_brl_cents,fx_source)
   SELECT ?,a.id,?,(SELECT -COALESCE(SUM(amount_cents),0) FROM transactions WHERE account_id=a.id AND date<=?)-?,
   'Ajuste de abertura','Diferença entre o arquivo e o saldo de abertura informado.','adjustment','regular',a.id,a.currency,?,round(((SELECT -COALESCE(SUM(amount_cents),0) FROM transactions WHERE account_id=a.id AND date<=?)-?)*?),?
   FROM accounts a WHERE a.id=? AND a.cutoff_date IS NULL AND a.archived=0 AND a.closed_at IS NULL`,
    ).bind(
      id,
      a.cutoff,
      a.cutoff,
      a.opening,
      a.q.rate,
      a.cutoff,
      a.opening,
      a.q.rate,
      a.q.source,
      accountId,
    ),
    c.env.DB.prepare(
      `UPDATE accounts SET cutoff_date=?,opening_balance_cents=? WHERE id=? AND cutoff_date IS NULL AND EXISTS (SELECT 1 FROM transactions WHERE id=?)`,
    ).bind(a.cutoff, a.opening, accountId, id),
  ]);
  if (result[1].meta.changes !== 1)
    fail('Esta conta já foi ativada. Atualize a lista.', 409);
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
  if (code === 'BRL') return { rate: 1, source: 'manual' };
  if (manual !== undefined) {
    if (
      typeof manual !== 'number' ||
      !Number.isFinite(manual) ||
      manual <= 0 ||
      manual > 1000000
    )
      fail('Cotação inválida.');
    return { rate: manual as number, source: 'manual' };
  }
  try {
    return { rate: await quote(db, code, day), source: 'ptax' };
  } catch {
    return fail('PTAX indisponível. Informe a cotação manualmente.');
  }
}
function converted(amount: number, rate: number) {
  try {
    return convert(amount, rate);
  } catch {
    return fail('Valor convertido fora do limite.');
  }
}
app.get('/api/fx', async (c) => {
  const code = currency(c.req.query('currency'));
  const day = date(c.req.query('date'));
  try {
    return c.json({ rate: await quote(c.env.DB, code, day), source: 'ptax' });
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
      await c.env.DB.prepare(
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
  ]);
  const name = text(b.name);
  const code = currency(b.currency ?? 'BRL');
  if (!['checking', 'credit_card', 'cash'].includes(String(b.kind)))
    fail('Tipo inválido.');
  await exists(c.env.DB, 'institutions', b.institution_id);
  const opening = cents(b.opening_balance_cents ?? 0);
  for (const field of ['closing_day', 'due_day'])
    if (
      b[field] != null &&
      (!Number.isInteger(b[field]) ||
        Number(b[field]) < 1 ||
        Number(b[field]) > 31)
    )
      fail('Dia inválido.');
  const id = crypto.randomUUID();
  // Corte no dia anterior permite lançamentos no próprio dia da criação.
  await c.env.DB.prepare(
    "INSERT INTO accounts(id,name,kind,currency,institution_id,opening_balance_cents,cutoff_date,closing_day,due_day) VALUES(?,?,?,?,?,?,date('now','-1 day'),?,?)",
  )
    .bind(
      id,
      name,
      b.kind,
      code,
      b.institution_id,
      opening,
      b.closing_day ?? null,
      b.due_day ?? null,
    )
    .run();
  return c.json({ id }, 201);
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
  ]);
  if (typeof b.account_id !== 'string') fail('Conta inválida.');
  const day = date(b.date);
  const amount = cents(b.amount_cents);
  if (!amount) fail('Informe valor diferente de zero.');
  const name = text(b.payee, 'Beneficiário');
  const account = await c.env.DB.prepare('SELECT * FROM accounts WHERE id=?')
    .bind(b.account_id)
    .first<Account>();
  if (!account) fail('Conta não encontrada.', 404);
  if (account!.closed_at || account!.archived) fail('Conta encerrada.', 409);
  if (!account!.cutoff_date) fail('Ative a conta antes de lançar.', 409);
  if (day <= account!.cutoff_date!)
    fail('O lançamento deve ser posterior ao corte.');
  if (b.category_id != null)
    await exists(c.env.DB, 'categories', b.category_id);
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
  for (const id of tags) await exists(c.env.DB, 'tags', id);
  const q = await fx(c.env.DB, account!.currency, day, b.fx_rate);
  const brl = converted(amount, q.rate);
  const id = crypto.randomUUID();
  const payeeId = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO payees(id,name) VALUES(?,?) ON CONFLICT(name) DO NOTHING',
    ).bind(payeeId, name),
    c.env.DB.prepare(
      "INSERT INTO transactions(id,account_id,date,amount_cents,currency,fx_rate,amount_brl_cents,fx_source,payee,payee_id,category_id,note,origin,kind) SELECT ?,?,?,?,?,?,?,?,?,COALESCE(merged_into_id,id),?,?,'manual','regular' FROM payees WHERE name=? COLLATE NOCASE",
    ).bind(
      id,
      account!.id,
      day,
      amount,
      account!.currency,
      q.rate,
      brl,
      q.source,
      name,
      b.category_id ?? null,
      b.note ?? '',
      name,
    ),
    ...tags.map((tag) =>
      c.env.DB.prepare('INSERT INTO transaction_tags VALUES(?,?)').bind(
        id,
        tag,
      ),
    ),
  ]);
  return c.json(
    { id, amount_brl_cents: brl, fx_rate: q.rate, fx_source: q.source },
    201,
  );
});
app.get('/api/payees', async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        `SELECT p.id,p.name,COUNT(t.id) AS count,MIN(t.date) AS first_date,MAX(t.date) AS last_date FROM payees p LEFT JOIN payees alias ON alias.id=p.id OR alias.merged_into_id=p.id LEFT JOIN transactions t ON t.payee_id=alias.id WHERE p.merged_into_id IS NULL GROUP BY p.id ORDER BY p.name`,
      ).all()
    ).results,
  ),
);
app.get('/api/payees/suggestion', async (c) => {
  const name = text(c.req.query('name'), 'Beneficiário');
  const last = await c.env.DB.prepare(
    `SELECT t.id,t.category_id FROM transactions t JOIN payees p ON p.id=t.payee_id WHERE COALESCE(p.merged_into_id,p.id)=(SELECT COALESCE(merged_into_id,id) FROM payees WHERE name=? COLLATE NOCASE) AND t.origin<>'adjustment' ORDER BY t.date DESC,t.created_at DESC,t.id DESC LIMIT 1`,
  )
    .bind(name)
    .first<{ id: string; category_id: string | null }>();
  const tags = last
    ? (
        await c.env.DB.prepare(
          'SELECT tag_id FROM transaction_tags WHERE transaction_id=?',
        )
          .bind(last.id)
          .all<{ tag_id: string }>()
      ).results.map((t) => t.tag_id)
    : [];
  return c.json({ category_id: last?.category_id ?? null, tag_ids: tags });
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
  const target = await c.env.DB.prepare(
    'SELECT id FROM payees WHERE id=? AND merged_into_id IS NULL',
  )
    .bind(b.target_id)
    .first();
  if (!target) fail('Destino inválido.');
  const sources = [...new Set(b.source_ids as string[])];
  for (const id of sources) {
    await exists(c.env.DB, 'payees', id);
    const source = await c.env.DB.prepare(
      'SELECT merged_into_id FROM payees WHERE id=?',
    )
      .bind(id)
      .first();
    if (source!.merged_into_id) fail('Beneficiário já unificado.', 409);
  }
  await c.env.DB.batch(
    sources.map((id) =>
      c.env.DB.prepare(
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
  const bank = cents(b.bank_balance_cents);
  const a = await c.env.DB.prepare(
    `SELECT a.*,${balanceSql} AS balance_cents FROM accounts a WHERE id=?`,
  )
    .bind(c.req.param('id'))
    .first<Account>();
  if (!a) fail('Conta não encontrada.', 404);
  if (a!.closed_at || a!.archived || !a!.cutoff_date)
    fail('Confira uma conta ativa.', 409);
  if (a!.cutoff_date! >= new Date().toISOString().slice(0, 10))
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
  const day = new Date().toISOString().slice(0, 10);
  const q = await fx(c.env.DB, a!.currency, day, b.fx_rate);
  const id = crypto.randomUUID();
  const tx = crypto.randomUUID();
  const brl = converted(adjustment, q.rate);
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO reconciliations(id,account_id,date,bank_balance_cents,app_balance_cents) SELECT ?,a.id,?,?,? FROM accounts a WHERE a.id=? AND a.closed_at IS NULL AND a.archived=0 AND a.cutoff_date IS NOT NULL AND ${balanceSql}=?`,
    ).bind(id, day, bank, a!.balance_cents, a!.id, a!.balance_cents),
    c.env.DB.prepare(
      "INSERT INTO transactions(id,account_id,date,amount_cents,currency,fx_rate,amount_brl_cents,fx_source,payee,note,origin,kind) SELECT ?,account_id,date,app_balance_cents-bank_balance_cents,?,?,?,?,'Conferência de saldo','Ajuste visível da conferência de saldo.','adjustment','regular' FROM reconciliations WHERE id=? AND app_balance_cents<>bank_balance_cents",
    ).bind(tx, a!.currency, q.rate, brl, q.source, id),
    c.env.DB.prepare(
      'UPDATE reconciliations SET adjustment_transaction_id=(SELECT id FROM transactions WHERE id=?) WHERE id=?',
    ).bind(tx, id),
    c.env.DB.prepare(
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
  tags: ['name', 'color'],
  'allocation-groups': ['name', 'target_percent'],
  'category-groups': ['name', 'allocation_group_id'],
  categories: ['name', 'category_group_id', 'is_income'],
} as const;
for (const [route, fields] of Object.entries(configTables)) {
  const table = route.replaceAll('-', '_');
  if (route !== 'categories' && route !== 'institutions')
    app.get(`/api/${route}`, async (c) =>
      c.json(
        (await c.env.DB.prepare(`SELECT * FROM ${table} ORDER BY name`).all())
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
          await exists(c.env.DB, 'allocation_groups', b.allocation_group_id);
        if (route === 'categories') {
          if (method === 'post' || 'category_group_id' in b)
            await exists(c.env.DB, 'category_groups', b.category_group_id);
          if ('is_income' in b && ![0, 1].includes(b.is_income as number))
            fail('Tipo de categoria inválido.');
        }
        const id = method === 'post' ? crypto.randomUUID() : c.req.param('id');
        if (method === 'patch') await exists(c.env.DB, table, id);
        const columns = Object.keys(b);
        if (method === 'post')
          await c.env.DB.prepare(
            `INSERT INTO ${table}(id,${columns.join(',')}) VALUES(?,${columns.map(() => '?').join(',')})`,
          )
            .bind(id, ...Object.values(b))
            .run();
        else
          await c.env.DB.prepare(
            `UPDATE ${table} SET ${columns.map((k) => `${k}=?`).join(',')} WHERE id=?`,
          )
            .bind(...Object.values(b), id)
            .run();
        return c.json({ id }, method === 'post' ? 201 : 200);
      },
    );
}
app.all('/api/*', (c) => c.json({ error: 'Rota não encontrada.' }, 404));
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));
export default app;

import { Hono } from 'hono';
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
app.get('/api/accounts', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, CASE WHEN a.cutoff_date IS NULL THEN
 -COALESCE((SELECT SUM(t.amount_cents) FROM transactions t WHERE t.account_id=a.id),0)
 ELSE a.opening_balance_cents-COALESCE((SELECT SUM(t.amount_cents) FROM transactions t WHERE t.account_id=a.id AND t.date>a.cutoff_date),0) END AS balance_cents
 FROM accounts a ORDER BY a.kind,a.name`,
  ).all<Account>();
  return c.json(results);
});
app.get('/api/categories', async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        'SELECT c.*, g.name AS group_name FROM categories c JOIN category_groups g ON g.id=c.category_group_id ORDER BY g.sort,c.sort,c.name',
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
    `SELECT t.*, a.name AS account_name FROM transactions t JOIN accounts a ON a.id=t.account_id ${where} ORDER BY t.date DESC,t.id LIMIT 50 OFFSET ?`,
  )
    .bind(...params, (page - 1) * 50)
    .all();
  return c.json({ items: results, total: total!.count, page, page_size: 50 });
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
  keys(body, ['cutoff_date', 'opening_balance_cents']);
  const cutoff = date(body.cutoff_date);
  const opening = cents(body.opening_balance_cents);
  const account = await db
    .prepare('SELECT * FROM accounts WHERE id=?')
    .bind(id)
    .first<Account>();
  if (!account) return fail('Conta não encontrada.', 404);
  if (account.cutoff_date) fail('Esta conta já está ativa.', 409);
  if (account.archived) fail('Conta arquivada não pode ser ativada.', 409);
  const archive = await db
    .prepare(
      'SELECT -COALESCE(SUM(amount_cents),0) AS balance FROM transactions WHERE account_id=? AND date<=?',
    )
    .bind(id, cutoff)
    .first<{ balance: number }>();
  const adjustment = archive!.balance - opening;
  cents(archive!.balance);
  cents(adjustment);
  return { cutoff, opening, archive: archive!.balance, adjustment };
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
      `INSERT INTO transactions (id,account_id,date,amount_cents,payee,note,origin,kind,activation_account_id)
   SELECT ?,a.id,?,(SELECT -COALESCE(SUM(amount_cents),0) FROM transactions WHERE account_id=a.id AND date<=?)-?,
   'Ajuste de abertura','Diferença entre o arquivo e o saldo de abertura informado.','adjustment','regular',a.id
   FROM accounts a WHERE a.id=? AND a.cutoff_date IS NULL AND a.archived=0`,
    ).bind(id, a.cutoff, a.cutoff, a.opening, accountId),
    c.env.DB.prepare(
      `UPDATE accounts SET cutoff_date=?,opening_balance_cents=? WHERE id=? AND cutoff_date IS NULL AND EXISTS (SELECT 1 FROM transactions WHERE id=?)`,
    ).bind(a.cutoff, a.opening, accountId, id),
  ]);
  if (result[1].meta.changes !== 1)
    fail('Esta conta já foi ativada. Atualize a lista.', 409);
  return c.json({ ok: true, adjustment_id: id }, 201);
});
app.all('/api/*', (c) => c.json({ error: 'Rota não encontrada.' }, 404));
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));
export default app;

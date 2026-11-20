export type TransactionSnapshot = Record<string, unknown> & {
  id: string;
  account_id: string;
  payee: string;
  kind: string;
  origin: string;
  tag_ids: string[];
  splits: {
    id: string;
    position: number;
    amount_cents: number;
    amount_brl_cents: number;
    category_id: string | null;
    note: string;
    tag_ids: string[];
  }[];
  recurring_id: string | null;
  cancellation: { reason: string; created_at: string } | null;
};

export type TransactionChange = {
  transaction_id: string;
  before: TransactionSnapshot | null;
  after: TransactionSnapshot | null;
};

export type TransactionHistory = {
  id: string;
  source: string;
  created_at: string;
  changes: TransactionChange[];
};

export const finishActionSql =
  'UPDATE transaction_actions SET complete=1 WHERE id=(SELECT action_id FROM transaction_action_context)';

export const importActionStartSql = [
  "INSERT INTO transaction_actions(id,source,created_at) VALUES(lower(hex(randomblob(16))),'importação',strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
  'INSERT INTO transaction_action_context SELECT 1,id FROM transaction_actions WHERE rowid=last_insert_rowid()',
];

export function historySource(path: string, method: string) {
  if (method === 'GET' || method === 'HEAD') return null;
  if (path.endsWith('/restore-field')) return 'histórico';
  if (path === '/api/transactions/batch' || path === '/api/payees/merge')
    return 'lote';
  if (path.endsWith('/splits')) return 'divisão';
  if (
    /\/installment-plans\/|\/(installment-edit|cancel-future|move-statement)$/.test(
      path,
    )
  )
    return 'parcelas';
  if (path.endsWith('/pay')) return 'pagamento de fatura';
  if (/^\/api\/(accounts\/[^/]+\/(activate|reconcile)|statements\/)/.test(path))
    return 'conferência';
  if (path === '/api/recurring') return 'recorrente';
  if (path === '/api/transfers') return 'transferência';
  if (path === '/api/transactions') return 'lançamento';
  if (/^\/api\/transactions\/[^/]+$/.test(path)) return 'célula';
  return null;
}

export function actionDatabase(
  db: D1Database,
  source: string,
  onAction: (id: string) => void,
): D1Database {
  return new Proxy(db, {
    get(target, property) {
      if (property === 'batch')
        return async (writes: D1PreparedStatement[]) => {
          const id = crypto.randomUUID();
          const results = await target.batch([
            target
              .prepare(
                'INSERT INTO transaction_actions(id,source,created_at) VALUES(?,?,?)',
              )
              .bind(id, source, new Date().toISOString()),
            target
              .prepare('INSERT INTO transaction_action_context VALUES(1,?)')
              .bind(id),
            ...writes,
            target.prepare(finishActionSql),
            target
              .prepare('SELECT id FROM transaction_actions WHERE id=?')
              .bind(id),
          ]);
          if (results.at(-1)?.results.length) onAction(id);
          return results.slice(2, -2);
        };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

type StoredChange = {
  transaction_id: string;
  before_json: string | null;
  after_json: string | null;
};

export function decodeChange(row: StoredChange): TransactionChange {
  return {
    transaction_id: row.transaction_id,
    before: row.before_json && JSON.parse(row.before_json),
    after: row.after_json && JSON.parse(row.after_json),
  };
}

export async function transactionHistory(db: D1Database, id: string) {
  const { results } = await db
    .prepare(
      `SELECT a.id,a.source,a.created_at,c.transaction_id,c.before_json,c.after_json
     FROM transaction_changes c JOIN transaction_actions a ON a.id=c.action_id
     WHERE c.action_id IN (SELECT action_id FROM transaction_changes WHERE transaction_id=?)
     ORDER BY a.rowid DESC,c.transaction_id`,
    )
    .bind(id)
    .all<StoredChange & Omit<TransactionHistory, 'changes'>>();
  const actions = new Map<string, TransactionHistory>();
  for (const row of results) {
    const action = actions.get(row.id) ?? {
      id: row.id,
      source: row.source,
      created_at: row.created_at,
      changes: [],
    };
    action.changes.push(decodeChange(row));
    actions.set(row.id, action);
  }
  return [...actions.values()];
}

export const restorableFields = [
  'account_id',
  'date',
  'amount_cents',
  'payee',
  'category_id',
  'note',
  'fx_rate',
  'tag_ids',
  'splits',
  'recurring_id',
] as const;

export function restoreSplits(
  db: D1Database,
  id: string,
  splits: TransactionSnapshot['splits'],
) {
  const writes = [
    db
      .prepare('DELETE FROM transaction_splits WHERE transaction_id=?')
      .bind(id),
  ];
  if (splits.length) {
    const json = JSON.stringify(splits);
    writes.push(
      db
        .prepare(
          `INSERT INTO transaction_splits(id,transaction_id,position,amount_cents,amount_brl_cents,category_id,note)
        SELECT value->>'id',?,value->>'position',value->>'amount_cents',value->>'amount_brl_cents',value->>'category_id',value->>'note'
        FROM json_each(?)`,
        )
        .bind(id, json),
      db
        .prepare(
          `INSERT INTO split_tags(split_id,tag_id)
        SELECT p.value->>'id',tag.value FROM json_each(?) p CROSS JOIN json_each(p.value->'tag_ids') tag`,
        )
        .bind(json),
    );
  }
  return writes;
}

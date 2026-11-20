import {
  decodeChange,
  restoreSplits,
  type StoredChange,
} from './transaction-history';

const transactionColumns = [
  'id',
  'account_id',
  'date',
  'amount_cents',
  'payee',
  'category_id',
  'note',
  'origin',
  'kind',
  'transfer_pair_id',
  'statement_id',
  'installment_plan_id',
  'external_id',
  'created_at',
  'activation_account_id',
  'currency',
  'fx_rate',
  'amount_brl_cents',
  'fx_source',
  'payee_id',
  'installment_number',
  'retroactive',
  'added_to_closed',
  'advance_id',
  'card_amount_cents',
];

const financialColumns = [
  'account_id',
  'date',
  'amount_cents',
  'payee',
  'currency',
  'fx_rate',
  'amount_brl_cents',
  'statement_id',
  'advance_id',
  'cancellation',
];

const dependencies = {
  accounts: 'id',
  statements: 'id',
  payees: 'id',
  installment_plans: 'id',
  installment_advances: 'id',
  recurring: 'id',
  statement_carryovers: 'source_statement_id',
  reconciliations: 'id',
  statement_checks: 'id',
  scheduled_statement_payments: 'payment_id',
} as const;

type Dependency = {
  entity: keyof typeof dependencies;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
};

export class UndoConflict extends Error {}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

function insertRecord(
  db: D1Database,
  table: string,
  row: Record<string, unknown>,
) {
  const columns = Object.keys(row);
  return db
    .prepare(
      `INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`,
    )
    .bind(...Object.values(row));
}

function updateRecord(
  db: D1Database,
  table: string,
  key: string,
  id: string,
  row: Record<string, unknown>,
) {
  return db
    .prepare(
      `UPDATE ${table} SET ${Object.keys(row)
        .map((column) => column + '=?')
        .join(',')} WHERE ${key}=?`,
    )
    .bind(...Object.values(row), id);
}

export async function reverseTransactionAction(
  db: D1Database,
  id: string,
  sessionId: string | null,
  direction: 'undo' | 'redo',
) {
  if (!sessionId)
    throw new UndoConflict('A sessão da página não está disponível.');
  const action = await db
    .prepare(
      `SELECT source FROM transaction_actions a WHERE id=? AND session_id=? AND complete=1
     AND NOT EXISTS(SELECT 1 FROM transaction_actions WHERE reverses_id=a.id)`,
    )
    .bind(id, sessionId)
    .first<{ source: string }>();
  if (!action || (direction === 'redo') !== (action.source === 'desfazer'))
    throw new UndoConflict('A ação não está disponível nesta sessão.');

  const { results: stored } = await db
    .prepare(
      'SELECT transaction_id,before_json,after_json FROM transaction_changes WHERE action_id=?',
    )
    .bind(id)
    .all<StoredChange>();
  const { results: affected } = await db
    .prepare(
      'SELECT entity,entity_id,before_json,after_json FROM transaction_action_dependencies WHERE action_id=?',
    )
    .bind(id)
    .all<Dependency>();

  const writes = [
    db
      .prepare(
        `INSERT INTO operation_guards VALUES('desfazer-transacoes',CASE WHEN
      NOT EXISTS(SELECT 1 FROM transaction_changes c LEFT JOIN transaction_snapshots s ON s.id=c.transaction_id
        WHERE c.action_id=? AND c.after_json IS NOT s.snapshot)
      AND NOT EXISTS(SELECT 1 FROM transaction_action_dependencies d LEFT JOIN transaction_dependency_snapshots s
        ON s.entity=d.entity AND s.id=d.entity_id WHERE d.action_id=? AND d.after_json IS NOT s.snapshot
        AND NOT (d.entity='statements' AND json_extract(d.before_json,'$.status')='open'
          AND json_extract(d.after_json,'$.status')='closed' AND d.before_json IS s.snapshot))
      THEN 1 ELSE 0 END)`,
      )
      .bind(id, id),
  ];
  const removeDependencies: D1PreparedStatement[] = [];
  const restoreParents: D1PreparedStatement[] = [];
  const restoreChildren: D1PreparedStatement[] = [];
  const removeParents: D1PreparedStatement[] = [];
  const changes = stored.map(decodeChange);
  const paymentStatements = new Set(
    changes
      .filter(
        ({ before, after }) =>
          (!before || !after) && (before ?? after)?.kind === 'card_payment',
      )
      .map(({ before, after }) => (before ?? after)!.statement_id),
  );

  for (const dependency of affected) {
    const { entity, entity_id, before_json, after_json } = dependency;
    const key = dependencies[entity];
    const parent = [
      'recurring',
      'installment_plans',
      'installment_advances',
    ].includes(entity);
    if (!before_json) {
      const bucket = parent ? removeParents : removeDependencies;
      bucket.push(
        db.prepare(`DELETE FROM ${entity} WHERE ${key}=?`).bind(entity_id),
      );
    } else {
      const row = JSON.parse(before_json) as Record<string, unknown>;
      if (
        entity === 'scheduled_statement_payments' &&
        !after_json &&
        affected.some(
          (dep) =>
            dep.before_json &&
            ((dep.entity === 'statements' &&
              dep.entity_id === row.statement_id &&
              JSON.parse(dep.before_json).status === 'paid') ||
              (dep.entity === 'statement_carryovers' &&
                dep.entity_id === row.statement_id)),
        )
      )
        row.applied = 1;
      const bucket = parent ? restoreParents : restoreChildren;
      bucket.push(
        after_json
          ? updateRecord(db, entity, key, entity_id, row)
          : insertRecord(db, entity, row),
      );
    }
    if (entity === 'statement_carryovers') {
      const row = JSON.parse((before_json ?? after_json)!) as {
        destination_statement_id: string;
      };
      writes.push(
        db
          .prepare(
            `INSERT INTO operation_guards VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM statements WHERE id=? AND status='open')
          THEN 1 ELSE 0 END)`,
          )
          .bind('saldo-anterior:' + entity_id, row.destination_statement_id),
      );
    }
    if (entity === 'statements' && !paymentStatements.has(entity_id)) {
      const statement = await db
        .prepare('SELECT status FROM statements WHERE id=?')
        .bind(entity_id)
        .first<{ status: string }>();
      if (statement?.status !== 'open')
        throw new UndoConflict(
          'Reabra a fatura antes de desfazer a alteração.',
        );
    }
  }

  const transactions: D1PreparedStatement[] = [];
  for (const { transaction_id: tx, before, after } of changes) {
    const changed = (field: string) => !same(before?.[field], after?.[field]);
    const snapshot = (before ?? after)!;
    const payment = snapshot.kind === 'card_payment';
    const financial = !before || !after || financialColumns.some(changed);
    if (snapshot.origin === 'imported' && financial)
      throw new UndoConflict(
        'Valor, data e movimentação de transação importada são protegidos.',
      );
    if (
      !payment &&
      (financial ||
        (snapshot.installment_number && action.source === 'edição de parcelas'))
    ) {
      for (const row of [before, after]) {
        if (!row) continue;
        const closed = await db
          .prepare(
            `SELECT 1 FROM statements WHERE status<>'open'
           AND (id=? OR (? IS NULL AND ?='regular' AND account_id=? AND ? BETWEEN period_start AND closing_date))`,
          )
          .bind(
            row.statement_id,
            row.statement_id,
            row.kind,
            row.account_id,
            row.date,
          )
          .first();
        if (closed)
          throw new UndoConflict(
            'Reabra a fatura antes de desfazer a alteração.',
          );
        writes.push(
          db
            .prepare(
              `INSERT INTO operation_guards VALUES(?,CASE WHEN NOT EXISTS(
             SELECT 1 FROM statements WHERE status<>'open'
             AND (id=? OR (? IS NULL AND ?='regular' AND account_id=? AND ? BETWEEN period_start AND closing_date))
           ) THEN 1 ELSE 0 END)`,
            )
            .bind(
              'fatura:' + tx + (row === before ? ':antes' : ':depois'),
              row.statement_id,
              row.statement_id,
              row.kind,
              row.account_id,
              row.date,
            ),
        );
      }
    }
    if (financial) {
      writes.push(
        db
          .prepare(
            `INSERT INTO operation_guards VALUES(?,CASE WHEN NOT EXISTS(
           SELECT 1 FROM accounts WHERE id IN (?,?) AND (closed_at IS NOT NULL OR archived<>0)
         ) THEN 1 ELSE 0 END)`,
          )
          .bind(
            'conta:' + tx,
            before?.account_id ?? null,
            after?.account_id ?? null,
          ),
      );
    }
    if (!before) {
      transactions.push(
        db.prepare('DELETE FROM transactions WHERE id=?').bind(tx),
      );
      continue;
    }
    const columns = transactionColumns.filter(changed);
    const row = Object.fromEntries(
      columns.map((field) => [field, before[field]]),
    );
    if (!after) transactions.push(insertRecord(db, 'transactions', row));
    else if (columns.length)
      transactions.push(updateRecord(db, 'transactions', 'id', tx, row));
    if (changed('splits') && (after || before.splits.length))
      transactions.push(...restoreSplits(db, tx, before.splits));
    if (changed('tag_ids') && (after || before.tag_ids.length)) {
      transactions.push(
        db
          .prepare('DELETE FROM transaction_tags WHERE transaction_id=?')
          .bind(tx),
      );
      transactions.push(
        db
          .prepare(
            'INSERT INTO transaction_tags(transaction_id,tag_id) SELECT ?,value FROM json_each(?)',
          )
          .bind(tx, JSON.stringify(before.tag_ids)),
      );
    }
    if (changed('recurring_id')) {
      transactions.push(
        db
          .prepare('DELETE FROM recurring_sources WHERE transaction_id=?')
          .bind(tx),
      );
      if (before.recurring_id)
        transactions.push(
          db
            .prepare('INSERT INTO recurring_sources VALUES(?,?)')
            .bind(before.recurring_id, tx),
        );
    }
    if (changed('cancellation')) {
      transactions.push(
        db
          .prepare(
            'DELETE FROM installment_cancellations WHERE transaction_id=?',
          )
          .bind(tx),
      );
      if (before.cancellation)
        transactions.push(
          insertRecord(db, 'installment_cancellations', {
            transaction_id: tx,
            ...before.cancellation,
          }),
        );
    }
  }
  await db.batch([
    ...writes,
    ...removeDependencies,
    ...restoreParents,
    ...transactions,
    ...restoreChildren,
    ...removeParents,
    db.prepare('DELETE FROM operation_guards'),
  ]);
}

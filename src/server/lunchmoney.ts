// Coleta e carga do Lunch Money. O token nunca entra neste módulo.
const SOURCE = 'lunchmoney';
const PAYMENT_TAG = 'pagamento de fatura';

export interface LunchMoneyAccount {
  id: number;
  name: string;
  display_name?: string | null;
  institution_name?: string | null;
  type: string;
  subtype?: string | null;
  currency: string;
  status?: string | null;
  closed_on?: string | null;
}
export interface LunchMoneyCategory {
  id: number;
  name: string;
  is_income?: boolean;
  exclude_from_budget?: boolean;
  exclude_from_totals?: boolean;
  is_group?: boolean;
  group_id?: number | null;
  archived?: boolean;
  order?: number | null;
}
export interface LunchMoneyTag {
  id: number;
  name: string;
  background_color?: string | null;
  archived_at?: string | null;
  archived?: boolean;
}
export interface LunchMoneyTransaction {
  id: number;
  date: string;
  amount: string;
  currency: string;
  to_base?: string | null;
  payee?: string | null;
  category_id?: number | null;
  manual_account_id?: number | null;
  plaid_account_id?: number | null;
  tag_ids?: number[];
  notes?: string | null;
  status?: string | null;
  is_pending?: boolean;
  recurring_id?: number | null;
  external_id?: string | null;
  is_split_parent?: boolean;
  split_parent_id?: number | null;
  is_group_parent?: boolean;
  group_parent_id?: number | null;
  children?: number[];
}
export interface LunchMoneyRecurring {
  id: number;
  description?: string | null;
  status?: string | null;
  transaction_criteria?: {
    granularity?: string | null;
    quantity?: number | null;
    anchor_date?: string | null;
    payee?: string | null;
    amount?: string | null;
    manual_account_id?: number | null;
    plaid_account_id?: number | null;
  } | null;
  overrides?: {
    payee?: string | null;
    category_id?: number | null;
  } | null;
  matches?: { expected_occurrence_dates?: string[] } | null;
}
export interface LunchMoneyBalance {
  type?: string;
  id: number;
  currency?: string;
  history?: { date: string; balance: string; currency?: string }[];
}
export interface LunchMoneyBudget {
  category_id: number;
  months?: { month: string; budgeted: string; actual: string }[];
}
export interface LunchMoneySnapshot {
  me?: { primary_currency?: string | null } | null;
  manual_accounts?: LunchMoneyAccount[];
  plaid_accounts?: LunchMoneyAccount[];
  categories?: LunchMoneyCategory[];
  tags?: LunchMoneyTag[];
  transactions?: LunchMoneyTransaction[];
  recurring_items?: LunchMoneyRecurring[];
  balance_history?: LunchMoneyBalance[];
  budgets?: LunchMoneyBudget[];
}
export interface ImportIssue {
  tipo: string;
  id: string;
  motivo: string;
}
export interface ImportReport {
  contas: number;
  instituicoes: number;
  grupos: number;
  categorias: number;
  tags: number;
  lancamentos: number;
  transferencias: number;
  pagamentos_de_fatura: number;
  divisoes: number;
  recorrentes: number;
  recorrentes_ignorados: number;
  historicos_de_saldo: number;
  meses_de_orcamento: number;
  ignoradas: number;
  pendentes: number;
  nao_mapeados: ImportIssue[];
}

export function lunchMoneyCents(value: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error('Valor inválido.');
  const negative = value.startsWith('-');
  const [whole, frac = ''] = (negative ? value.slice(1) : value).split('.');
  const centsPart = (frac + '00').slice(0, 2);
  const rest = frac.slice(2);
  let cents = BigInt(whole) * 100n + BigInt(centsPart);
  if (rest) {
    const scale = 10n ** BigInt(rest.length);
    if (BigInt(rest) * 2n >= scale) cents += 1n;
  }
  const signed = negative ? -cents : cents;
  if (
    signed > BigInt(Number.MAX_SAFE_INTEGER) ||
    signed < -BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw new Error('Valor fora do limite.');
  return Number(signed);
}

function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
function sql(value: string | number | null): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Número inválido.');
    return String(value);
  }
  return sqlText(value);
}
function flag(value: boolean | undefined): number {
  return value ? 1 : 0;
}
function slug(name: string): string {
  const plain = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return plain || 'sem-nome';
}
function accountKind(type: string, subtype: string | null | undefined) {
  const kind = type.toLowerCase();
  const detail = (subtype ?? '').toLowerCase();
  if (kind === 'credit') return 'credit_card';
  if (kind === 'investment' || kind === 'cryptocurrency') return 'investment';
  if (kind === 'loan' || kind === 'other liability') return 'loan';
  if (kind === 'real estate' || kind === 'vehicle') return 'property';
  if (kind === 'cash' || kind === 'other asset')
    return detail.includes('cash') || detail === 'wallet' ? 'cash' : 'checking';
  return null;
}
function rate(amount: number, brl: number): string {
  if (amount === 0 || brl === 0) return '1';
  const ratio = Math.abs(brl) / Math.abs(amount);
  if (!Number.isFinite(ratio) || ratio <= 0) return '1';
  return String(Number(ratio.toFixed(8)));
}
function link(entity: string, remote: string, local: string): string {
  return `INSERT OR IGNORE INTO import_links(source,entity,remote_id,local_id) VALUES(${sql(SOURCE)},${sql(entity)},${sql(remote)},${sql(local)})`;
}

export function buildImport(snapshot: LunchMoneySnapshot): {
  statements: string[];
  report: ImportReport;
} {
  const report: ImportReport = {
    contas: 0,
    instituicoes: 0,
    grupos: 0,
    categorias: 0,
    tags: 0,
    lancamentos: 0,
    transferencias: 0,
    pagamentos_de_fatura: 0,
    divisoes: 0,
    recorrentes: 0,
    recorrentes_ignorados: 0,
    historicos_de_saldo: 0,
    meses_de_orcamento: 0,
    ignoradas: 0,
    pendentes: 0,
    nao_mapeados: [],
  };
  const statements: string[] = ['PRAGMA defer_foreign_keys = ON'];
  const accounts = new Map<string, { id: string; currency: string }>();
  const categories = new Set<string>();
  const groups = new Set<string>();
  const tags = new Map<
    number,
    { id: string; name: string; payment: boolean }
  >();
  const currencies = new Set<string>(['BRL']);
  const issue = (tipo: string, id: string, motivo: string) =>
    report.nao_mapeados.push({ tipo, id, motivo });

  statements.push(
    `INSERT OR IGNORE INTO allocation_groups(id,name,target_percent,sort) VALUES('lm:allocation','Importado',0,90)`,
  );

  const institutions = new Map<string, string>();
  for (const account of [
    ...(snapshot.manual_accounts ?? []),
    ...(snapshot.plaid_accounts ?? []),
  ]) {
    const remote = String(account.id);
    const kind = accountKind(account.type, account.subtype);
    const currency = (account.currency ?? '').toUpperCase();
    if (!kind || !/^[A-Z]{3}$/.test(currency)) {
      issue('conta', remote, 'Tipo ou moeda sem correspondência.');
      continue;
    }
    const institution = account.institution_name?.trim();
    let institutionId: string | null = null;
    if (institution) {
      institutionId =
        institutions.get(institution) ?? `lm:institution:${slug(institution)}`;
      if (!institutions.has(institution)) {
        institutions.set(institution, institutionId);
        statements.push(
          `INSERT OR IGNORE INTO institutions(id,name,sort) VALUES(${sql(institutionId)},${sql(institution)},${institutions.size})`,
        );
        statements.push(link('institution', institution, institutionId));
        report.instituicoes += 1;
      }
    }
    const id = `lm:account:${remote}`;
    const closed =
      account.status === 'closed' ||
      account.status === 'revoked' ||
      account.status === 'deactivated' ||
      account.closed_on
        ? (account.closed_on ?? null)
        : null;
    statements.push(
      `INSERT OR IGNORE INTO accounts(id,name,kind,currency,institution_id,closed_at,cutoff_date,opening_balance_cents) VALUES(${sql(id)},${sql(account.display_name?.trim() || account.name)},${sql(kind)},${sql(currency)},${sql(institutionId)},${sql(closed)},NULL,0)`,
    );
    statements.push(link('account', remote, id));
    accounts.set(remote, { id, currency });
    currencies.add(currency);
    report.contas += 1;
  }

  for (const category of snapshot.categories ?? []) {
    if (!category.is_group) continue;
    const id = `lm:group:${category.id}`;
    statements.push(
      `INSERT OR IGNORE INTO category_groups(id,name,allocation_group_id,sort,is_income,exclude_budget,exclude_totals) VALUES(${sql(id)},${sql(category.name)},'lm:allocation',${category.order ?? 0},${flag(category.is_income)},${flag(category.exclude_from_budget)},${flag(category.exclude_from_totals)})`,
    );
    statements.push(link('category_group', String(category.id), id));
    groups.add(String(category.id));
    report.grupos += 1;
  }
  for (const category of snapshot.categories ?? []) {
    if (category.is_group) continue;
    const remote = String(category.id);
    const group =
      category.group_id == null ? null : `lm:group:${category.group_id}`;
    if (group && !groups.has(String(category.group_id))) {
      issue('categoria', remote, 'Grupo inexistente.');
      continue;
    }
    const id = `lm:category:${remote}`;
    statements.push(
      `INSERT OR IGNORE INTO categories(id,name,category_group_id,is_income,sort,exclude_budget,exclude_totals,archived) VALUES(${sql(id)},${sql(category.name)},${sql(group)},${flag(category.is_income)},${category.order ?? 0},${flag(category.exclude_from_budget)},${flag(category.exclude_from_totals)},${flag(category.archived)})`,
    );
    statements.push(link('category', remote, id));
    categories.add(remote);
    report.categorias += 1;
  }

  for (const tag of snapshot.tags ?? []) {
    const payment = tag.name.trim().toLowerCase() === PAYMENT_TAG;
    const id = `lm:tag:${tag.id}`;
    tags.set(tag.id, { id, name: tag.name, payment });
    if (payment) continue;
    const color = tag.background_color || '#888888';
    statements.push(
      `INSERT OR IGNORE INTO tags(id,name,color,archived) VALUES(${sql(id)},${sql(tag.name)},${sql(color)},${flag(Boolean(tag.archived_at) || Boolean(tag.archived))})`,
    );
    statements.push(link('tag', String(tag.id), id));
    report.tags += 1;
  }

  const transactions = snapshot.transactions ?? [];
  const byId = new Map(transactions.map((item) => [item.id, item]));
  const used = new Set<number>();
  const inserted = new Set<number>();
  const accountOf = (item: LunchMoneyTransaction) => {
    const remote = item.manual_account_id ?? item.plaid_account_id;
    if (remote == null) return null;
    return accounts.get(String(remote)) ?? null;
  };
  const categoryOf = (remote: number | null | undefined) =>
    remote == null
      ? null
      : categories.has(String(remote))
        ? `lm:category:${remote}`
        : null;
  const noteOf = (item: LunchMoneyTransaction, extra?: string) => {
    const parts = [item.notes?.trim(), extra].filter(Boolean);
    if (item.is_pending) {
      report.pendentes += 1;
      parts.push('pendente no Lunch Money');
    }
    return parts.join('\n');
  };
  const tagIds = (item: LunchMoneyTransaction) =>
    (item.tag_ids ?? []).filter((id) => tags.get(id) && !tags.get(id)?.payment);
  const payment = (items: LunchMoneyTransaction[]) =>
    items.some((item) =>
      (item.tag_ids ?? []).some((id) => tags.get(id)?.payment),
    );

  const insertTransaction = (
    item: LunchMoneyTransaction,
    fields: {
      id: string;
      account: string;
      amount: number;
      brl: number;
      currency: string;
      kind: string;
      pair: string | null;
      category: string | null;
      note: string;
      external: string;
    },
  ) => {
    const payee = item.payee?.trim() || 'Sem beneficiário';
    const payeeId = `lm:payee:${item.id}`;
    statements.push(
      `INSERT OR IGNORE INTO payees(id,name) VALUES(${sql(payeeId)},${sql(payee)})`,
    );
    statements.push(
      `INSERT OR IGNORE INTO transactions(id,account_id,date,amount_cents,payee,category_id,note,origin,kind,transfer_pair_id,external_id,currency,fx_rate,amount_brl_cents,fx_source,payee_id) VALUES(${sql(fields.id)},${sql(fields.account)},${sql(item.date)},${fields.amount},${sql(payee)},${sql(fields.category)},${sql(fields.note)},'imported',${sql(fields.kind)},${sql(fields.pair)},${sql(fields.external)},${sql(fields.currency)},${rate(fields.amount, fields.brl)},${fields.brl},'manual',(SELECT id FROM payees WHERE name=${sql(payee)} COLLATE NOCASE))`,
    );
    statements.push(link('transaction', String(item.id), fields.id));
    inserted.add(item.id);
    for (const tagId of tagIds(item)) {
      const tag = tags.get(tagId);
      if (!tag) continue;
      statements.push(
        `INSERT OR IGNORE INTO transaction_tags(transaction_id,tag_id) SELECT ${sql(fields.id)},id FROM tags WHERE name=${sql(tag.name)} COLLATE NOCASE`,
      );
    }
  };

  for (const parent of transactions) {
    if (!parent.is_split_parent) continue;
    const children = transactions.filter(
      (item) => item.split_parent_id === parent.id,
    );
    const parentCents = lunchMoneyCents(parent.amount);
    const childCents = children.map((item) => lunchMoneyCents(item.amount));
    const account = accountOf(parent);
    if (
      !account ||
      children.length < 2 ||
      childCents.reduce((sum, value) => sum + value, 0) !== parentCents
    ) {
      issue('divisao', String(parent.id), 'Partes não fecham com o total.');
      used.add(parent.id);
      for (const child of children) used.add(child.id);
      continue;
    }
    const brl = lunchMoneyCents(parent.to_base ?? parent.amount);
    const id = `lm:tx:${parent.id}`;
    insertTransaction(parent, {
      id,
      account: account.id,
      amount: parentCents,
      brl,
      currency: account.currency,
      kind: 'regular',
      pair: null,
      category: categoryOf(parent.category_id),
      note: noteOf(parent),
      external: parent.external_id?.trim() || id,
    });
    children.forEach((child, index) => {
      const childBrl = lunchMoneyCents(child.to_base ?? child.amount);
      const splitId = `lm:split:${child.id}`;
      statements.push(
        `INSERT OR IGNORE INTO transaction_splits(id,transaction_id,position,amount_cents,amount_brl_cents,category_id,note) VALUES(${sql(splitId)},${sql(id)},${index + 1},${childCents[index]},${childBrl},${sql(categoryOf(child.category_id))},${sql(child.notes?.trim() || '')})`,
      );
      statements.push(link('split', String(child.id), splitId));
      for (const tagId of tagIds(child)) {
        const tag = tags.get(tagId);
        if (!tag) continue;
        statements.push(
          `INSERT OR IGNORE INTO split_tags(split_id,tag_id) SELECT ${sql(splitId)},id FROM tags WHERE name=${sql(tag.name)} COLLATE NOCASE`,
        );
      }
      used.add(child.id);
    });
    used.add(parent.id);
    report.divisoes += 1;
    report.lancamentos += 1;
  }

  for (const parent of transactions) {
    if (!parent.is_group_parent || used.has(parent.id)) continue;
    const children = transactions.filter(
      (item) =>
        item.group_parent_id === parent.id ||
        parent.children?.includes(item.id),
    );
    used.add(parent.id);
    const amounts = children.map((item) => lunchMoneyCents(item.amount));
    const zero =
      children.length === 2 &&
      amounts[0] + amounts[1] === 0 &&
      amounts[0] !== 0 &&
      accountOf(children[0]) &&
      accountOf(children[1]) &&
      accountOf(children[0])!.id !== accountOf(children[1])!.id;
    if (!zero) {
      for (const child of children) {
        if (child.status === 'delete_pending') {
          report.ignoradas += 1;
          used.add(child.id);
          continue;
        }
        const account = accountOf(child);
        if (!account) {
          issue('lancamento', String(child.id), 'Conta sem correspondência.');
          used.add(child.id);
          continue;
        }
        const amount = lunchMoneyCents(child.amount);
        const id = `lm:tx:${child.id}`;
        insertTransaction(child, {
          id,
          account: account.id,
          amount,
          brl: lunchMoneyCents(child.to_base ?? child.amount),
          currency: account.currency,
          kind: 'regular',
          pair: null,
          category: categoryOf(child.category_id),
          note: noteOf(
            child,
            `Grupo do Lunch Money: ${parent.payee?.trim() || parent.id}`,
          ),
          external: child.external_id?.trim() || id,
        });
        used.add(child.id);
        report.lancamentos += 1;
      }
      continue;
    }
    const source = amounts[0] > 0 ? children[0] : children[1];
    const destination = source === children[0] ? children[1] : children[0];
    const sourceAccount = accountOf(source)!;
    const destinationAccount = accountOf(destination)!;
    const sourceId = `lm:tx:${source.id}`;
    const destinationId = `lm:tx:${destination.id}`;
    const isPayment = payment([parent, ...children]);
    const category = categoryOf(source.category_id) ?? 'transfer';
    const note = parent.notes?.trim() || source.notes?.trim() || '';
    insertTransaction(source, {
      id: sourceId,
      account: sourceAccount.id,
      amount: Math.abs(lunchMoneyCents(source.amount)),
      brl: Math.abs(lunchMoneyCents(source.to_base ?? source.amount)),
      currency: sourceAccount.currency,
      kind: 'transfer',
      pair: destinationId,
      category,
      note,
      external: source.external_id?.trim() || sourceId,
    });
    insertTransaction(destination, {
      id: destinationId,
      account: destinationAccount.id,
      amount: -Math.abs(lunchMoneyCents(destination.amount)),
      brl: -Math.abs(
        lunchMoneyCents(destination.to_base ?? destination.amount),
      ),
      currency: destinationAccount.currency,
      kind: 'transfer',
      pair: sourceId,
      category,
      note,
      external: destination.external_id?.trim() || destinationId,
    });
    for (const child of children) used.add(child.id);
    if (isPayment) report.pagamentos_de_fatura += 1;
    else report.transferencias += 1;
  }

  for (const item of transactions) {
    if (used.has(item.id)) continue;
    if (item.status === 'delete_pending') {
      report.ignoradas += 1;
      continue;
    }
    if (item.is_group_parent || item.group_parent_id || item.split_parent_id)
      continue;
    const account = accountOf(item);
    if (!account) {
      issue('lancamento', String(item.id), 'Conta sem correspondência.');
      continue;
    }
    const id = `lm:tx:${item.id}`;
    insertTransaction(item, {
      id,
      account: account.id,
      amount: lunchMoneyCents(item.amount),
      brl: lunchMoneyCents(item.to_base ?? item.amount),
      currency: account.currency,
      kind: 'regular',
      pair: null,
      category: categoryOf(item.category_id),
      note: noteOf(item),
      external: item.external_id?.trim() || id,
    });
    report.lancamentos += 1;
  }

  const importedRecurring = new Set<number>();
  for (const item of snapshot.recurring_items ?? []) {
    if (item.status !== 'reviewed') {
      report.recorrentes_ignorados += 1;
      continue;
    }
    const criteria = item.transaction_criteria ?? {};
    const remoteAccount =
      criteria.manual_account_id ?? criteria.plaid_account_id;
    const account =
      remoteAccount == null ? null : accounts.get(String(remoteAccount));
    const next =
      item.matches?.expected_occurrence_dates?.find(Boolean) ||
      criteria.anchor_date;
    const payee = item.overrides?.payee?.trim() || criteria.payee?.trim();
    if (!account || !next || !payee || !criteria.amount) {
      issue('recorrente', String(item.id), 'Cadastro incompleto.');
      continue;
    }
    const cadence =
      criteria.granularity === 'month' && (criteria.quantity ?? 1) === 1
        ? 'monthly'
        : criteria.granularity === 'year' && (criteria.quantity ?? 1) === 1
          ? 'yearly'
          : criteria.granularity === 'week' && (criteria.quantity ?? 1) === 1
            ? 'weekly'
            : 'custom';
    const id = `lm:recurring:${item.id}`;
    statements.push(
      `INSERT OR IGNORE INTO recurring(id,account_id,payee,amount_cents,category_id,cadence,next_date,description,is_subscription,active) VALUES(${sql(id)},${sql(account.id)},${sql(payee)},${lunchMoneyCents(criteria.amount)},${sql(categoryOf(item.overrides?.category_id))},${sql(cadence)},${sql(next)},${sql(item.description?.trim() || '')},0,1)`,
    );
    statements.push(link('recurring', String(item.id), id));
    importedRecurring.add(item.id);
    report.recorrentes += 1;
  }
  for (const item of transactions) {
    if (!item.recurring_id || !importedRecurring.has(item.recurring_id))
      continue;
    if (!inserted.has(item.id)) continue;
    statements.push(
      `INSERT OR IGNORE INTO recurring_sources(recurring_id,transaction_id) VALUES(${sql(`lm:recurring:${item.recurring_id}`)},${sql(`lm:tx:${item.id}`)})`,
    );
  }

  for (const history of snapshot.balance_history ?? []) {
    const account = accounts.get(String(history.id));
    if (!account) {
      issue('saldo', String(history.id), 'Conta sem correspondência.');
      continue;
    }
    for (const point of history.history ?? []) {
      const id = `lm:balance:${history.id}:${point.date}`;
      const currency = (
        point.currency ||
        history.currency ||
        account.currency
      ).toUpperCase();
      statements.push(
        `INSERT OR IGNORE INTO imported_balances(id,account_id,date,balance_cents,currency) VALUES(${sql(id)},${sql(account.id)},${sql(point.date)},${lunchMoneyCents(point.balance)},${sql(currency)})`,
      );
      statements.push(link('balance', id, id));
      report.historicos_de_saldo += 1;
    }
  }
  for (const budget of snapshot.budgets ?? []) {
    if (!categories.has(String(budget.category_id))) {
      issue(
        'orcamento',
        String(budget.category_id),
        'Categoria sem correspondência.',
      );
      continue;
    }
    for (const month of budget.months ?? []) {
      const id = `lm:budget:${budget.category_id}:${month.month}`;
      statements.push(
        `INSERT OR IGNORE INTO imported_budgets(id,category_id,month,budgeted_cents,actual_cents) VALUES(${sql(id)},${sql(`lm:category:${budget.category_id}`)},${sql(month.month)},${lunchMoneyCents(month.budgeted)},${lunchMoneyCents(month.actual)})`,
      );
      statements.push(link('budget', id, id));
      report.meses_de_orcamento += 1;
    }
  }

  const primary = (snapshot.me?.primary_currency ?? '').toUpperCase();
  if (/^[A-Z]{3}$/.test(primary)) {
    currencies.add(primary);
    statements.push(
      `UPDATE preferences SET primary_currency=${sql(primary)} WHERE id=1 AND NOT EXISTS (SELECT 1 FROM import_links WHERE source=${sql(SOURCE)} AND entity='settings' AND remote_id='primary')`,
    );
    statements.push(link('settings', 'primary', '1'));
  } else issue('moeda', 'principal', 'Moeda principal ausente.');
  const codes = [...currencies].map((code) => `SELECT ${sql(code)} AS code`);
  statements.push(
    `UPDATE preferences SET currencies_in_use=(SELECT json_group_array(code) FROM (SELECT value AS code FROM json_each((SELECT currencies_in_use FROM preferences WHERE id=1)) UNION ${codes.join(' UNION ')})) WHERE id=1`,
  );
  return { statements, report };
}

export function wipeImportSql(): string[] {
  return [
    'PRAGMA defer_foreign_keys = ON',
    `DELETE FROM transactions WHERE id IN (SELECT local_id FROM import_links WHERE source='lunchmoney' AND entity='transaction')`,
    `DELETE FROM recurring WHERE id IN (SELECT local_id FROM import_links WHERE source='lunchmoney' AND entity='recurring')`,
    `DELETE FROM imported_balances WHERE id IN (SELECT local_id FROM import_links WHERE source='lunchmoney' AND entity='balance')`,
    `DELETE FROM imported_budgets WHERE id IN (SELECT local_id FROM import_links WHERE source='lunchmoney' AND entity='budget')`,
    `DELETE FROM tags WHERE id IN (SELECT local_id FROM import_links WHERE source='lunchmoney' AND entity='tag') AND NOT EXISTS (SELECT 1 FROM transaction_tags WHERE tag_id=tags.id) AND NOT EXISTS (SELECT 1 FROM split_tags WHERE tag_id=tags.id)`,
    `DELETE FROM categories WHERE id IN (SELECT local_id FROM import_links WHERE source='lunchmoney' AND entity='category') AND NOT EXISTS (SELECT 1 FROM transactions WHERE category_id=categories.id) AND NOT EXISTS (SELECT 1 FROM transaction_splits WHERE category_id=categories.id) AND NOT EXISTS (SELECT 1 FROM recurring WHERE category_id=categories.id) AND NOT EXISTS (SELECT 1 FROM installment_plans WHERE category_id=categories.id)`,
    `DELETE FROM category_groups WHERE id IN (SELECT local_id FROM import_links WHERE source='lunchmoney' AND entity='category_group') AND NOT EXISTS (SELECT 1 FROM categories WHERE category_group_id=category_groups.id)`,
    `DELETE FROM accounts WHERE id IN (SELECT local_id FROM import_links WHERE source='lunchmoney' AND entity='account') AND NOT EXISTS (SELECT 1 FROM transactions WHERE account_id=accounts.id) AND NOT EXISTS (SELECT 1 FROM recurring WHERE account_id=accounts.id)`,
    `DELETE FROM institutions WHERE id IN (SELECT local_id FROM import_links WHERE source='lunchmoney' AND entity='institution') AND NOT EXISTS (SELECT 1 FROM accounts WHERE institution_id=institutions.id)`,
    `DELETE FROM payees WHERE id LIKE 'lm:payee:%' AND NOT EXISTS (SELECT 1 FROM transactions WHERE payee_id=payees.id) AND NOT EXISTS (SELECT 1 FROM payees other WHERE other.merged_into_id=payees.id)`,
    `DELETE FROM import_links WHERE source='lunchmoney'`,
  ];
}

export function normalizeFixtures(
  files: Record<string, unknown>,
): LunchMoneySnapshot {
  const read = <T>(name: string): T => files[name] as T;
  const pages = Object.keys(files)
    .filter((name) => /^transactions\.pagina-\d+\.json$/.test(name))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const transactions: LunchMoneyTransaction[] = [];
  const seen = new Set<number>();
  for (const name of pages) {
    const page = read<{
      transactions?: LunchMoneyTransaction[];
      has_more?: boolean;
    }>(name);
    for (const item of page.transactions ?? []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      transactions.push(item);
    }
    if (!page.has_more) break;
  }
  return {
    me: read('me.json'),
    manual_accounts: read<{ manual_accounts?: LunchMoneyAccount[] }>(
      'manual_accounts.json',
    ).manual_accounts,
    plaid_accounts:
      read<{ plaid_accounts?: LunchMoneyAccount[] } | undefined>(
        'plaid_accounts.json',
      )?.plaid_accounts ?? [],
    categories: read<{ categories?: LunchMoneyCategory[] }>('categories.json')
      .categories,
    tags: read<{ tags?: LunchMoneyTag[] }>('tags.json').tags,
    transactions,
    recurring_items: read<{ recurring_items?: LunchMoneyRecurring[] }>(
      'recurring_items.json',
    ).recurring_items,
    balance_history: read<{ balance_history?: LunchMoneyBalance[] }>(
      'balance_history.json',
    ).balance_history,
    budgets: read<{ budgets?: LunchMoneyBudget[] }>('budgets-summary.json')
      .budgets,
  };
}

export interface PageResult {
  transactions: LunchMoneyTransaction[];
  has_more: boolean;
}
export async function collectTransactionPages(
  fetchPage: (offset: number) => Promise<PageResult>,
): Promise<LunchMoneyTransaction[]> {
  const all: LunchMoneyTransaction[] = [];
  const seen = new Set<number>();
  let offset = 0;
  for (let guard = 0; guard < 10000; guard += 1) {
    const page = await fetchPage(offset);
    for (const item of page.transactions) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      all.push(item);
    }
    if (!page.has_more || page.transactions.length === 0) return all;
    offset += page.transactions.length;
  }
  throw new Error('Paginação passou do limite de segurança.');
}

export async function collectFromApi(options: {
  token: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<LunchMoneySnapshot> {
  const token = options.token.trim();
  if (!token || token.includes('\n')) throw new Error('Token vazio.');
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep =
    options.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const stamps: number[] = [];
  const request = async (path: string) => {
    const current = now();
    while (stamps.length && current - stamps[0] >= 60_000) stamps.shift();
    if (stamps.length >= 90) await sleep(60_000 - (current - stamps[0]));
    stamps.push(now());
    let response: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetchImpl(`https://api.lunchmoney.dev/v2${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (response.status !== 429) break;
      const retry = Number(response.headers.get('retry-after'));
      await sleep(Number.isFinite(retry) && retry > 0 ? retry * 1000 : 1000);
    }
    if (!response?.ok) throw new Error('Falha na coleta.');
    return response.json() as Promise<Record<string, unknown>>;
  };
  try {
    const me = (await request('/me')) as LunchMoneySnapshot['me'];
    const manual = (await request('/manual_accounts')) as {
      manual_accounts?: LunchMoneyAccount[];
    };
    const plaid = (await request('/plaid_accounts')) as {
      plaid_accounts?: LunchMoneyAccount[];
    };
    const categories = (await request('/categories?format=flattened')) as {
      categories?: LunchMoneyCategory[];
    };
    const tags = (await request('/tags')) as { tags?: LunchMoneyTag[] };
    const recurring = (await request('/recurring_items')) as {
      recurring_items?: LunchMoneyRecurring[];
    };
    const balances = (await request('/balance_history')) as {
      balance_history?: LunchMoneyBalance[];
    };
    const budgets = (await request('/budgets/summary')) as {
      budgets?: LunchMoneyBudget[];
    };
    const transactions = await collectTransactionPages(async (offset) => {
      const page = (await request(
        `/transactions?start_date=1990-01-01&end_date=2100-12-31&limit=1000&offset=${offset}&include_split_parents=true&include_group_children=true&include_children=true`,
      )) as unknown as PageResult;
      return {
        transactions: page.transactions ?? [],
        has_more: Boolean(page.has_more),
      };
    });
    return {
      me,
      manual_accounts: manual.manual_accounts ?? [],
      plaid_accounts: plaid.plaid_accounts ?? [],
      categories: categories.categories ?? [],
      tags: tags.tags ?? [],
      recurring_items: recurring.recurring_items ?? [],
      balance_history: balances.balance_history ?? [],
      budgets: budgets.budgets ?? [],
      transactions,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message || message.includes(token)) throw new Error('Falha na coleta.');
    throw error;
  }
}

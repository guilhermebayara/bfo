// Apenas dados fictícios. IDs estáveis tornam o seed repetível sem apagar edições.
export function seedSql() {
  const sql = [];
  const literal = (v) =>
    v === null
      ? 'NULL'
      : typeof v === 'number'
        ? String(v)
        : `'${v.replaceAll("'", "''")}'`;
  const insert = (table, row) =>
    sql.push(
      `INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(literal).join(',')}) ON CONFLICT(id) DO NOTHING;`,
    );
  insert('allocation_groups', {
    id: 'essential',
    name: 'Essencial',
    target_percent: 60,
    sort: 1,
  });
  insert('allocation_groups', {
    id: 'lifestyle',
    name: 'Estilo de vida',
    target_percent: 25,
    sort: 2,
  });
  insert('allocation_groups', {
    id: 'investment',
    name: 'Investimento',
    target_percent: 15,
    sort: 3,
  });
  for (const [id, name, allocation_group_id] of [
    ['home', 'Moradia', 'essential'],
    ['food', 'Alimentação', 'essential'],
    ['leisure', 'Lazer', 'lifestyle'],
    ['income', 'Renda', 'essential'],
    ['system', 'Ajustes', 'essential'],
  ])
    insert('category_groups', { id, name, allocation_group_id, sort: 0 });
  for (const [id, name, category_group_id, is_income] of [
    ['rent', 'Aluguel', 'home', 0],
    ['groceries', 'Mercado', 'food', 0],
    ['restaurant', 'Restaurantes', 'food', 0],
    ['entertainment', 'Entretenimento', 'leisure', 0],
    ['salary', 'Salário', 'income', 1],
    ['statement-difference', 'Diferença de fatura', 'system', 0],
  ])
    insert('categories', { id, name, category_group_id, is_income, sort: 0 });
  for (const [id, name, kind] of [
    ['checking', 'Conta Horizonte', 'checking'],
    ['card-a', 'Cartão Aurora', 'credit_card'],
    ['card-b', 'Cartão Brisa', 'credit_card'],
    ['cash', 'Carteira', 'cash'],
  ])
    insert('accounts', {
      id,
      name,
      kind,
      currency: 'BRL',
      cutoff_date: null,
      opening_balance_cents: 0,
      ...(kind === 'credit_card' ? { closing_day: 20, due_day: 27 } : {}),
    });
  insert('subscription_types', { id: 'daily', name: 'Uso frequente', sort: 1 });
  insert('subscription_types', {
    id: 'occasional',
    name: 'Uso eventual',
    sort: 2,
  });
  insert('installment_plans', {
    id: 'desk',
    account_id: 'card-a',
    description: 'Mesa de trabalho',
    total_cents: 120000,
    count: 12,
    first_date: '2026-06-12',
    category_id: 'entertainment',
  });
  // 14 meses: setembro/2025 a outubro/2026. Os primeiros sete são importados.
  for (let month = 0; month < 14; month++) {
    const d = new Date(Date.UTC(2025, 8 + month, 1));
    const ym = d.toISOString().slice(0, 7);
    const origin = month < 7 ? 'imported' : 'manual';
    for (const [suffix, account_id, day, amount_cents, payee, category_id] of [
      ['salary', 'checking', '05', -650000, 'Renda fictícia', 'salary'],
      ['rent', 'checking', '10', 180000, 'Aluguel fictício', 'rent'],
      ['market', 'card-a', '12', 38590, 'Mercado do Bairro', 'groceries'],
      ['meal', 'card-b', '15', 9800, 'Cozinha da Praça', 'restaurant'],
      ['cash', 'cash', '18', 2500, 'Feira da Vila', 'groceries'],
      ['stream', 'card-a', '08', 2990, 'Vídeo de Teste', 'entertainment'],
    ])
      insert('transactions', {
        id: `seed-${ym}-${suffix}`,
        account_id,
        date: `${ym}-${day}`,
        amount_cents,
        payee,
        category_id,
        note: 'Dado fictício para desenvolvimento.',
        origin,
        kind: 'regular',
        external_id: origin === 'imported' ? `fake-${ym}-${suffix}` : null,
      });
  }
  for (let month = 0; month < 12; month++) {
    const ym = new Date(Date.UTC(2026, 5 + month, 1)).toISOString().slice(0, 7);
    insert('statements', {
      id: `statement-${ym}`,
      account_id: 'card-a',
      period_start: `${ym}-01`,
      closing_date: `${ym}-20`,
      due_date: `${ym}-27`,
      status: month < 4 ? 'paid' : month === 4 ? 'closed' : 'open',
      bank_amount_cents: month === 4 ? 53000 : null,
      closed_at: month <= 4 ? `${ym}-20T12:00:00Z` : null,
    });
    insert('transactions', {
      id: `seed-installment-${month}`,
      account_id: 'card-a',
      date: `${ym}-12`,
      amount_cents: 10000,
      payee: `Mesa de trabalho (${month + 1}/12)`,
      category_id: 'entertainment',
      note: 'Compra parcelada fictícia.',
      origin: 'manual',
      kind: 'installment',
      statement_id: `statement-${ym}`,
      installment_plan_id: 'desk',
    });
  }
  // Compras comuns ligadas às faturas correspondentes. Outubro tem divergência de 1.420 centavos.
  sql.push(
    "UPDATE transactions SET statement_id='statement-'||substr(date,1,7) WHERE id LIKE 'seed-2026-%' AND account_id='card-a' AND origin='manual' AND kind='regular' AND date>='2026-06-01' AND statement_id IS NULL;",
  );
  for (const [
    id,
    account_id,
    payee,
    amount_cents,
    category_id,
    cadence,
    next_date,
    is_subscription,
    subscription_type_id,
    renewal_date,
  ] of [
    [
      'rent',
      'checking',
      'Aluguel fictício',
      180000,
      'rent',
      'monthly',
      '2026-11-10',
      0,
      null,
      null,
    ],
    [
      'video',
      'card-a',
      'Vídeo de Teste',
      2990,
      'entertainment',
      'monthly',
      '2026-11-08',
      1,
      'daily',
      '2026-12-08',
    ],
    [
      'music',
      'card-b',
      'Música de Teste',
      2190,
      'entertainment',
      'monthly',
      '2026-11-15',
      1,
      'daily',
      '2026-12-15',
    ],
    [
      'annual',
      'card-b',
      'Clube de Leitura',
      24000,
      'entertainment',
      'yearly',
      '2026-12-02',
      1,
      'occasional',
      '2026-12-02',
    ],
  ])
    insert('recurring', {
      id,
      account_id,
      payee,
      amount_cents,
      category_id,
      cadence,
      next_date,
      is_subscription,
      subscription_type_id,
      renewal_date,
      active: 1,
    });
  return sql.join('\n');
}

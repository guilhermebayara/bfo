// Apenas dados fictícios. IDs estáveis tornam o seed repetível sem apagar edições.
export function seedSql() {
  const sql = [
    'CREATE TABLE IF NOT EXISTS seed_fixtures(id TEXT PRIMARY KEY);',
  ];
  let sessionF = false;
  const fixtureGuard = () =>
    sessionF
      ? " WHERE NOT EXISTS(SELECT 1 FROM seed_fixtures WHERE id='session-f')"
      : '';
  const literal = (v) =>
    v === null
      ? 'NULL'
      : typeof v === 'number'
        ? String(v)
        : `'${v.replaceAll("'", "''")}'`;
  const statementId = (id) => {
    const card = id.startsWith('statement-f-')
      ? 'seed-f-card'
      : id.startsWith('statement-brisa-')
        ? 'card-b'
        : 'card-a';
    return `(SELECT id FROM statements WHERE account_id='${card}' AND closing_date='${id.slice(-7)}-20')`;
  };
  const insert = (table, row) => {
    if (table === 'transactions') {
      const payee_id =
        'seed-payee-' +
        row.payee
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]/g, '-');
      sql.push(
        `INSERT INTO payees(id,name) VALUES (${literal(payee_id)},${literal(row.payee)}) ON CONFLICT DO NOTHING;`,
      );
      row = {
        currency: 'BRL',
        fx_rate: 1,
        amount_brl_cents: row.amount_cents,
        fx_source: 'manual',
        ...row,
        payee_id,
      };
      // Resolve também beneficiários migrados da sessão A, sem duplicar nomes.
      row.payee_id = null;
      const values = Object.entries(row).map(([k, v]) =>
        k === 'statement_id'
          ? statementId(v)
          : k === 'payee_id'
            ? `(SELECT id FROM payees WHERE name=${literal(row.payee)} COLLATE NOCASE)`
            : literal(v),
      );
      const input =
        row.kind === 'card_payment'
          ? `SELECT ${values.join(',')} WHERE EXISTS (
            SELECT 1 FROM statements WHERE id=${statementId(row.statement_id)}
              AND status='paid' AND bank_amount_cents=${literal(row.amount_cents)}) ON CONFLICT DO NOTHING`
          : `SELECT ${values.join(',')}${fixtureGuard() || ' WHERE true'} ON CONFLICT(id) DO NOTHING`;
      sql.push(
        `INSERT INTO ${table} (${Object.keys(row).join(',')}) ${input};`,
      );
      return;
    }
    sql.push(
      `INSERT INTO ${table} (${Object.keys(row).join(',')}) SELECT ${Object.values(row).map(literal).join(',')}${fixtureGuard() || ' WHERE true'} ON CONFLICT DO NOTHING;`,
    );
  };
  for (const [id, name] of [
    ['horizonte', 'Instituição Horizonte'],
    ['brisa', 'Instituição Brisa'],
  ])
    insert('institutions', { id, name });
  insert('tags', { id: 'planned', name: 'Planejado', color: '#888888' });
  insert('tags', { id: 'travel', name: 'Viagem fictícia', color: '#a0a0a0' });
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
      institution_id: ['checking', 'card-a'].includes(id)
        ? 'horizonte'
        : 'brisa',
      cutoff_date: ['card-a', 'card-b'].includes(id) ? '2025-08-31' : null,
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
  insert('transactions', {
    id: 'seed-cash-opening',
    account_id: 'cash',
    date: '2025-09-01',
    amount_cents: -50000,
    payee: 'Saldo inicial da carteira',
    category_id: null,
    note: 'Saldo inicial fictício do arquivo.',
    origin: 'imported',
    kind: 'regular',
    external_id: 'fake-cash-opening',
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
    const prev = new Date(Date.UTC(2026, 4 + month, 1))
      .toISOString()
      .slice(0, 7);
    insert('statements', {
      id: `statement-${ym}`,
      account_id: 'card-a',
      period_start: `${prev}-21`,
      closing_date: `${ym}-20`,
      due_date: `${ym}-27`,
      status: 'open',
    });
    insert('transactions', {
      id: `seed-installment-${month}`,
      account_id: 'card-a',
      date: `${ym}-12`,
      amount_cents: 10000,
      payee: 'Mesa de trabalho',
      installment_number: month + 1,
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
    "UPDATE transactions SET statement_id=(SELECT id FROM statements WHERE account_id='card-a' AND closing_date=substr(transactions.date,1,7)||'-20') WHERE id LIKE 'seed-2026-%' AND account_id='card-a' AND origin='manual' AND kind='regular' AND date>='2026-06-01' AND statement_id IS NULL;",
  );
  insert('transactions', {
    id: 'seed-brisa-open',
    account_id: 'card-b',
    date: '2026-11-15',
    amount_cents: 2190,
    payee: 'Música de Teste',
    category_id: 'entertainment',
    origin: 'manual',
    kind: 'regular',
  });
  insert('statements', {
    id: 'statement-brisa-2026-11',
    account_id: 'card-b',
    period_start: '2026-10-21',
    closing_date: '2026-11-20',
    due_date: '2026-11-27',
    status: 'open',
  });
  for (const [card, ym, amount, paid] of [
    ...['06', '07', '08', '09'].map((month) => [
      'card-a',
      `2026-${month}`,
      51580,
      true,
    ]),
    ['card-a', '2026-10', 53000, false],
    ['card-b', '2026-09', 9800, true],
    ['card-b', '2026-10', 9800, false],
  ]) {
    const closing = `${ym}-20`;
    const id = card === 'card-a' ? `statement-${ym}` : `statement-brisa-${ym}`;
    const prev = new Date(`${ym}-01T00:00:00Z`);
    prev.setUTCMonth(prev.getUTCMonth() - 1);
    const start = `${prev.toISOString().slice(0, 7)}-21`;
    if (card === 'card-b')
      insert('statements', {
        id,
        account_id: card,
        period_start: start,
        closing_date: closing,
        due_date: `${ym}-27`,
        status: 'open',
      });
    const target = `(SELECT id FROM statements WHERE account_id=${literal(card)} AND closing_date=${literal(closing)})`;
    // A migração pode encontrar faturas fictícias das sessões anteriores já fechadas.
    sql.push(`UPDATE statements SET status=${literal(paid ? 'paid' : 'closed')},
      bank_amount_cents=${amount},closed_at=${literal(closing + 'T12:00:00Z')}
      WHERE id=${literal(id)} AND bank_amount_cents IS NULL AND NOT EXISTS(SELECT 1 FROM seed_fixtures WHERE id='session-f');`);
    if (paid)
      insert('transactions', {
        id: `seed-payment-${card}-${ym}`,
        account_id: 'checking',
        date: `${ym}-27`,
        amount_cents: amount,
        payee: `Fatura ${card === 'card-a' ? 'Cartão Aurora' : 'Cartão Brisa'} ${new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(closing))}`,
        origin: 'manual',
        kind: 'card_payment',
        statement_id: id,
      });
    if (card === 'card-a' && ym === '2026-10') {
      sql.push(`INSERT INTO statement_checks(id,statement_id,app_amount_cents,bank_amount_cents,action,created_at)
        VALUES('seed-statement-check',${target},51580,53000,'close','2026-10-20T12:00:00Z') ON CONFLICT(id) DO NOTHING;`);
      insert('transactions', {
        id: 'seed-statement-adjustment',
        account_id: 'card-a',
        date: closing,
        amount_cents: 1420,
        payee: 'Diferença de fatura',
        category_id: 'statement-difference',
        origin: 'adjustment',
        kind: 'regular',
        statement_id: id,
      });
      sql.push(
        "UPDATE statement_checks SET adjustment_transaction_id='seed-statement-adjustment' WHERE id='seed-statement-check' AND adjustment_transaction_id IS NULL;",
      );
    }
  }
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
  // Casos da Sessão E, isolados dos registros de conferência e das faturas.
  insert('accounts', {
    id: 'seed-recurring-account',
    name: 'Conta de recorrentes fictícia',
    kind: 'checking',
    currency: 'BRL',
    institution_id: 'horizonte',
    cutoff_date: '2026-10-31',
    opening_balance_cents: 0,
  });
  for (const row of [
    {
      id: 'seed-e-income',
      payee: 'Renda recorrente fictícia',
      amount_cents: -500000,
      category_id: 'salary',
      cadence: 'monthly',
      next_date: '2026-11-05',
      is_subscription: 0,
      subscription_type_id: null,
      renewal_date: null,
    },
    {
      id: 'seed-e-storage',
      payee: 'Nuvem fictícia',
      amount_cents: 1990,
      category_id: 'entertainment',
      cadence: 'monthly',
      next_date: '2026-11-12',
      is_subscription: 1,
      subscription_type_id: 'daily',
      renewal_date: '2026-11-28',
    },
    {
      id: 'seed-e-annual',
      payee: 'Ferramenta anual fictícia',
      amount_cents: 35990,
      category_id: 'entertainment',
      cadence: 'yearly',
      next_date: '2026-12-02',
      is_subscription: 1,
      subscription_type_id: 'occasional',
      renewal_date: '2026-12-02',
    },
  ])
    insert('recurring', {
      account_id: 'seed-recurring-account',
      active: 1,
      ...row,
    });
  for (const row of [
    {
      id: 'seed-e-income-arrived',
      date: '2026-11-05',
      amount_cents: -500000,
      payee: 'Renda recorrente fictícia',
      category_id: 'salary',
    },
    {
      id: 'seed-e-storage-arrived',
      date: '2026-11-12',
      amount_cents: 2190,
      payee: 'Nuvem fictícia',
      category_id: 'entertainment',
    },
  ])
    insert('transactions', {
      account_id: 'seed-recurring-account',
      origin: 'manual',
      kind: 'regular',
      ...row,
    });
  // Só complementa vínculos vazios dos IDs fictícios já instalados na sessão A.
  sql.push(
    "UPDATE accounts SET institution_id=CASE WHEN id IN ('checking','card-a') THEN 'horizonte' ELSE 'brisa' END WHERE id IN ('checking','card-a','card-b','cash') AND institution_id IS NULL;",
  );
  insert('accounts', {
    id: 'closed',
    name: 'Conta antiga fictícia',
    kind: 'checking',
    currency: 'BRL',
    institution_id: 'brisa',
    closed_at: '2026-09-30',
    cutoff_date: '2025-01-01',
    opening_balance_cents: 0,
  });
  insert('accounts', {
    id: 'usd',
    name: 'Conta exterior fictícia',
    kind: 'checking',
    currency: 'USD',
    institution_id: 'horizonte',
    cutoff_date: '2025-08-31',
    opening_balance_cents: 100000,
  });
  insert('transactions', {
    id: 'seed-usd',
    account_id: 'usd',
    date: '2026-10-14',
    amount_cents: 2500,
    currency: 'USD',
    fx_rate: 5,
    amount_brl_cents: 12500,
    fx_source: 'manual',
    payee: 'Loja exterior fictícia',
    category_id: 'entertainment',
    note: 'Cotação fictícia, não é PTAX real.',
    origin: 'manual',
    kind: 'regular',
  });
  insert('transactions', {
    id: 'seed-closed',
    account_id: 'closed',
    date: '2026-09-01',
    amount_cents: 5000,
    payee: 'Compra histórica fictícia',
    category_id: 'groceries',
    note: 'Histórico preservado.',
    origin: 'manual',
    kind: 'regular',
  });
  sql.push(
    "INSERT INTO transaction_tags(transaction_id,tag_id) VALUES('seed-usd','travel'),('seed-2026-10-market','planned') ON CONFLICT DO NOTHING;",
  );
  // Sessão F: exemplos isolados, fictícios e repetíveis. O marcador preserva divisões desfeitas.
  sessionF = true;
  insert('accounts', {
    id: 'seed-f-card',
    name: 'Cartão de parcelas fictício',
    kind: 'credit_card',
    currency: 'BRL',
    institution_id: 'horizonte',
    cutoff_date: '2026-10-01',
    closing_day: 20,
    due_day: 27,
  });
  insert('installment_plans', {
    id: 'seed-f-retro',
    account_id: 'seed-f-card',
    description: 'Cadeira retroativa fictícia',
    total_cents: 100010,
    count: 10,
    first_date: '2026-09-12',
    category_id: 'entertainment',
  });
  insert('installment_plans', {
    id: 'seed-f-advance',
    account_id: 'seed-f-card',
    description: 'Equipamento antecipado fictício',
    total_cents: 100000,
    count: 5,
    first_date: '2026-11-12',
    category_id: 'entertainment',
  });
  insert('installment_advances', {
    id: 'seed-f-advance-history',
    installment_plan_id: 'seed-f-advance',
    count: 2,
    face_cents: 40000,
    paid_cents: 37000,
    created_at: '2026-11-19T12:00:00Z',
  });
  for (let i = 0; i < 10; i++) {
    const ym = new Date(Date.UTC(2026, 8 + i, 1)).toISOString().slice(0, 7);
    const prev = new Date(Date.UTC(2026, 7 + i, 1)).toISOString().slice(0, 7);
    const statement = 'statement-f-' + ym;
    insert('statements', {
      id: statement,
      account_id: 'seed-f-card',
      period_start: prev + '-21',
      closing_date: ym + '-20',
      due_date: ym + '-27',
      status: 'open',
    });
    if (i < 2) {
      sql.push(
        `UPDATE statements SET status='closed',bank_amount_cents=0,closed_at='2026-10-20T12:00:00Z' WHERE id=${literal(statement)} AND bank_amount_cents IS NULL AND NOT EXISTS(SELECT 1 FROM seed_fixtures WHERE id='session-f');`,
      );
      insert('statement_checks', {
        id: 'seed-f-check-' + i,
        statement_id: statement,
        app_amount_cents: 0,
        bank_amount_cents: 0,
        action: 'close',
      });
    }
    insert('transactions', {
      id: 'seed-f-retro-' + i,
      account_id: 'seed-f-card',
      date: ym + '-12',
      amount_cents: 10001,
      payee: 'Cadeira retroativa fictícia',
      category_id: 'entertainment',
      note: 'Parcela retroativa fictícia: 3 de 10 em novembro.',
      origin: 'manual',
      kind: 'installment',
      statement_id: statement,
      installment_plan_id: 'seed-f-retro',
      installment_number: i + 1,
      retroactive: i === 0 ? 1 : 0,
      added_to_closed: i < 2 ? 1 : 0,
    });
    if (i >= 2 && i <= 6)
      insert('transactions', {
        id: 'seed-f-anticipated-' + i,
        account_id: 'seed-f-card',
        date: ym + '-12',
        amount_cents: 20000,
        payee: 'Equipamento antecipado fictício',
        category_id: 'entertainment',
        note: 'Compra com antecipação fictícia.',
        origin: 'manual',
        kind: 'installment',
        statement_id: statement,
        installment_plan_id: 'seed-f-advance',
        installment_number: i - 1,
        advance_id: i === 3 || i === 4 ? 'seed-f-advance-history' : null,
      });
  }
  insert('transactions', {
    id: 'seed-f-payment',
    account_id: 'seed-f-card',
    date: '2026-11-19',
    amount_cents: 37000,
    payee: 'Equipamento antecipado fictício',
    category_id: 'entertainment',
    note: 'Antecipação de 2 parcelas, desconto de R$ 30,00.',
    origin: 'manual',
    kind: 'installment',
    statement_id: 'statement-f-2026-11',
    installment_plan_id: 'seed-f-advance',
    advance_id: 'seed-f-advance-history',
  });
  insert('accounts', {
    id: 'seed-f-account',
    name: 'Conta de divisão fictícia',
    kind: 'checking',
    currency: 'BRL',
    institution_id: 'horizonte',
    cutoff_date: '2026-10-01',
  });
  insert('transactions', {
    id: 'seed-f-split',
    account_id: 'seed-f-account',
    date: '2026-11-18',
    amount_cents: 12345,
    payee: 'Compra mista fictícia',
    note: 'Original preservado ao desfazer a divisão.',
    origin: 'manual',
    kind: 'regular',
    category_id: 'groceries',
  });
  insert('transaction_splits', {
    id: 'seed-f-part-1',
    transaction_id: 'seed-f-split',
    position: 0,
    amount_cents: 10000,
    amount_brl_cents: 10000,
    category_id: 'groceries',
    note: 'Alimentos fictícios.',
  });
  insert('transaction_splits', {
    id: 'seed-f-part-2',
    transaction_id: 'seed-f-split',
    position: 1,
    amount_cents: 2345,
    amount_brl_cents: 2345,
    category_id: 'entertainment',
    note: 'Lazer fictício.',
  });
  insert('split_tags', { split_id: 'seed-f-part-1', tag_id: 'planned' });
  insert('split_tags', { split_id: 'seed-f-part-2', tag_id: 'travel' });
  sql.push(
    "INSERT INTO seed_fixtures(id) VALUES('session-f') ON CONFLICT DO NOTHING;",
  );
  sessionF = false;
  insert('accounts', {
    id: 'seed-h-destination',
    name: 'Dinheiro fictício H',
    kind: 'cash',
    currency: 'BRL',
    institution_id: 'horizonte',
    cutoff_date: '2026-01-01',
    opening_balance_cents: 0,
  });
  insert('transactions', {
    id: 'seed-h-transfer-out',
    account_id: 'seed-f-account',
    date: '2026-11-19',
    amount_cents: 15000,
    payee: 'Transferência fictícia',
    origin: 'manual',
    kind: 'transfer',
  });
  insert('transactions', {
    id: 'seed-h-transfer-in',
    account_id: 'seed-h-destination',
    date: '2026-11-19',
    amount_cents: -15000,
    payee: 'Transferência fictícia',
    origin: 'manual',
    kind: 'transfer',
    transfer_pair_id: 'seed-h-transfer-out',
  });
  sql.push(
    "UPDATE transactions SET transfer_pair_id='seed-h-transfer-in' WHERE id='seed-h-transfer-out' AND transfer_pair_id IS NULL;",
  );
  return sql.map((line) => line.replaceAll('\n', ' ')).join('\n');
}

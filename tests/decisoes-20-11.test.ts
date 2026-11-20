import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';
const db = env.DB as D1Database;
const FIXED = '2026-11-15T15:00:00.000Z';
const req = (path: string, method = 'GET', body?: object) =>
  app.request(
    `https://bfo.test/api${path}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-bfo-data': '2026-11-15',
      },
      body: body && JSON.stringify(body),
    },
    env,
  );
beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FIXED));
});
afterEach(() => {
  vi.useRealTimers();
});
afterAll(() => {
  vi.useRealTimers();
});
async function fixture() {
  const owned =
    "account_id IN (SELECT id FROM accounts WHERE institution_id='d20-i' OR id='d20-arquivo')";
  await db.exec(
    `DELETE FROM transaction_tags WHERE tag_id LIKE 'd20-%' OR transaction_id IN (SELECT id FROM transactions WHERE ${owned});
     DELETE FROM payee_default_tags WHERE tag_id LIKE 'd20-%';
     DELETE FROM statement_events WHERE statement_id IN (SELECT id FROM statements WHERE ${owned});
     DELETE FROM statement_checks WHERE statement_id IN (SELECT id FROM statements WHERE ${owned});
     DELETE FROM statement_carryovers WHERE source_statement_id IN (SELECT id FROM statements WHERE ${owned}) OR destination_statement_id IN (SELECT id FROM statements WHERE ${owned});
     DELETE FROM statement_revisions WHERE statement_id IN (SELECT id FROM statements WHERE ${owned});
     DELETE FROM reconciliations WHERE account_id IN (SELECT id FROM accounts WHERE institution_id='d20-i' OR id='d20-arquivo');
     DELETE FROM recurring WHERE ${owned};
     DELETE FROM transactions WHERE ${owned};
     DELETE FROM statements WHERE ${owned};
     DELETE FROM accounts WHERE institution_id='d20-i' OR id='d20-arquivo';
     DELETE FROM payees WHERE name LIKE '%fictícia 20' OR name LIKE '%fictício 20' OR name LIKE '%fictício' OR name LIKE '%fictícia';
     DELETE FROM tags WHERE id LIKE 'd20-%';
     DELETE FROM categories WHERE id LIKE 'd20-%';
     DELETE FROM category_groups WHERE id='d20-cg';
     DELETE FROM allocation_groups WHERE id='d20-g';
     DELETE FROM institutions WHERE id='d20-i';`,
  );
  await db
    .prepare(
      "INSERT INTO institutions(id,name) VALUES('d20-i','Instituição padrão fictícia')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO allocation_groups(id,name,target_percent,sort) VALUES('d20-g','Alocação padrão',0,0)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO category_groups(id,name,allocation_group_id,sort) VALUES('d20-cg','Grupo padrão','d20-g',0)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO categories(id,name,category_group_id,is_income,sort) VALUES('d20-mercado','Mercado padrão','d20-cg',0,0),('d20-casa','Casa padrão','d20-cg',0,1)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO tags(id,name,color) VALUES('d20-viagem','Viagem padrão','#112233'),('d20-casa-tag','Casa tag padrão','#445566')",
    )
    .run();
  const created = await req('/accounts', 'POST', {
    name: 'Conta padrão fictícia',
    kind: 'checking',
    currency: 'BRL',
    institution_id: 'd20-i',
    opening_balance_cents: 100000,
  });
  expect(created.status).toBe(201);
  return (await created.json()).id as string;
}
async function spend(
  account: string,
  payee: string,
  category: string,
  tags: string[],
  date = '2026-11-15',
) {
  const response = await req('/transactions', 'POST', {
    account_id: account,
    date,
    amount_cents: 1500,
    payee,
    category_id: category,
    tag_ids: tags,
  });
  expect(response.status).toBe(201);
}
it('sugere o padrão do beneficiário e, sem padrão, o último lançamento', async () => {
  const account = await fixture();
  await spend(account, 'Padaria fictícia 20', 'd20-mercado', ['d20-viagem']);
  expect(
    await (
      await req('/payees/suggestion?name=Padaria%20fict%C3%ADcia%2020')
    ).json(),
  ).toEqual({
    category_id: 'd20-mercado',
    tag_ids: ['d20-viagem'],
    source: 'last',
  });
  const payee = await db
    .prepare("SELECT id FROM payees WHERE name='Padaria fictícia 20'")
    .first<{ id: string }>();
  expect(
    (
      await req(`/payees/${payee!.id}`, 'PATCH', {
        category_id: 'd20-casa',
        tag_ids: ['d20-casa-tag'],
      })
    ).status,
  ).toBe(200);
  expect(
    await (
      await req('/payees/suggestion?name=padaria%20fict%C3%ADcia%2020')
    ).json(),
  ).toEqual({
    category_id: 'd20-casa',
    tag_ids: ['d20-casa-tag'],
    source: 'default',
  });
  await spend(account, 'Padaria fictícia 20', 'd20-mercado', ['d20-viagem']);
  expect(
    await (
      await req('/payees/suggestion?name=Padaria%20fict%C3%ADcia%2020')
    ).json(),
  ).toMatchObject({
    source: 'default',
    category_id: 'd20-casa',
  });
  expect(
    (
      await req(`/payees/${payee!.id}`, 'PATCH', {
        category_id: null,
        tag_ids: [],
      })
    ).status,
  ).toBe(200);
  const listed = (await (await req('/payees')).json()) as {
    name: string;
    has_default: number;
  }[];
  expect(listed.find((p) => p.name === 'Padaria fictícia 20')).toMatchObject({
    has_default: 0,
    default_category_id: null,
    default_tag_ids: [],
  });
  expect(
    await (
      await req('/payees/suggestion?name=Padaria%20fict%C3%ADcia%2020')
    ).json(),
  ).toEqual({
    category_id: 'd20-mercado',
    tag_ids: ['d20-viagem'],
    source: 'last',
  });
});
it('na unificação permanece o padrão do destino', async () => {
  const account = await fixture();
  await spend(account, 'Nome origem fictício 20', 'd20-mercado', [
    'd20-viagem',
  ]);
  await spend(account, 'Nome destino fictício 20', 'd20-casa', [
    'd20-casa-tag',
  ]);
  const rows = (
    await db
      .prepare('SELECT id,name FROM payees')
      .all<{ id: string; name: string }>()
  ).results;
  const source = rows.find((p) => p.name === 'Nome origem fictício 20')!;
  const target = rows.find((p) => p.name === 'Nome destino fictício 20')!;
  expect(
    (
      await req(`/payees/${source.id}`, 'PATCH', {
        category_id: 'd20-mercado',
        tag_ids: ['d20-viagem'],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req(`/payees/${target.id}`, 'PATCH', {
        category_id: 'd20-casa',
        tag_ids: [],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req('/payees/merge', 'POST', {
        target_id: target.id,
        source_ids: [source.id],
      })
    ).status,
  ).toBe(200);
  expect(
    await (
      await req('/payees/suggestion?name=Nome%20origem%20fict%C3%ADcio%2020')
    ).json(),
  ).toEqual({
    category_id: 'd20-casa',
    tag_ids: [],
    source: 'default',
  });
  expect(
    (
      await req(`/payees/${source.id}`, 'PATCH', {
        category_id: 'd20-mercado',
        tag_ids: [],
      })
    ).status,
  ).toBe(404);
});
const reqOn = (day: string, path: string, method = 'GET', body?: object) => {
  vi.setSystemTime(new Date(`${day}T15:00:00.000Z`));
  return app.request(
    `https://bfo.test/api${path}`,
    {
      method,
      headers: { 'Content-Type': 'application/json', 'x-bfo-data': day },
      body: body && JSON.stringify(body),
    },
    env,
  );
};
async function balanceOn(day: string, id: string) {
  const accounts = (await (await reqOn(day, '/accounts')).json()) as {
    id: string;
    balance_cents: number;
  }[];
  return accounts.find((a) => a.id === id)!.balance_cents;
}
async function accountOf(
  name: string,
  kind: string,
  opening: number,
  extra = {},
) {
  const response = await req('/accounts', 'POST', {
    name,
    kind,
    currency: 'BRL',
    institution_id: 'd20-i',
    opening_balance_cents: opening,
    ...extra,
  });
  expect(response.status).toBe(201);
  return (await response.json()).id as string;
}
it('lançamento futuro fica fora do saldo até a data e no resumo do mês dela', async () => {
  const account = await fixture();
  expect(
    (
      await req('/transactions', 'POST', {
        account_id: account,
        date: '2026-11-15',
        amount_cents: 1500,
        payee: 'Boleto de hoje fictício',
        category_id: 'd20-mercado',
        tag_ids: [],
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await req('/transactions', 'POST', {
        account_id: account,
        date: '2026-11-20',
        amount_cents: 2500,
        payee: 'Boleto futuro fictício',
        category_id: 'd20-mercado',
        tag_ids: [],
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await req('/transactions', 'POST', {
        account_id: account,
        date: '2026-12-03',
        amount_cents: 1800,
        payee: 'Boleto de dezembro fictício',
        category_id: 'd20-casa',
        tag_ids: [],
      })
    ).status,
  ).toBe(201);
  await db
    .prepare(
      "INSERT INTO accounts(id,name,kind) VALUES('d20-arquivo','Arquivo futuro','checking')",
    )
    .run();
  expect(
    (
      await req('/accounts/d20-arquivo/activate', 'POST', {
        cutoff_date: '2026-11-20',
        opening_balance_cents: 0,
      })
    ).status,
  ).toBe(400);
  // Abertura R$ 1.000,00. No dia 15 só entra R$ 15,00. R$ 25,00 espera 20/11.
  expect(await balanceOn('2026-11-15', account)).toBe(98500);
  expect(await balanceOn('2026-11-20', account)).toBe(96000);
  expect(await balanceOn('2026-12-03', account)).toBe(94200);
  const november = (await (
    await req('/month-summary?month=2026-11')
  ).json()) as { category_id: string; amount_cents: number }[];
  const december = (await (
    await req('/month-summary?month=2026-12')
  ).json()) as { category_id: string; amount_cents: number }[];
  expect(
    november.find((r) => r.category_id === 'd20-mercado')?.amount_cents,
  ).toBe(4000);
  expect(december.find((r) => r.category_id === 'd20-casa')?.amount_cents).toBe(
    1800,
  );
  expect(november.find((r) => r.category_id === 'd20-casa')).toBeUndefined();
  const preview = await (
    await req(`/accounts/${account}/reconcile`, 'POST', {
      bank_balance_cents: 98500,
    })
  ).json();
  expect(preview).toMatchObject({
    app_balance_cents: 98500,
    adjustment_cents: 0,
  });
  expect(
    (
      await req(`/accounts/${account}/reconcile`, 'POST', {
        bank_balance_cents: 96000,
        expected_balance_cents: 96000,
        confirm: true,
      })
    ).status,
  ).toBe(409);
});
it('transferência e pagamento futuros só mudam o saldo na data', async () => {
  const source = await fixture();
  const dest = await accountOf('Destino futuro fictício', 'checking', 20000);
  expect(
    (
      await req('/transfers', 'POST', {
        account_id: source,
        destination_account_id: dest,
        date: '2026-11-20',
        amount_cents: 3000,
        note: 'Transferência futura',
        tag_ids: [],
      })
    ).status,
  ).toBe(201);
  expect(await balanceOn('2026-11-15', source)).toBe(100000);
  expect(await balanceOn('2026-11-15', dest)).toBe(20000);
  expect(await balanceOn('2026-11-20', source)).toBe(97000);
  expect(await balanceOn('2026-11-20', dest)).toBe(23000);
  const card = await accountOf('Cartão futuro fictício', 'credit_card', 0, {
    closing_day: 20,
    due_day: 27,
  });
  expect(
    (
      await req('/transactions', 'POST', {
        account_id: card,
        date: '2026-11-15',
        amount_cents: 5000,
        payee: 'Compra já lançada fictícia',
        category_id: 'd20-mercado',
        tag_ids: [],
      })
    ).status,
  ).toBe(201);
  const statements = (await (
    await req(`/cards/${card}/statements`)
  ).json()) as {
    id: string;
    total_cents: number;
    status: string;
  }[];
  const bill = statements.find((s) => s.total_cents === 5000)!;
  expect(
    (
      await req(`/statements/${bill.id}/check`, 'POST', {
        action: 'close',
        expected_total_cents: 5000,
        bank_amount_cents: 5000,
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await req(`/statements/${bill.id}/pay`, 'POST', {
        account_id: source,
        date: '2026-11-22',
        amount_cents: 5000,
      })
    ).status,
  ).toBe(201);
  expect(await balanceOn('2026-11-15', source)).toBe(100000);
  expect(await balanceOn('2026-11-15', card)).toBe(-5000);
  const paid = (await (await req(`/cards/${card}/statements`)).json()) as {
    id: string;
    status: string;
  }[];
  expect(paid.find((s) => s.id === bill.id)?.status).toBe('paid');
  expect(await balanceOn('2026-11-22', source)).toBe(92000);
  expect(await balanceOn('2026-11-22', card)).toBe(0);
});
it('compra futura cai na fatura da data e o recorrente reconhecido não duplica em Próximos', async () => {
  const checking = await fixture();
  const card = await accountOf('Cartão do ciclo fictício', 'credit_card', 0, {
    closing_day: 20,
    due_day: 27,
  });
  expect(
    (
      await req('/transactions', 'POST', {
        account_id: card,
        date: '2026-11-25',
        amount_cents: 12345,
        payee: 'Compra no ciclo seguinte',
        category_id: 'd20-mercado',
        tag_ids: [],
      })
    ).status,
  ).toBe(201);
  const statements = (await (
    await req(`/cards/${card}/statements`)
  ).json()) as {
    closing_date: string;
    due_date: string;
    total_cents: number;
  }[];
  expect(statements.find((s) => s.total_cents === 12345)).toMatchObject({
    closing_date: '2026-12-20',
    due_date: '2026-12-27',
  });
  expect(
    statements.some(
      (s) => s.closing_date === '2026-11-20' && s.total_cents === 12345,
    ),
  ).toBe(false);
  expect(await balanceOn('2026-11-15', card)).toBe(0);
  expect(await balanceOn('2026-11-25', card)).toBe(-12345);
  expect(
    (
      await req('/recurring', 'POST', {
        account_id: checking,
        payee: 'Aluguel futuro fictício',
        amount_cents: 40000,
        category_id: 'd20-casa',
        cadence: 'monthly',
        next_date: '2026-11-20',
        is_subscription: 0,
        active: 1,
      })
    ).status,
  ).toBe(201);
  const before = (await (await req('/upcoming')).json()) as {
    from: string;
    to: string;
    items: {
      date: string;
      label: string;
      type: string;
      amount_cents: number;
    }[];
  };
  expect(before.from).toBe('2026-11-15');
  expect(before.to).toBe('2026-12-31');
  expect(
    before.items.filter(
      (i) => i.date === '2026-11-20' && i.label === 'Aluguel futuro fictício',
    ),
  ).toEqual([
    expect.objectContaining({ type: 'recurring', amount_cents: 40000 }),
  ]);
  expect(
    (
      await req('/transactions', 'POST', {
        account_id: checking,
        date: '2026-11-20',
        amount_cents: 40000,
        payee: 'Aluguel futuro fictício',
        category_id: 'd20-casa',
        tag_ids: [],
      })
    ).status,
  ).toBe(201);
  const after = (await (await req('/upcoming')).json()) as {
    items: {
      date: string;
      label: string;
      type: string;
      amount_cents: number;
      components: { label: string }[];
    }[];
  };
  expect(
    after.items.filter(
      (i) => i.date === '2026-11-20' && i.label === 'Aluguel futuro fictício',
    ),
  ).toEqual([
    expect.objectContaining({ type: 'scheduled', amount_cents: 40000 }),
  ]);
  const mentions = after.items.flatMap((i) => [
    i.label,
    ...i.components.map((p) => p.label),
  ]);
  expect(
    mentions.filter((label) => label === 'Compra no ciclo seguinte'),
  ).toEqual(['Compra no ciclo seguinte']);
  expect(
    after.items
      .filter((i) => i.label === 'Aluguel futuro fictício')
      .map((i) => `${i.date}:${i.type}`),
  ).toEqual(['2026-11-20:scheduled', '2026-12-20:recurring']);
});
it('saldo do cartão em Contas ignora parcela futura e o comprometido a inclui', async () => {
  await fixture();
  const card = await accountOf('Cartão do saldo fictício', 'credit_card', 0, {
    closing_day: 20,
    due_day: 27,
    credit_limit_cents: 100000,
  });
  expect(
    (
      await req('/transactions', 'POST', {
        account_id: card,
        date: '2026-11-15',
        amount_cents: 8000,
        payee: 'Compra à vista do cartão',
        category_id: 'd20-mercado',
        tag_ids: [],
      })
    ).status,
  ).toBe(201);
  const plan = await req('/transactions', 'POST', {
    account_id: card,
    date: '2026-11-15',
    amount_cents: 9000,
    payee: 'Compra parcelada do cartão',
    category_id: 'd20-casa',
    tag_ids: [],
    installment_count: 3,
  });
  expect(plan.status).toBe(201);
  const { installment_plan_id } = await plan.json();
  const parts = (
    await db
      .prepare(
        'SELECT date,amount_cents FROM transactions WHERE installment_plan_id=? ORDER BY installment_number',
      )
      .bind(installment_plan_id)
      .all<{ date: string; amount_cents: number }>()
  ).results;
  expect(parts).toEqual([
    { date: '2026-11-15', amount_cents: 3000 },
    { date: '2026-12-15', amount_cents: 3000 },
    { date: '2027-01-15', amount_cents: 3000 },
  ]);
  expect(
    (
      await req('/transactions', 'POST', {
        account_id: card,
        date: '2026-11-18',
        amount_cents: 2500,
        payee: 'Compra ainda não vencida',
        category_id: 'd20-mercado',
        tag_ids: [],
      })
    ).status,
  ).toBe(201);
  // Lançado até 15/11 e não pago: R$ 80,00 + R$ 30,00. Fora: R$ 25,00 de 18/11 e duas parcelas de R$ 30,00.
  expect(await balanceOn('2026-11-15', card)).toBe(-11000);
  expect(await balanceOn('2026-11-18', card)).toBe(-13500);
  const commitment = await (await req(`/cards/${card}/commitment`)).json();
  expect(commitment).toMatchObject({
    committed_cents: 19500,
    credit_limit_cents: 100000,
    available_cents: 80500,
  });
  const statements = (await (
    await req(`/cards/${card}/statements`)
  ).json()) as {
    id: string;
    closing_date: string;
    total_cents: number;
  }[];
  const november = statements.find((s) => s.closing_date === '2026-11-20')!;
  expect(november.total_cents).toBe(13500);
  expect(
    (
      await req(`/statements/${november.id}/check`, 'POST', {
        action: 'close',
        expected_total_cents: 13500,
        bank_amount_cents: 13500,
      })
    ).status,
  ).toBe(201);
  const checking = await accountOf(
    'Corrente do cartão fictícia',
    'checking',
    50000,
  );
  expect(
    (
      await req(`/statements/${november.id}/pay`, 'POST', {
        account_id: checking,
        date: '2026-11-15',
        amount_cents: 4000,
      })
    ).status,
  ).toBe(201);
  // Pagou R$ 40,00 em 15/11. O saldo fica em R$ 70,00. O comprometido guarda o restante da fatura e as duas parcelas.
  expect(await balanceOn('2026-11-15', card)).toBe(-7000);
  expect(await (await req(`/cards/${card}/commitment`)).json()).toMatchObject({
    committed_cents: 15500,
  });
});

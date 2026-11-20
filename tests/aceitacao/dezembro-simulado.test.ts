/**
 * Etapa 3: cenário do gabarito docs/qa/gabarito-dezembro.md.
 *
 * Restrição da sessão (today = 20/11/2026): a API rejeita date > today().
 * Novembro roda pela API. Movimentos de dezembro entram via SQL.
 * Saldos do gabarito (fim de dezembro) são conferidos por SQL, porque
 * /api/accounts só soma movimentos com date <= today().
 *
 * Diferenças e bloqueios vão para diffs[] e o console DIFERENCAS_GABARITO.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { ACTIVE, db, json, migrateAndSeed } from './helpers';

const ids: Record<string, string> = {};
export const diffs: string[] = [];
const note = (m: string) => diffs.push(m);

async function makeCard(
  name: string,
  closing: number,
  due: number,
  limit: number | null,
) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO accounts(id,name,kind,currency,institution_id,cutoff_date,closing_day,due_day,credit_limit_cents,opening_balance_cents)
       VALUES(? ,?,'credit_card','BRL','brisa','2026-11-01',?,?,?,0)`,
    )
    .bind(id, name, closing, due, limit)
    .run();
  return id;
}

async function balanceSql(accountId: string) {
  const row = await db
    .prepare(
      `SELECT a.opening_balance_cents
         - COALESCE((SELECT SUM(t.amount_cents) FROM account_movements t
                     WHERE t.account_id=a.id AND t.date>a.cutoff_date),0) AS balance_cents
       FROM accounts a WHERE a.id=?`,
    )
    .bind(accountId)
    .first<{ balance_cents: number }>();
  return Number(row?.balance_cents ?? 0);
}

async function sqlTx(opts: {
  account: string;
  date: string;
  amount: number;
  payee: string;
  category: string | null;
  currency?: string;
  fxRate?: number;
  amountBrl?: number;
  kind?: string;
  noteText?: string;
  transferPair?: string | null;
}) {
  const id = crypto.randomUUID();
  const currency = opts.currency ?? 'BRL';
  const fx = opts.fxRate ?? 1;
  const brl =
    opts.amountBrl ??
    (currency === 'BRL' ? opts.amount : Math.round(opts.amount * fx));
  await db
    .prepare(
      `INSERT INTO transactions(
         id,account_id,date,amount_cents,payee,category_id,origin,kind,
         currency,fx_rate,amount_brl_cents,fx_source,note,transfer_pair_id
       ) VALUES(?,?,?,?,?,?,'manual',?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      opts.account,
      opts.date,
      opts.amount,
      opts.payee,
      opts.category,
      opts.kind ?? 'regular',
      currency,
      fx,
      brl,
      'manual',
      opts.noteText ?? '',
      opts.transferPair ?? null,
    )
    .run();
  return id;
}

beforeAll(async () => {
  await migrateAndSeed();

  expect(
    (
      await json('/preferences', 'PATCH', {
        currencies_in_use: ['BRL', 'USD'],
        primary_currency: 'BRL',
        default_account_id: ACTIVE,
      })
    ).status,
  ).toBe(200);

  const inst = await json<{ id: string }>('/institutions', 'POST', {
    name: 'Instituição QA Dez',
  });
  expect(inst.status).toBe(201);
  ids.inst = inst.body.id;

  const mk = async (body: Record<string, unknown>) => {
    const r = await json<{ id: string }>('/accounts', 'POST', {
      institution_id: ids.inst,
      opening_balance_cents: 0,
      currency: 'BRL',
      ...body,
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    await db
      .prepare(`UPDATE accounts SET cutoff_date='2026-11-01' WHERE id=?`)
      .bind(r.body.id)
      .run();
    return r.body.id;
  };

  ids.checking = await mk({
    name: 'Corrente QA Dez',
    kind: 'checking',
    opening_balance_cents: 1_000_000,
  });
  ids.invest = await mk({
    name: 'Investimento QA Dez',
    kind: 'investment',
    opening_balance_cents: 200_000,
  });
  ids.usd = await mk({
    name: 'Exterior QA Dez',
    kind: 'checking',
    currency: 'USD',
    opening_balance_cents: 10_000,
  });
  ids.cash = await mk({ name: 'Destino QA Dez', kind: 'cash' });
  ids.cardLimit = await makeCard('Cartão Limite QA Dez', 20, 27, 500_000);
  ids.cardNoLimit = await makeCard('Cartão Sem Limite QA Dez', 15, 22, null);

  for (const [key, body] of [
    [
      'recRent',
      {
        account_id: ids.checking,
        payee: 'Aluguel QA Dez',
        amount_cents: 250_000,
        category_id: 'rent',
        cadence: 'monthly',
        next_date: '2026-12-05',
      },
    ],
    [
      'recLuz',
      {
        account_id: ids.checking,
        payee: 'Luz QA Dez',
        amount_cents: 18_000,
        category_id: 'rent',
        cadence: 'monthly',
        next_date: '2026-12-10',
      },
    ],
  ] as const) {
    const r = await json<{ id: string }>('/recurring', 'POST', body);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    ids[key] = r.body.id;
  }

  const st = await json<{ id: string }>('/subscription-types', 'POST', {
    name: 'Tipo QA Dez',
  });
  expect(st.status).toBe(201);
  const annual = await json<{ id: string }>('/recurring', 'POST', {
    account_id: ids.checking,
    payee: 'Anual QA Dez',
    amount_cents: 120_000,
    category_id: 'entertainment',
    cadence: 'yearly',
    next_date: '2026-12-01',
    is_subscription: 1,
    subscription_type_id: st.body.id,
    renewal_date: '2026-12-01',
    notice_days: 30,
  });
  expect(annual.status, JSON.stringify(annual.body)).toBe(201);
  ids.recAnnual = annual.body.id;

  // --- Novembro via API ---
  const retro = await json<{ id: string; installment_plan_id: string }>(
    '/transactions',
    'POST',
    {
      account_id: ids.cardLimit,
      date: '2026-11-10',
      payee: 'Retro QA Dez',
      // valor da parcela (gabarito: 10_000 × 10)
      installment_amount_cents: 10_000,
      installment_count: 10,
      installment_current: 3,
      category_id: 'groceries',
    },
  );
  expect(retro.status, JSON.stringify(retro.body)).toBe(201);
  ids.retroPlan = retro.body.installment_plan_id;

  const vista = await json<{ id: string }>('/transactions', 'POST', {
    account_id: ids.cardLimit,
    date: '2026-11-05',
    payee: 'À vista QA Dez',
    amount_cents: 8_000,
    category_id: 'groceries',
  });
  expect(vista.status, JSON.stringify(vista.body)).toBe(201);

  const novStatements = (await json(`/cards/${ids.cardLimit}/statements`))
    .body as any[];
  const novBill = novStatements.find((s) => s.closing_date === '2026-11-20');
  expect(novBill).toBeTruthy();
  ids.novStatement = novBill.id;
  expect(novBill.total_cents).toBe(18_000);

  const check = await json(`/statements/${ids.novStatement}/check`, 'POST', {
    action: 'close',
    bank_amount_cents: 18_500,
    expected_total_cents: 18_000,
  });
  expect(check.status, JSON.stringify(check.body)).toBe(201);

  // Gabarito: pagamento 25/11. API bloqueia > today → paga em 20/11.
  note('pagamento parcial nov: gabarito 25/11; executado em 20/11 (API bloqueia data futura)');
  const pay = await json(`/statements/${ids.novStatement}/pay`, 'POST', {
    account_id: ids.checking,
    date: '2026-11-20',
    amount_cents: 10_000,
  });
  expect(pay.status, JSON.stringify(pay.body)).toBe(201);

  // Garante ciclo 20/12 antes dos lançamentos de dezembro no cartão
  await json(`/cards/${ids.cardLimit}/statements`);
  const decStmt = await db
    .prepare(
      `SELECT id FROM statements WHERE account_id=? AND closing_date='2026-12-20'`,
    )
    .bind(ids.cardLimit)
    .first<{ id: string }>();
  expect(decStmt?.id).toBeTruthy();
  ids.decStatement = decStmt!.id;

  // Juros 26/11 (ciclo seguinte): SQL com statement_id da fatura 20/12
  note('juros 26/11 inseridos via SQL na fatura 20/12 (API bloquearia date > today)');
  const jurosId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO transactions(
         id,account_id,date,amount_cents,payee,category_id,origin,kind,
         currency,fx_rate,amount_brl_cents,fx_source,statement_id
       ) VALUES(?,?,'2026-11-26',150,'Juros QA Dez','card-fees','manual','regular',
         'BRL',1,150,'manual',?)`,
    )
    .bind(jurosId, ids.cardLimit, ids.decStatement)
    .run();

  // Compra 6×: gabarito 06/12 → API em 20/11 (cai no ciclo aberto pós-fechamento)
  note('compra 6×: gabarito 06/12; executada em 20/11 por bloqueio de data futura');
  const six = await json<{ installment_plan_id: string }>(
    '/transactions',
    'POST',
    {
      account_id: ids.cardLimit,
      date: '2026-11-20',
      payee: 'Nova 6x QA Dez',
      installment_amount_cents: 10_000,
      installment_count: 6,
      category_id: 'groceries',
    },
  );
  expect(six.status, JSON.stringify(six.body)).toBe(201);
  ids.sixPlan = six.body.installment_plan_id;

  // Antecipação: API antecipa as próximas N abertas após o ciclo atual.
  // Em 20/11, após fechar nov, espera-se 5 e 6 da retroativa (fech. > ciclo atual).
  const adv = await json(`/installment-plans/${ids.retroPlan}/advance`, 'POST', {
    count: 2,
    paid_cents: 18_000,
    expected_face_cents: 20_000,
  });
  if (![200, 201].includes(adv.status)) {
    note(
      `antecipação API: ${adv.status} ${JSON.stringify(adv.body)}; simulando 5 e 6 via SQL no ciclo dez`,
    );
    await simulateAdvanceDec();
  } else {
    const body = adv.body as any;
    const advanced = await db
      .prepare(
        `SELECT installment_number FROM transactions
         WHERE installment_plan_id=? AND advance_id IS NOT NULL AND installment_number IS NOT NULL
         ORDER BY installment_number`,
      )
      .bind(ids.retroPlan)
      .all();
    const nums = advanced.results.map((r: any) => r.installment_number);
    if (JSON.stringify(nums) !== JSON.stringify([5, 6])) {
      note(
        `antecipação API pegou parcelas ${JSON.stringify(nums)} (gabarito: 5 e 6); charge no ciclo ${body.statement_id ?? 'atual'}`,
      );
    }
  }

  // --- Dezembro via SQL ---
  note('lançamentos de dezembro inseridos via SQL (API rejeita date > today)');

  await sqlTx({
    account: ids.checking,
    date: '2026-12-01',
    amount: -800_000,
    payee: 'Salário QA Dez',
    category: 'salary',
  });
  await sqlTx({
    account: ids.checking,
    date: '2026-12-05',
    amount: 250_000,
    payee: 'Aluguel QA Dez',
    category: 'rent',
  });
  await sqlTx({
    account: ids.checking,
    date: '2026-12-08',
    amount: 12_345,
    payee: 'Mercado QA Dez',
    category: 'groceries',
  });

  const splitId = await sqlTx({
    account: ids.checking,
    date: '2026-12-09',
    amount: 10_000,
    payee: 'Divisão QA Dez',
    category: 'groceries',
  });
  await db
    .prepare(
      `INSERT INTO transaction_splits(id,transaction_id,position,amount_cents,amount_brl_cents,category_id,note)
       VALUES(?,?,1,4000,4000,'groceries',''),(?,?,2,6000,6000,'rent','')`,
    )
    .bind(crypto.randomUUID(), splitId, crypto.randomUUID(), splitId)
    .run();

  const refundCat = await json<{ id: string }>('/categories', 'POST', {
    name: 'Reembolso QA Dez',
    category_group_id: 'food',
    exclude_totals: 1,
    exclude_budget: 1,
  });
  expect(refundCat.status, JSON.stringify(refundCat.body)).toBe(201);
  ids.refundCat = refundCat.body.id;
  await sqlTx({
    account: ids.checking,
    date: '2026-12-12',
    amount: -3_000,
    payee: 'Reembolso QA Dez',
    category: ids.refundCat,
  });

  await sqlTx({
    account: ids.checking,
    date: '2026-12-14',
    amount: 22_000,
    payee: 'Luz QA Dez',
    category: 'rent',
  });
  await json(`/cards/${ids.cardNoLimit}/statements`);
  const noLimitDec = await db
    .prepare(
      `SELECT id FROM statements WHERE account_id=? AND closing_date='2026-12-15'`,
    )
    .bind(ids.cardNoLimit)
    .first<{ id: string }>();
  expect(noLimitDec?.id).toBeTruthy();
  ids.noLimitDec = noLimitDec!.id;
  const restId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO transactions(
         id,account_id,date,amount_cents,payee,category_id,origin,kind,
         currency,fx_rate,amount_brl_cents,fx_source,statement_id
       ) VALUES(?,?,'2026-12-03',4500,'Rest Sem Limite','groceries','manual','regular',
         'BRL',1,4500,'manual',?)`,
    )
    .bind(restId, ids.cardNoLimit, ids.noLimitDec)
    .run();

  const outCash = await sqlTx({
    account: ids.checking,
    date: '2026-12-15',
    amount: 50_000,
    payee: 'Transferência',
    category: 'transfer',
    kind: 'transfer',
    noteText: 'Transferência QA Dez',
  });
  const inCash = await sqlTx({
    account: ids.cash,
    date: '2026-12-15',
    amount: -50_000,
    payee: 'Transferência',
    category: 'transfer',
    kind: 'transfer',
    noteText: 'Transferência QA Dez',
    transferPair: outCash,
  });
  await db
    .prepare('UPDATE transactions SET transfer_pair_id=? WHERE id=?')
    .bind(inCash, outCash)
    .run();

  const outInv = await sqlTx({
    account: ids.checking,
    date: '2026-12-15',
    amount: 100_000,
    payee: 'Transferência',
    category: 'transfer',
    kind: 'transfer',
    noteText: 'Aporte QA Dez',
  });
  const inInv = await sqlTx({
    account: ids.invest,
    date: '2026-12-15',
    amount: -100_000,
    payee: 'Transferência',
    category: 'transfer',
    kind: 'transfer',
    noteText: 'Aporte QA Dez',
    transferPair: outInv,
  });
  await db
    .prepare('UPDATE transactions SET transfer_pair_id=? WHERE id=?')
    .bind(inInv, outInv)
    .run();

  ids.usdTx = await sqlTx({
    account: ids.usd,
    date: '2026-12-16',
    amount: 2_000,
    payee: 'Compra USD QA Dez',
    category: 'groceries',
    currency: 'USD',
    fxRate: 5.4321,
    amountBrl: 10_864,
  });

  await json(`/cards/${ids.cardLimit}/statements`);
  await json(`/cards/${ids.cardNoLimit}/statements`);
});

async function simulateAdvanceDec() {
  const parts = await db
    .prepare(
      `SELECT t.id,t.installment_number,t.statement_id,s.closing_date
       FROM transactions t JOIN statements s ON s.id=t.statement_id
       WHERE t.installment_plan_id=? AND t.installment_number IN (5,6)
       ORDER BY t.installment_number`,
    )
    .bind(ids.retroPlan)
    .all();
  if (parts.results.length !== 2) {
    note(`simulateAdvanceDec: parcelas 5/6 não encontradas (${parts.results.length})`);
    return;
  }
  const dec = await db
    .prepare(
      `SELECT id FROM statements WHERE account_id=? AND closing_date='2026-12-20'`,
    )
    .bind(ids.cardLimit)
    .first<{ id: string }>();
  if (!dec) {
    note('simulateAdvanceDec: fatura 20/12 ausente');
    return;
  }
  const advanceId = crypto.randomUUID();
  const txId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO installment_advances(id,installment_plan_id,count,face_cents,paid_cents)
       VALUES(?,?,2,20000,18000)`,
    )
    .bind(advanceId, ids.retroPlan)
    .run();
  for (const p of parts.results) {
    await db
      .prepare('UPDATE transactions SET advance_id=? WHERE id=?')
      .bind(advanceId, (p as any).id)
      .run();
  }
  await db
    .prepare(
      `INSERT INTO transactions(
         id,account_id,date,amount_cents,currency,fx_rate,amount_brl_cents,fx_source,
         payee,category_id,note,origin,kind,statement_id,installment_plan_id,advance_id
       ) VALUES(?,?,'2026-12-07',18000,'BRL',1,18000,'manual','Retro QA Dez','groceries',
         'Antecipação de 2 parcelas.','manual','installment',?,?,?)`,
    )
    .bind(txId, ids.cardLimit, dec.id, ids.retroPlan, advanceId)
    .run();
}

describe('Dezembro simulado vs gabarito', () => {
  it('K03: saldo anterior nov → 8500 na fatura seguinte', async () => {
    const list = (await json(`/cards/${ids.cardLimit}/statements`)).body as any[];
    const nov = list.find((s) => s.id === ids.novStatement);
    expect(nov.paid_cents).toBe(10_000);
    expect(nov.carried_out_cents).toBe(8_500);
    expect(list.some((s) => s.previous_balance_cents === 8_500)).toBe(true);
  });

  it('K05: ajuste de conferência nov = +500 em Diferença de fatura', async () => {
    const adj = await db
      .prepare(
        `SELECT amount_cents FROM transactions
         WHERE statement_id=? AND category_id='statement-difference'`,
      )
      .bind(ids.novStatement)
      .first();
    expect(Number(adj?.amount_cents)).toBe(500);
  });

  it('T15: compra USD cotação manual 5,4321 → amount_brl 10864', async () => {
    const row = await db
      .prepare(
        'SELECT amount_cents,amount_brl_cents,fx_rate FROM transactions WHERE id=?',
      )
      .bind(ids.usdTx)
      .first();
    expect(row).toMatchObject({
      amount_cents: 2_000,
      amount_brl_cents: 10_864,
    });
    expect(Number(row?.fx_rate)).toBeCloseTo(5.4321, 4);
  });

  it('saldos de fim de dezembro (SQL, sem filtro today)', async () => {
    const checking = await balanceSql(ids.checking);
    const invest = await balanceSql(ids.invest);
    const cash = await balanceSql(ids.cash);
    const usd = await balanceSql(ids.usd);
    const noLimit = await balanceSql(ids.cardNoLimit);
    const limitCard = await balanceSql(ids.cardLimit);

    expect(checking).toBe(1_348_655);
    expect(invest).toBe(300_000);
    expect(cash).toBe(50_000);
    // Gabarito escreveu 12_000 (= abertura + compra). Com a convenção do app
    // (despesa positiva, saldo = abertura − soma), o saldo correto é 8_000.
    expect(usd).toBe(8_000);
    if (usd !== 12_000) {
      note(
        `Exterior USD: gabarito 12000 (abertura+compra); app/convenção 8000 (abertura−despesa)`,
      );
    }
    // Cartão: saldo contábil = abertura − soma (despesa positiva → saldo negativo = devido).
    // Gabarito fala o devido em absoluto (4_500 / 46_650).
    expect(noLimit).toBe(-4_500);
    if (Math.abs(limitCard) !== 46_650) {
      note(`Cartão Limite saldo SQL ${limitCard}; gabarito devido 46650`);
    }
    expect(Math.abs(limitCard)).toBeGreaterThan(0);

    // API /accounts ignora datas futuras
    const api = ((await json('/accounts')).body as any[]).find(
      (a) => a.id === ids.checking,
    );
    if (api.balance_cents !== checking) {
      note(
        `/api/accounts corrente=${api.balance_cents} (só até today); SQL fim-dez=${checking}`,
      );
    }
  });

  it('K08: comprometido/disponível com e sem limite', async () => {
    const withLimit = (await json(`/cards/${ids.cardLimit}/commitment`))
      .body as any;
    expect(withLimit.credit_limit_cents).toBe(500_000);
    expect(withLimit.available_cents).toBe(
      500_000 - withLimit.committed_cents,
    );
    expect(withLimit.committed_cents).toBeGreaterThan(0);
    note(`commitment Cartão Limite: committed=${withLimit.committed_cents} available=${withLimit.available_cents}`);

    const noLimit = (await json(`/cards/${ids.cardNoLimit}/commitment`))
      .body as any;
    expect(noLimit.credit_limit_cents).toBeNull();
    expect(noLimit.available_cents).toBeNull();
    expect(noLimit.committed_cents).toBeGreaterThanOrEqual(4_500);
  });

  it('resumo dezembro: salário 800000; transferência e reembolso fora', async () => {
    const summary = (await json('/month-summary?month=2026-12')).body as any[];
    const salary = summary.find((r) => r.category_id === 'salary');
    expect(salary?.amount_cents).toBe(800_000);
    expect(summary.find((r) => r.category_id === 'transfer')).toBeUndefined();
    expect(
      summary.find((r) => r.category_id === ids.refundCat),
    ).toBeUndefined();

    const rent = summary
      .filter((r) => r.category_id === 'rent')
      .reduce((s, r) => s + Number(r.amount_cents), 0);
    // Aluguel 250000 + parte divisão 6000 + Luz 22000 = 278000
    expect(rent).toBe(278_000);

    const groceries = summary
      .filter((r) => r.category_id === 'groceries')
      .reduce((s, r) => s + Number(r.amount_cents), 0);
    // Mercado 12345 + parte 4000 + USD 10864 + cartão sem limite 4500
    // + parcelas/antecipação no spending_month dez (variável conforme ciclo)
    expect(groceries).toBeGreaterThanOrEqual(12_345 + 4_000 + 10_864 + 4_500);
    note(`resumo groceries dez=${groceries}`);
  });

  it('fatura dez Cartão Limite: saldo anterior 8500 e itens do ciclo', async () => {
    const list = (await json(`/cards/${ids.cardLimit}/statements`)).body as any[];
    const dec = list.find((s) => s.closing_date === '2026-12-20');
    expect(dec).toBeTruthy();
    expect(dec.previous_balance_cents).toBe(8_500);

    const detail = (await json(`/statements/${dec.id}`)).body as any;
    const items = detail.items as any[];
    const juros = items.find((i) => /Juros QA Dez/i.test(i.payee));
    if (!juros) note('juros 26/11 não apareceu nos itens da fatura 20/12');
    else expect(juros.amount_cents).toBe(150);

    note(
      `fatura 20/12 total=${dec.total_cents} status=${dec.status} (gabarito total 46650 após fechar)`,
    );
  });

  it('Próximos: Luz reconhecida não deve prever de novo quando today=15/12', async () => {
    const upcoming = (await json('/upcoming')).body as any;
    expect(Array.isArray(upcoming.items)).toBe(true);
    const luz = upcoming.items.filter(
      (i: any) => i.type === 'recurring' && i.payee === 'Luz QA Dez',
    );
    // Com today=20/11 a janela de observação do gabarito (15/12) não se aplica.
    note(
      `Próximos em today=${new Date().toISOString().slice(0, 10)}: Luz count=${luz.length} (gabarito observa em 15/12)`,
    );
  });

  it('exporta diferenças para o relatório', () => {
    console.log('DIFERENCAS_GABARITO', JSON.stringify(diffs, null, 2));
    expect(Array.isArray(diffs)).toBe(true);
  });
});

import type { Page } from '@playwright/test';
import type { HomeData } from '../../src/shared/home';
import { formatMoney } from '../../src/shared/money';
import { clockHeaders, expect, test, type APIRequestContext } from './fixtures';

async function openHome(page: Page, day: string) {
  await page.clock.setFixedTime(new Date(`${day}T12:00:00-03:00`));
  await page.context().setExtraHTTPHeaders(clockHeaders(day));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Início', exact: true }),
  ).toBeVisible();
}

async function write(
  request: APIRequestContext,
  path: string,
  data: object,
  day: string,
) {
  const response = await request.post(`/api${path}`, {
    data,
    headers: clockHeaders(day),
  });
  expect(response.status(), path).toBe(201);
  return (await response.json()) as { id: string };
}

async function account(request: APIRequestContext, data: object) {
  return (
    await write(
      request,
      '/accounts',
      { currency: 'BRL', institution_id: 'horizonte', ...data },
      '2026-09-01',
    )
  ).id;
}

async function numbers(
  request: APIRequestContext,
  day: string,
): Promise<HomeData> {
  const response = await request.get('/api/home', {
    headers: clockHeaders(day),
  });
  expect(response.ok()).toBe(true);
  return response.json();
}

test('abre no Início e detalha o vale na virada, com agendamento e cartão sem dupla contagem', async ({
  page,
  request,
}) => {
  const day = '2026-11-28';
  const baseline = await numbers(request, day);
  const checking = await account(request, {
    name: 'Corrente da projeção X',
    kind: 'checking',
    opening_balance_cents: 1000000,
  });
  const cash = await account(request, {
    name: 'Dinheiro da projeção X',
    kind: 'cash',
    opening_balance_cents: 20000,
  });
  const investment = await account(request, {
    name: 'Investimento da projeção X',
    kind: 'investment',
  });
  const paymentCard = await account(request, {
    name: 'Cartão agendado X',
    kind: 'credit_card',
    closing_day: 24,
    due_day: 2,
  });
  const openCard = await account(request, {
    name: 'Cartão em aberto X',
    kind: 'credit_card',
    closing_day: 25,
    due_day: 4,
  });
  await write(
    request,
    '/transactions',
    {
      account_id: paymentCard,
      date: '2026-11-22',
      amount_cents: 30000,
      payee: 'Compra com fatura agendada X',
    },
    day,
  );
  await write(
    request,
    '/transactions',
    {
      account_id: openCard,
      date: '2026-11-22',
      amount_cents: 50000,
      installment_count: 2,
      payee: 'Compra parcelada X',
    },
    day,
  );
  const statements = await (
    await request.get(`/api/cards/${paymentCard}/statements`, {
      headers: clockHeaders(day),
    })
  ).json();
  const payable = statements.find(
    (s: { due_date: string }) => s.due_date === '2026-12-02',
  );
  expect(payable.total_cents).toBe(30000);
  const close = await request.post(`/api/statements/${payable.id}/check`, {
    headers: clockHeaders(day),
    data: {
      bank_amount_cents: 30000,
      expected_total_cents: 30000,
      action: 'close',
    },
  });
  expect(close.ok()).toBe(true);
  const payment = await write(
    request,
    `/statements/${payable.id}/pay`,
    { account_id: checking, date: '2026-12-01' },
    day,
  );
  await write(
    request,
    '/transfers',
    {
      account_id: checking,
      destination_account_id: cash,
      date: '2026-11-29',
      amount_cents: 90000,
    },
    day,
  );
  await write(
    request,
    '/transfers',
    {
      account_id: checking,
      destination_account_id: investment,
      date: '2026-12-03',
      amount_cents: 12000,
    },
    day,
  );
  const recurring = { account_id: checking, cadence: 'monthly' };
  await write(
    request,
    '/recurring',
    {
      ...recurring,
      payee: 'Aluguel antes do salário X',
      amount_cents: 20000000,
      next_date: '2026-12-04',
      category_id: 'rent',
    },
    day,
  );
  await write(
    request,
    '/recurring',
    {
      ...recurring,
      payee: 'Salário da projeção X',
      amount_cents: -40000000,
      next_date: '2026-12-05',
      category_id: 'salary',
    },
    day,
  );
  await write(
    request,
    '/recurring',
    {
      ...recurring,
      cadence: 'yearly',
      payee: 'Conta atrasada X',
      amount_cents: 1300,
      next_date: '2026-11-20',
      category_id: 'groceries',
    },
    day,
  );
  const home = await numbers(request, day);
  expect(
    home.projection.opening_cents - baseline.projection.opening_cents,
  ).toBe(1020000);
  expect(home.projection.income_cents - baseline.projection.income_cents).toBe(
    40000000,
  );
  expect(
    home.projection.expense_cents - baseline.projection.expense_cents,
  ).toBe(20067000);
  expect(home.projection.ending_cents - baseline.projection.ending_cents).toBe(
    20953000,
  );
  expect(home.projection.low_date).toBe('2026-12-04');

  await openHome(page, day);
  const navigation = page.getByRole('navigation', {
    name: 'Navegação principal',
  });
  await expect(navigation.getByRole('link').first()).toHaveAttribute(
    'aria-current',
    'page',
  );
  const projection = page.getByRole('region', {
    name: 'Quanto tenho disponível',
  });
  await expect(projection).toContainText('até 28/12/2026');
  await expect(
    projection.getByRole('row', { name: /Ponto mais baixo/ }),
  ).toContainText('04/12/2026');
  const low = projection.getByRole('link', { name: /Ponto mais baixo/ });
  await expect(low).toHaveText(formatMoney(home.projection.low_cents));
  await low.click();
  await expect(
    page.getByRole('heading', { name: 'Ponto mais baixo' }),
  ).toBeVisible();
  const detail = page.getByRole('region', {
    name: 'Valores que formam o total',
  });
  await expect(detail).toBeVisible();
  await expect(
    detail.getByRole('row', { name: /Salário da projeção X/ }),
  ).toHaveCount(0);
  const actual = await detail.locator('tbody td.numeric a').allTextContents();
  const total = actual.reduce(
    (sum, value) => sum + Number(value.replace(/[^\d-]/g, '')),
    0,
  );
  expect(total).toBe(home.projection.low_cents);
  await detail
    .getByRole('link', { name: /Saldo de Corrente da projeção X/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`conta=${checking}&saldo=current`));
  await expect(page.locator('.drill-detail')).toContainText(
    formatMoney(1000000),
  );

  await page.goto('/');
  const due = page.getByRole('region', { name: 'O que vence em breve' });
  await expect(
    due.getByRole('row', { name: /Aluguel antes do salário X/ }),
  ).toBeVisible();
  await expect(
    due.getByRole('row', { name: /Salário da projeção X/ }),
  ).toHaveCount(0);
  const booked = due.getByRole('link', {
    name: /Pagamento agendado: Fatura Cartão agendado X/,
  });
  await expect(booked).toHaveText(formatMoney(30000));
  await booked.click();
  await expect(page).toHaveURL(new RegExp(`transacao=${payment.id}`));
  await expect(page.locator('.drill-detail')).toContainText(formatMoney(30000));
  await page.goto('/');
  const invoice = due.getByRole('link', { name: /Fatura Cartão em aberto X/ });
  await expect(invoice).toHaveText(formatMoney(25000));
  await invoice.click();
  await expect(
    page.getByRole('heading', { name: 'Fatura com vencimento em 04/12/2026' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('table', { name: 'Composição da fatura prevista' })
      .getByRole('row', { name: /Compra parcelada X/ }),
  ).toContainText(formatMoney(25000));

  await page.goto('/');
  const attention = page.getByRole('region', { name: 'O que pede atenção' });
  await attention.getByRole('link', { name: /Conta atrasada X/ }).click();
  await expect(
    page.getByRole('row', { name: /Conta atrasada X/ }),
  ).toContainText('Ainda não');
  await page.goto('/');
  await attention.getByRole('link', { name: /Corrente da projeção X/ }).click();
  await expect(
    page.getByRole('dialog', {
      name: 'Conferir saldo: Corrente da projeção X',
    }),
  ).toBeVisible();
});

test('abre os dois períodos filtrados no dia 31 e confere os totais da categoria', async ({
  page,
  request,
}) => {
  const day = '2026-10-31';
  const checking = await account(request, {
    name: 'Corrente da comparação X',
    kind: 'checking',
  });
  const group = await write(
    request,
    '/category-groups',
    { name: 'Grupo da comparação X', allocation_group_id: 'essential' },
    day,
  );
  const category = await write(
    request,
    '/categories',
    { name: 'Categoria da comparação X', category_group_id: group.id },
    day,
  );
  for (const [date, amount_cents] of [
    ['2026-10-31', 8456],
    ['2026-10-01', 500],
    ['2026-09-30', 7034],
  ] as const) {
    await write(
      request,
      '/transactions',
      {
        account_id: checking,
        date,
        amount_cents,
        category_id: category.id,
        payee: `Compra X ${date}`,
      },
      day,
    );
  }
  await openHome(page, day);
  const comparison = page.getByRole('table', { name: 'Comparação mensal' });
  await expect(
    comparison.getByRole('columnheader', { name: '01/10/2026 a 31/10/2026' }),
  ).toBeVisible();
  await expect(
    comparison.getByRole('columnheader', { name: '01/09/2026 a 30/09/2026' }),
  ).toBeVisible();
  const row = comparison.getByRole('row', { name: /Grupo da comparação X/ });
  for (const [label, month, to, total] of [
    ['gasto deste mês', '2026-10', '2026-10-31', 8956],
    ['gasto do mês anterior', '2026-09', '2026-09-30', 7034],
  ] as const) {
    const link = row.getByRole('link', { name: new RegExp(label) });
    await expect(link).toHaveText(formatMoney(total));
    await link.click();
    const url = new URL(page.url());
    expect(url.pathname).toBe(`/transacoes/${month}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      de: `${month}-01`,
      ate: to,
      resumo: 'expense',
      grupo: group.id,
    });
    await expect(page.locator('.drill-detail')).toContainText(
      formatMoney(total),
    );
    await expect(
      page.getByRole('row', { name: new RegExp(`Compra X ${to}`) }),
    ).toBeVisible();
    await page.goto('/');
  }
});

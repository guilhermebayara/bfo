import { test, expect } from '@playwright/test';
import { freezeToday } from './helpers';

test.beforeEach(async ({ page }) => {
  await freezeToday(page);
});

async function newCard(request: any) {
  const r = await request.post('/api/accounts', {
    data: {
      name: 'Cartão Browser P ' + crypto.randomUUID(),
      kind: 'credit_card',
      currency: 'BRL',
      institution_id: 'horizonte',
      closing_day: 20,
      due_day: 27,
      credit_limit_cents: 300000,
    },
  });
  expect(r.status()).toBe(201);
  return (await r.json()).id as string;
}

test('P01 célula de parcelas na linha de cartão com prévia acima de 1x', async ({
  page,
  request,
}) => {
  // decisoes.md: célula de parcelas; parcela atual e prévia
  const card = await newCard(request);
  await page.goto('/transacoes/2026-11');
  await page.getByLabel('Escolher conta para adicionar').selectOption(card);
  const row = page.locator('tr[data-new-transaction]');
  await row.getByLabel('Data', { exact: true }).fill('2026-11-20');
  await row.getByLabel('Beneficiário', { exact: true }).fill('Parcelado QA P01');
  await row.getByLabel('Valor (BRL)', { exact: true }).fill('60,00');
  await row.getByLabel('Parcelas do novo lançamento').click();
  await row.getByLabel('Total de parcelas').fill('6');
  await expect(page.getByLabel('Prévia das parcelas')).toBeVisible();
  await expect(page.getByLabel('Parcela atual')).toBeVisible();
});

test('P05 mover compra para fatura seguinte pelo menu', async ({
  page,
  request,
}) => {
  // decisoes.md: mover para fatura anterior ou seguinte
  const card = await newCard(request);
  const created = await request.post('/api/transactions', {
    data: {
      account_id: card,
      date: '2026-11-20',
      amount_cents: 12000,
      payee: 'Mover browser P05',
      installment_count: 3,
      category_id: 'groceries',
    },
  });
  expect(created.status()).toBe(201);
  const body = await created.json();
  const plan = await (
    await request.get(`/api/installment-plans/${body.installment_plan_id}`)
  ).json();
  const first = plan.installments[0];
  await page.goto(`/transacoes/2026-11?account=${card}`);
  const row = page.locator(`tr[data-transaction-id="${first.id}"]`);
  await expect(row).toBeVisible();
  await row.getByLabel(`Ações de Mover browser P05`).click();
  await row.getByRole('button', { name: 'Mover de fatura', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Fatura de destino').selectOption('next');
  await page.getByRole('button', { name: 'Mover compra', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect
    .poll(async () => {
      const again = await (
        await request.get(`/api/installment-plans/${body.installment_plan_id}`)
      ).json();
      return again.installments[0].statement_id;
    })
    .not.toBe(first.statement_id);
});

test('P06 antecipação com valor cheio, cobrado e desconto', async ({
  page,
  request,
}) => {
  // decisoes.md: antecipação — valor cheio, cobrado, desconto no histórico
  const card = await newCard(request);
  const created = await request.post('/api/transactions', {
    data: {
      account_id: card,
      date: '2026-11-20',
      amount_cents: 50000,
      payee: 'Antecipar browser P06',
      installment_count: 5,
      category_id: 'groceries',
    },
  });
  const body = await created.json();
  await page.goto(`/parceladas/${body.installment_plan_id}`);
  await page.getByLabel('Quantidade de parcelas a antecipar').fill('2');
  await expect(page.getByText(/São antecipadas|valor cheio|200,00/i).first()).toBeVisible();
  await page
    .getByLabel('Valor cobrado pelo banco (BRL)', { exact: true })
    .fill('180,00');
  await page.getByRole('button', { name: 'Registrar antecipação' }).click();
  await expect(
    page.getByRole('table', { name: 'Histórico de antecipações' }),
  ).toContainText('180,00');
});

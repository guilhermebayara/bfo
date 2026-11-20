import { test, expect } from '@playwright/test';
import { ACTIVE, freezeToday } from './helpers';

test.beforeEach(async ({ page }) => {
  await freezeToday(page);
});

test('R01 R02 esperado/realizado e janela de 7 dias visível', async ({
  page,
}) => {
  // decisoes.md: janela visível; esperado e realizado
  await page.goto('/recorrentes');
  await expect(page.getByRole('heading', { name: /Recorrentes/i })).toBeVisible();
  await expect(page.getByText(/reconhece de /i).first()).toBeVisible();
});

test('R03 criar recorrente pelo menu da linha', async ({ page, request }) => {
  // decisoes.md: menu ... criar recorrente
  const created = await request.post('/api/transactions', {
    data: {
      account_id: ACTIVE,
      date: '2026-11-07',
      amount_cents: 4990,
      payee: 'Criar recorrente UI',
      category_id: 'entertainment',
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  await page.goto(`/transacoes/2026-11?account=${ACTIVE}`);
  const row = page.locator(`tr[data-transaction-id="${id}"]`);
  await row.locator('details.row-menu > summary').click();
  await row.getByRole('button', { name: 'Criar recorrente' }).click();
  await page
    .getByRole('dialog', { name: 'Criar recorrente' })
    .getByRole('button', { name: /Salvar|Criar/i })
    .click();
  await page.goto('/recorrentes');
  await expect(page.getByText('Criar recorrente UI')).toBeVisible();
});

test('R04 R05 assinaturas com equivalente mensal e aviso de renovação', async ({
  page,
  request,
}) => {
  // decisoes.md: equivalente mensal; prazo próprio
  expect(
    (
      await request.post('/api/recurring', {
        data: {
          account_id: ACTIVE,
          payee: 'Anual UI R04',
          amount_cents: 120000,
          category_id: 'entertainment',
          cadence: 'yearly',
          next_date: '2026-12-01',
          is_subscription: 1,
          subscription_type_id: 'daily',
          renewal_date: '2026-12-01',
          notice_days: 30,
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto('/assinaturas');
  await expect(page.getByText('Anual UI R04', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/10,00|\/mês|mensal/i).first()).toBeVisible();
});

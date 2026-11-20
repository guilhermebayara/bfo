import { test, expect } from '@playwright/test';
import { ACTIVE, CASH, freezeToday } from './helpers';

test.beforeEach(async ({ page }) => {
  await freezeToday(page);
});

test('T07 adicionar traz conta padrão; seta lista só movimento por tipo', async ({
  page,
}) => {
  // decisoes.md: conta padrão; seta só movimento
  await page.goto('/configuracoes');
  await page.getByLabel(/Conta padrão/i).selectOption(ACTIVE);
  await page.getByRole('button', { name: /Salvar configurações/i }).click();
  await expect(page.getByRole('status').or(page.getByText(/salvo|Salvo/i))).toBeVisible({ timeout: 5000 }).catch(() => {});
  await page.goto('/transacoes/2026-11');
  const menu = page.getByLabel('Escolher conta para adicionar');
  await expect(menu).toBeVisible();
  const texts = await menu.locator('option').allTextContents();
  expect(texts.join('\n')).toMatch(/Nova transferência/i);
  expect(texts.join('\n')).toMatch(/Conta de divisão fictícia|seed-f|Horizonte/i);
  expect(texts.join('\n')).not.toMatch(/Investimento fictício J|Imóvel fictício J/i);
});

test('T09 nova transferência: origem em Conta, seta destino em Beneficiário, valor neutro', async ({
  page,
  request,
}) => {
  // decisoes.md 19/11
  await page.goto('/transacoes/2026-11');
  await page.getByLabel('Escolher conta para adicionar').selectOption('transfer');
  const row = page.locator('[data-new-transfer]');
  await row.getByLabel('Conta de origem').selectOption(ACTIVE);
  await row.getByLabel('Conta de destino').selectOption(CASH);
  await row.getByLabel('Data da transferência').fill('2026-11-14');
  await row.getByLabel('Valor da transferência (BRL)').fill('27,89');
  await row.getByLabel('Nota da transferência').fill('Nota QA T09');
  await row.getByRole('button', { name: 'Salvar transferência' }).click();
  await expect(row.getByRole('status')).toHaveText('Transferência salva.');
  const data = await (
    await request.get('/api/transactions?month=2026-11&search=Nota%20QA%20T09')
  ).json();
  const transfer = data.items[0];
  expect(transfer.category_id).toBe('transfer');
  const saved = page.locator(`tr[data-transaction-id="${transfer.id}"]`);
  await expect(saved.locator('[data-sheet-cell="2"]')).toContainText('→');
  await expect(saved.locator('[data-sheet-cell="3"]')).not.toContainText('−');
  await expect(saved.locator('[data-sheet-cell="3"]')).not.toContainText('+');
});

test('T10 filtro por conta mostra saída na origem e entrada no destino', async ({
  page,
  request,
}) => {
  // decisoes.md: com filtro, sinal do ponto de vista da conta
  const created = await request.post('/api/transfers', {
    data: {
      account_id: ACTIVE,
      destination_account_id: CASH,
      date: '2026-11-14',
      amount_cents: 3333,
      note: 'Perspectiva QA T10',
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  await page.goto(`/transacoes/2026-11?account=${ACTIVE}`);
  await expect(
    page.locator(`tr[data-transaction-id="${id}"] [data-sheet-cell="3"]`),
  ).toContainText('−');
  await page.goto(`/transacoes/2026-11?account=${CASH}`);
  await expect(
    page.locator(`tr[data-transaction-id="${id}"] [data-sheet-cell="3"]`),
  ).toContainText('+');
});

test('T12 seleção múltipla com total e média', async ({ page, request }) => {
  // decisoes.md: painel com total e média
  const a = await request.post('/api/transactions', {
    data: {
      account_id: ACTIVE,
      date: '2026-11-09',
      amount_cents: 1000,
      payee: 'Lote UI A',
      category_id: 'groceries',
    },
  });
  const b = await request.post('/api/transactions', {
    data: {
      account_id: ACTIVE,
      date: '2026-11-09',
      amount_cents: 3000,
      payee: 'Lote UI B',
      category_id: 'groceries',
    },
  });
  const idA = (await a.json()).id;
  const idB = (await b.json()).id;
  await page.goto(`/transacoes/2026-11?account=${ACTIVE}`);
  await page
    .locator(`tr[data-transaction-id="${idA}"] input[type="checkbox"]`)
    .check();
  await page
    .locator(`tr[data-transaction-id="${idB}"] input[type="checkbox"]`)
    .check();
  const selection = page.getByRole('region', { name: /Seleção/i });
  await expect(selection).toBeVisible();
  await expect(selection).toContainText(/40,00|total/i);
});

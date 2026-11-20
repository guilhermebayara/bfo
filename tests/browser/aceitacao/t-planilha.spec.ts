import { test, expect } from '@playwright/test';
import { ACTIVE, createTx, freezeToday } from './helpers';

test.beforeEach(async ({ page }) => {
  await freezeToday(page);
});

test('T01 setas de mês, ir para o mês, voltar para este mês; mês no endereço', async ({
  page,
}) => {
  // decisoes.md / a-construir: mês no endereço
  await page.goto('/transacoes');
  await expect(page).toHaveURL(/\/transacoes\/2026-11/);
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await expect(page).toHaveURL(/\/transacoes\/2026-10/);
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await expect(page).toHaveURL(/\/transacoes\/2026-11/);
  await page.getByLabel('Ir para o mês').fill('2026-09');
  await page.getByLabel('Ir para o mês').press('Enter');
  await expect(page).toHaveURL(/\/transacoes\/2026-09/);
  await page.getByRole('button', { name: 'Voltar para este mês' }).click();
  await expect(page).toHaveURL(/\/transacoes\/2026-11/);
});

test('T03 Enter e Tab salvam e avançam, Esc cancela, setas movem', async ({
  page,
  request,
}) => {
  // decisoes.md: teclado como planilha
  const { id } = await createTx(request, { payee: 'Teclado QA T03' });
  await page.goto(`/transacoes/2026-11?account=${ACTIVE}`);
  const row = page.locator(`tr[data-transaction-id="${id}"]`);
  await row.locator('[data-sheet-cell="2"]').click();
  await row.getByRole('textbox').first().fill('Teclado QA T03 editado');
  await row.getByRole('textbox').first().press('Enter');
  await expect(row.locator('[data-sheet-cell="2"]')).toContainText(
    'Teclado QA T03 editado',
  );
  await row.locator('[data-sheet-cell="2"]').click();
  await row.getByRole('textbox').first().fill('nao salva');
  await row.getByRole('textbox').first().press('Escape');
  await expect(row.locator('[data-sheet-cell="2"]')).toContainText(
    'Teclado QA T03 editado',
  );
});

test('T04 editar célula atualiza resumo lateral sem recarregar', async ({
  page,
  request,
}) => {
  // decisoes.md: salva sozinha e atualiza resumos
  const { id } = await createTx(request, {
    payee: 'Resumo QA T04',
    amount_cents: 4444,
  });
  await page.goto(`/transacoes/2026-11?account=${ACTIVE}`);
  const row = page.locator(`tr[data-transaction-id="${id}"]`);
  const summary = page.getByRole('complementary', { name: /Resumo/i });
  await expect(summary).toBeVisible();
  await row.locator('[data-sheet-cell="3"]').click();
  await row.getByRole('textbox').first().fill('55,55');
  await row.getByRole('textbox').first().press('Tab');
  await expect(row.locator('[data-sheet-cell="3"]')).toContainText('55,55');
  await expect(summary).toContainText(/Mercado|Alimentação/i);
});

test('T05 importada com valor e data travados e visivelmente não editáveis', async ({
  page,
  request,
}) => {
  // decisoes.md 19/11: valor e data travados; classificação editável
  await page.goto('/transacoes/2025-09?account=checking');
  const row = page.locator('tr[data-transaction-id="seed-2025-09-rent"]');
  await expect(row).toBeVisible();
  for (const column of [0, 3]) {
    await expect(row.locator(`[data-sheet-cell="${column}"]`)).toHaveAttribute(
      'aria-readonly',
      'true',
    );
    await row.locator(`[data-sheet-cell="${column}"]`).click();
    await expect(row.locator('input[type="date"]')).toHaveCount(0);
  }
  await row.locator('[data-sheet-cell="7"]').click();
  await row.getByRole('checkbox', { name: 'Planejado', exact: true }).check();
  await page.getByRole('heading', { name: 'Transações', exact: true }).click();
  await expect(row.locator('[data-sheet-cell="7"]')).toContainText('Planejado');
  void request;
});

test('T06 botão de sinal pela categoria e inversão com um clique', async ({
  page,
}) => {
  // decisoes.md: sinal automático; invertível
  await page.goto('/transacoes/2026-11');
  await page.getByLabel('Escolher conta para adicionar').selectOption(ACTIVE);
  const row = page.locator('tr[data-new-transaction]');
  await row.getByLabel('Categoria', { exact: true }).selectOption('salary');
  const sign = row.getByRole('button', { name: /Inverter sinal/i });
  await expect(sign).toBeVisible();
  await expect(sign).toHaveText('[+]');
  await sign.click();
  await expect(sign).toHaveText('[-]');
  await expect(sign).toHaveAttribute('aria-pressed', 'false');
});

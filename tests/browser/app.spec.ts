import { test, expect } from '@playwright/test';
test('filtra transações, edita uma importada e mantém os dados após recarregar', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/transacoes');
  await expect(
    page.getByRole('heading', { name: 'Transações', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Conta', exact: true })
    .selectOption('checking');
  await page
    .getByRole('combobox', { name: 'Origem', exact: true })
    .selectOption('imported');
  await page.getByLabel('Data inicial').fill('2025-09-01');
  await page.getByLabel('Data final').fill('2025-09-30');
  await expect(
    page.getByText('2 transações ·', { exact: false }),
  ).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'Renda fictícia' });
  await expect(row.getByText('Entrada (+)')).toBeVisible();
  await row.getByRole('combobox').selectOption('groceries');
  await row.getByRole('textbox').fill('Nota conferida no navegador');
  await row.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(row.getByRole('status')).toHaveText('Salvo.');
  await page.reload();
  await page.getByLabel('Data inicial').fill('2025-09-01');
  await page.getByLabel('Data final').fill('2025-09-30');
  await page
    .getByRole('combobox', { name: 'Conta', exact: true })
    .selectOption('checking');
  await page
    .getByRole('combobox', { name: 'Origem', exact: true })
    .selectOption('imported');
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Renda fictícia' })
      .first()
      .getByRole('textbox'),
  ).toHaveValue('Nota conferida no navegador');
  await page
    .getByRole('combobox', { name: 'Categoria', exact: true })
    .selectOption('groceries');
  await expect(
    page.getByText('1 transações ·', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  expect(errors).toEqual([]);
});
test('prévia, correção e confirmação de ativação com ajuste visível', async ({
  page,
  request,
}) => {
  await page.goto('/contas');
  const row = page.getByRole('row').filter({ hasText: 'Carteira' });
  await expect(row).toContainText('Só arquivo');
  await row.getByRole('button', { name: 'Ativar conta' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Data de corte').fill('2026-10-31');
  await modal.getByLabel('Saldo de abertura (R$)').fill('100,00');
  await modal.getByRole('button', { name: 'Ver prévia' }).click();
  await expect(modal.getByText('Conferir antes de ativar')).toBeVisible();
  await modal.getByLabel('Saldo de abertura (R$)').fill('150,00');
  await expect(
    modal.getByRole('button', { name: 'Confirmar ativação' }),
  ).toHaveCount(0);
  await modal.getByRole('button', { name: 'Ver prévia' }).click();
  await modal.getByRole('button', { name: 'Confirmar ativação' }).click();
  await expect(modal).toHaveCount(0);
  await expect(row).toContainText('Ativa desde 31/10/2026');
  await expect(row).toContainText('150,00');
  await page.reload();
  await expect(row).toContainText('Ativa desde 31/10/2026');
  await page.getByRole('link', { name: 'Transações', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Conta', exact: true })
    .selectOption('cash');
  await page
    .getByRole('combobox', { name: 'Origem', exact: true })
    .selectOption('adjustment');
  await expect(
    page.getByRole('row').filter({ hasText: 'Ajuste de abertura' }),
  ).toBeVisible();
  const response = await request.get('/api/accounts');
  const accounts = await response.json();
  expect(
    accounts.find((a: { id: string }) => a.id === 'cash').balance_cents,
  ).toBe(15000);
});
test('modal cancela sem ativar e interface cabe em tela pequena', async ({
  page,
}) => {
  await page.goto('/contas');
  const row = page.getByRole('row').filter({ hasText: 'Conta Horizonte' });
  await row.getByRole('button', { name: 'Ativar conta' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row).toContainText('Só arquivo');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/transacoes');
  await expect(
    page.getByRole('heading', { name: 'Transações', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('reclassificação retira a linha do filtro de categoria atual', async ({
  page,
}) => {
  await page.goto('/transacoes');
  await page
    .getByRole('combobox', { name: 'Categoria', exact: true })
    .selectOption('restaurant');
  await expect(
    page.getByText('14 transações ·', { exact: false }),
  ).toBeVisible();
  const row = page
    .getByRole('row')
    .filter({ hasText: 'Cozinha da Praça' })
    .first();
  await row.getByRole('combobox').selectOption('entertainment');
  await row.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(
    page.getByText('13 transações ·', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Cozinha da Praça' }),
  ).toHaveCount(13);
});

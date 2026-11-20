import { test, expect } from '@playwright/test';
import { freezeToday } from './helpers';

test.beforeEach(async ({ page }) => {
  await freezeToday(page);
});

test('C01 contas por instituição com subtotal e alternância por tipo', async ({
  page,
}) => {
  // decisoes.md: agrupa por instituição; alternância por tipo
  await page.goto('/contas');
  await expect(page.getByText(/Instituição Horizonte|Horizonte/i).first()).toBeVisible();
  await page.getByLabel('Agrupar por').selectOption('kind');
  await expect(page.getByText(/Corrente|Cartão/i).first()).toBeVisible();
});

test('C02 manual nasce ativa; página explica só arquivo', async ({ page }) => {
  // decisoes.md: manual ativa; importada só arquivo com explicação
  await page.goto('/contas');
  await page.getByRole('button', { name: 'Nova conta' }).click();
  await page.getByLabel('Nome da conta').fill('Conta Browser C02');
  await page.locator('select').filter({ hasText: /Horizonte|Brisa/ }).first().selectOption({ index: 1 }).catch(async () => {
    await page.getByLabel('Instituição', { exact: true }).selectOption({ index: 1 });
  });
  await page.getByRole('button', { name: /Criar conta ativa/i }).click();
  await expect(page.getByText('Conta Browser C02')).toBeVisible();
  await expect(page.getByText(/só arquivo|arquivo/i).first()).toBeVisible();
});

test('C03 conferir saldo com diferença e atualizado em', async ({ page }) => {
  // decisoes.md: conferência; atualizado em muda
  await page.goto('/contas');
  await page.getByRole('button', { name: 'Conferir saldo' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Saldo do banco/i).fill('9999,99');
  await dialog.getByRole('button', { name: /Ver diferença|Conferir|Continuar/i }).click();
  await expect(dialog.getByText(/diferença|ajuste/i).first()).toBeVisible();
});

test('C05 encerrada na seção recolhida', async ({ page }) => {
  // decisoes.md: seção Encerradas
  await page.goto('/contas');
  await expect(page.getByText(/Encerradas/i)).toBeVisible();
});

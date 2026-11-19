import { test, expect } from '@playwright/test';

test('abre o parcelamento original e paga uma fatura em uma linha', async ({
  page,
  request,
}) => {
  const source = await request.post('/api/accounts', {
    data: {
      name: 'Corrente para fatura',
      kind: 'checking',
      currency: 'BRL',
      institution_id: 'horizonte',
      opening_balance_cents: 100000,
    },
  });
  expect(source.status()).toBe(201);
  const { id } = await source.json();

  await page.goto('/transacoes/2026-08?account=card-a');
  const row = page
    .locator('tr[data-transaction-id]')
    .filter({ hasText: 'Mesa de trabalho' });
  await expect(row).toContainText('3/12');
  await row.locator('details.row-menu > summary').click();
  await row.getByRole('link', { name: 'Ver compra original' }).click();
  await expect(
    page.getByRole('heading', { name: 'Compra parcelada' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Mesa de trabalho' }),
  ).toBeVisible();
  await page.getByRole('link', { name: '27/10/2026' }).click();
  await expect(
    page.getByRole('heading', { name: 'Fatura com vencimento em 27/10/2026' }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Histórico de conferência' }),
  ).toContainText('14,20');
  await page.getByRole('button', { name: 'Pagar fatura' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Conta corrente').selectOption(id);
  await modal.getByRole('button', { name: 'Registrar pagamento' }).click();
  await expect(modal).toHaveCount(0);
  await expect(
    page
      .getByRole('table', { name: 'Faturas anteriores' })
      .getByRole('row')
      .filter({ hasText: '20/10/2026' }),
  ).toContainText('Paga');
  await page.goto(`/transacoes?account=${id}`);
  const payment = page
    .getByRole('row')
    .filter({ hasText: 'Fatura Cartão Aurora outubro' });
  await expect(payment).toHaveCount(1);
  await expect(payment).toContainText('Sem categoria');
});

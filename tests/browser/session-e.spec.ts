import { test, expect } from '@playwright/test';
import { currentMonth } from '../../src/shared/recurring';
test('mês no endereço, setas, escolha, recarga, histórico e filtros dentro do mês', async ({
  page,
}) => {
  await page.goto('/transacoes');
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await expect(page).toHaveURL(`/transacoes/${currentMonth()}`);
  await page.getByLabel('Ir para o mês').fill('2026-11');
  await page
    .getByRole('region', { name: 'Filtros de transações' })
    .getByRole('combobox', { name: 'Conta', exact: true })
    .selectOption('seed-recurring-account');
  await expect(
    page.getByText('2 transações ·', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
  await expect(page).toHaveURL('/transacoes/2026-12');
  await expect(
    page.getByText('0 transações ·', { exact: false }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/transacoes/2026-11');
  await expect(
    page.getByText('2 transações ·', { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Ir para o mês')).toHaveValue('2026-11');
  await page.getByRole('button', { name: 'Mês anterior', exact: true }).click();
  await expect(page).toHaveURL('/transacoes/2026-10');
  await page.getByRole('button', { name: 'Voltar para este mês' }).click();
  await expect(page).toHaveURL(`/transacoes/${currentMonth()}`);
});
test('Enter lança pela linha, prepara o próximo e edita campos na linha', async ({
  page,
  request,
}) => {
  await page.goto('/transacoes/2026-11');
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await page.getByRole('button', { name: /^Adicionar em / }).click();
  const form = page.locator('tr[data-new-transaction]');
  await form
    .getByRole('combobox', { name: 'Conta do novo lançamento', exact: true })
    .selectOption('seed-recurring-account');
  await form.getByLabel('Data', { exact: true }).fill('2026-11-19');
  await form
    .getByLabel('Beneficiário', { exact: true })
    .fill('Lançamento fictício E');
  await form.getByLabel('Valor (BRL)', { exact: true }).fill('23,45');
  await form.getByLabel('Valor (BRL)', { exact: true }).press('Enter');
  await expect(form.getByRole('status').last()).toHaveText('Lançamento salvo.');
  await expect(form.getByLabel('Beneficiário', { exact: true })).toHaveValue(
    '',
  );
  await expect(form.getByLabel('Valor (BRL)', { exact: true })).toHaveValue('');
  await expect(form.getByLabel('Beneficiário', { exact: true })).toBeFocused();
  const rowId = await page
    .getByRole('row')
    .filter({ hasText: 'Lançamento fictício E' })
    .getAttribute('data-transaction-id');
  const row = page.locator(`tr[data-transaction-id="${rowId}"]`);
  await row.locator('[data-sheet-cell="3"]').click();
  await row.getByLabel('Valor (BRL)').fill('25,99');
  await row.getByLabel('Valor (BRL)').press('Tab');
  await expect(row).toContainText('25,99');
  await row.locator('[data-sheet-cell="6"]').click();
  await row.getByRole('textbox',{name:'Nota de Lançamento fictício E',exact:true}).fill('Nota nova');
  await row.getByRole('textbox',{name:'Nota de Lançamento fictício E',exact:true}).press('Tab');
  await expect(row).toContainText('Nota nova');
  await row.locator('[data-sheet-cell="2"]').click();
  await row
    .getByRole('textbox', {
      name: 'Beneficiário de Lançamento fictício E',
      exact: true,
    })
    .fill('Beneficiário corrigido E');
  await row
    .getByRole('textbox', {
      name: 'Beneficiário de Lançamento fictício E',
      exact: true,
    })
    .press('Tab');
  await expect(
    page.getByRole('row').filter({ hasText: 'Beneficiário corrigido E' }),
  ).toContainText('25,99');
  const data = await (
    await request.get(
      '/api/transactions?month=2026-11&account=seed-recurring-account',
    )
  ).json();
  expect(
    data.items.find(
      (t: { payee: string }) => t.payee === 'Beneficiário corrigido E',
    ),
  ).toMatchObject({ amount_cents: 2599, note: 'Nota nova' });
});
test('recorrentes têm estado mensal, criação pela transação e assinatura com tipo editável', async ({
  page,
}) => {
  await page.goto('/recorrentes');
  await page.getByLabel('Ir para o mês').fill('2026-11');
  await expect(
    page.getByRole('row').filter({ hasText: 'Nuvem fictícia' }),
  ).toContainText('Chegou');
  await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'Nuvem fictícia' }),
  ).toContainText('Ainda não');
  await expect(
    page.getByRole('row').filter({ hasText: 'Ferramenta anual fictícia' }),
  ).toContainText('359,90');
  await page.goto('/transacoes/2026-11');
  await page.getByRole('button', { name: /^Filtros/ }).click();
  const row = page.getByRole('row').filter({ hasText: 'Nuvem fictícia' });
  await row.locator('details.row-menu > summary').click();
  await row.getByRole('button', { name: 'Criar recorrente' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByLabel('Beneficiário', { exact: true })).toHaveValue(
    'Nuvem fictícia',
  );
  await modal
    .getByLabel('Beneficiário', { exact: true })
    .fill('Assinatura criada E');
  await modal.getByLabel('Assinatura', { exact: true }).check();
  await modal
    .getByRole('combobox', { name: 'Tipo de assinatura', exact: true })
    .selectOption('daily');
  await modal.getByLabel('Data de renovação').fill('2026-11-28');
  await modal.getByRole('button', { name: 'Salvar recorrente' }).click();
  await expect(modal).toHaveCount(0);
  await page.goto('/assinaturas');
  await expect(
    page.getByRole('row').filter({ hasText: 'Assinatura criada E' }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Agrupar por' })
    .selectOption('allocation_name');
  await expect(
    page.getByRole('heading', { name: 'Estilo de vida', exact: true }),
  ).toBeVisible();
  await page.goto('/tipos-assinatura');
  await page.getByLabel('Nome', { exact: true }).fill('Tipo novo fictício E');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'Tipo novo fictício E', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Editar Tipo novo fictício E' })
    .click();
  await page.getByLabel('Nome', { exact: true }).fill('Tipo corrigido E');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(
    page.getByRole('cell', { name: 'Tipo corrigido E', exact: true }),
  ).toBeVisible();
});
test('equivalente mensal e aviso de renovação no topo de qualquer tela', async ({
  page,
  request,
}) => {
  const day = new Date().toISOString().slice(0, 10);
  await request.post('/api/recurring', {
    data: {
      account_id: 'seed-recurring-account',
      payee: 'Aviso fictício E',
      amount_cents: 12000,
      cadence: 'yearly',
      next_date: day,
      is_subscription: 1,
      subscription_type_id: 'daily',
      renewal_date: day,
    },
  });
  await page.goto('/assinaturas');
  await expect(
    page.getByRole('row').filter({ hasText: 'Aviso fictício E' }),
  ).toContainText('Equivalente mensal: R$ 10,00');
  await expect(page.getByLabel('Aviso de renovação')).toContainText(
    'Aviso fictício E',
  );
  await page.getByRole('link', { name: 'Contas', exact: true }).click();
  await expect(page.getByLabel('Aviso de renovação')).toContainText(
    'Aviso fictício E',
  );
});

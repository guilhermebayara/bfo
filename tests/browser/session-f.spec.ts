import { test, expect } from '@playwright/test';
import { today } from '../../src/server/statements';
test('lança retroativa pela parcela atual e mostra recálculo da fatura fechada', async ({
  page,
}) => {
  await page.goto('/transacoes/2026-11');
  await page.getByText('Mais opções', { exact: true }).click();
  await page.getByRole('button', { name: 'Lançar compra parcelada' }).click();
  const form = page.getByRole('form', { name: 'Lançar transação' });
  await form
    .getByRole('combobox', { name: 'Conta', exact: true })
    .selectOption('seed-f-card');
  await form.getByLabel('Tipo de lançamento').selectOption('installment');
  await form.getByLabel('Total de parcelas').fill('10');
  await form.getByLabel('Parcela atual', { exact: true }).fill('3');
  await form
    .getByLabel('Data da parcela atual', { exact: true })
    .fill('2026-11-12');
  await form
    .getByLabel('Beneficiário', { exact: true })
    .fill('Retroativa do navegador');
  await form
    .getByLabel('Valor da parcela (BRL)', { exact: true })
    .fill('123,45');
  await expect(form).toContainText('1.234,50');
  await form.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(form.getByRole('status').last()).toHaveText('Lançamento salvo.');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Fechar', exact: true })
    .click();
  const row = page
    .getByRole('row')
    .filter({ hasText: 'Retroativa do navegador' });
  await row.locator('details.row-menu > summary').click();
  await row.getByRole('link', { name: 'Ver compra original' }).click();
  await expect(
    page.getByRole('table', { name: 'Parcelas da compra' }).getByRole('row'),
  ).toHaveCount(11);
  await expect(
    page.getByRole('table', { name: 'Parcelas da compra' }),
  ).toContainText('Retroativa: antes do corte');
  await page.getByRole('link', { name: '27/10/2026', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Alterações após o fechamento' }),
  ).toContainText('223,46');
  await expect(
    page.getByRole('table', { name: 'Compras do ciclo' }),
  ).toContainText('Incluída após o fechamento');
});
test('antecipa pelo valor do banco e mostra desconto no histórico e custo real', async ({
  page,
}) => {
  await page.goto('/parceladas/seed-f-advance');
  await page.getByLabel('Quantidade de parcelas a antecipar').fill('1');
  await expect(
    page.getByText('São antecipadas as próximas', { exact: false }),
  ).toContainText('200,00');
  await page
    .getByLabel('Valor cobrado pelo banco (BRL)', { exact: true })
    .fill('190,00');
  await page.getByRole('button', { name: 'Registrar antecipação' }).click();
  await expect(
    page
      .getByRole('table', { name: 'Histórico de antecipações' })
      .getByRole('row'),
  ).toHaveCount(3);
  await expect(
    page.getByRole('table', { name: 'Histórico de antecipações' }),
  ).toContainText('190,00');
  await expect(page.getByText('Custo real:', { exact: false })).toContainText(
    '960,00',
  );
});
test('divide por valor e percentual com soma fechada e desfaz na interface', async ({
  page,
  request,
}) => {
  const created = await request.post('/api/transactions', {
    data: {
      account_id: 'seed-f-account',
      date: '2026-11-19',
      amount_cents: 10001,
      payee: 'Divisão no navegador',
    },
  });
  expect(created.status()).toBe(201);
  await page.goto('/transacoes/2026-11?account=seed-f-account');
  const row = page.getByRole('row').filter({ hasText: 'Divisão no navegador' });
  await row.locator('details.row-menu > summary').click();
  await row
    .getByRole('button', { name: 'Dividir transação', exact: true })
    .click();
  let modal = page.getByRole('dialog');
  await modal.getByLabel('Valor (BRL)', { exact: true }).nth(0).fill('60,00');
  await modal.getByLabel('Valor (BRL)', { exact: true }).nth(1).fill('40,00');
  await expect(
    modal.getByRole('button', { name: 'Salvar divisão' }),
  ).toBeDisabled();
  await expect(modal.getByRole('status')).toContainText('0,01');
  await modal.getByLabel('Valor (BRL)', { exact: true }).nth(1).fill('40,01');
  await modal
    .getByRole('combobox', { name: 'Categoria da parte 1', exact: true })
    .selectOption('groceries');
  await modal
    .getByLabel('Nota da parte 1', { exact: true })
    .fill('Nota própria');
  await modal
    .getByRole('group', { name: 'Tags da parte 2', exact: true })
    .getByLabel('Planejado')
    .check();
  await modal.getByRole('button', { name: 'Salvar divisão' }).click();
  await expect(modal).toHaveCount(0);
  const txid = (await created.json()).id;
  let parts = await (
    await request.get(`/api/transactions/${txid}/splits`)
  ).json();
  expect(parts[0].note).toBe('Nota própria');
  expect(parts[1].tags[0].name).toBe('Planejado');
  await expect(row).toContainText('Dividida em 2 partes');
  await row
    .getByRole('button', { name: 'Editar divisão', exact: true })
    .click();
  modal = page.getByRole('dialog');
  await modal.getByLabel('Dividir por').selectOption('percent');
  await modal
    .getByLabel('Percentual (%)', { exact: true })
    .nth(0)
    .fill('33,33');
  await modal
    .getByLabel('Percentual (%)', { exact: true })
    .nth(1)
    .fill('66,67');
  await modal.getByRole('button', { name: 'Salvar divisão' }).click();
  await expect(modal).toHaveCount(0);
  parts = await (await request.get(`/api/transactions/${txid}/splits`)).json();
  expect(parts.map((p: { amount_cents: number }) => p.amount_cents)).toEqual([
    3333, 6668,
  ]);
  await row
    .getByRole('button', { name: 'Editar divisão', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Desfazer divisão' })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    row.getByRole('button', { name: 'Dividir transação', exact: true }),
  ).toBeVisible();
  await expect(row).not.toContainText('Nota própria');
});
test('edita prazo de aviso e a faixa passa a incluir a assinatura', async ({
  page,
  request,
}) => {
  const d = today(),
    renew = new Date(Date.parse(d) + 31 * 86400000).toISOString().slice(0, 10);
  const created = await request.post('/api/recurring', {
    data: {
      account_id: 'seed-f-account',
      payee: 'Aviso próprio do navegador',
      amount_cents: 1000,
      cadence: 'yearly',
      next_date: d,
      is_subscription: 1,
      subscription_type_id: 'daily',
      renewal_date: renew,
    },
  });
  expect(created.status()).toBe(201);
  await page.goto('/assinaturas');
  await expect(
    page.getByRole('status', { name: 'Aviso de renovação' }),
  ).not.toContainText('Aviso próprio do navegador');
  await page
    .getByRole('button', { name: 'Editar Aviso próprio do navegador' })
    .click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByLabel('Prazo de aviso em dias')).toHaveValue('30');
  await modal.getByLabel('Prazo de aviso em dias').fill('45');
  await modal.getByRole('button', { name: 'Salvar recorrente' }).click();
  await expect(modal).toHaveCount(0);
  await expect(
    page.getByRole('status', { name: 'Aviso de renovação' }),
  ).toContainText('Aviso próprio do navegador');
  await expect(
    page.getByRole('status', { name: 'Aviso de renovação' }),
  ).toContainText('aviso com 45 dias');
  await page.reload();
  await expect(
    page.getByRole('status', { name: 'Aviso de renovação' }),
  ).toContainText('Aviso próprio do navegador');
});

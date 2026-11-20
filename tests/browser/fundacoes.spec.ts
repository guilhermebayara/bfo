import { expect, test } from './fixtures';

test('navegação indica a tela atual e mantém o contexto mensal no histórico', async ({
  page,
}) => {
  await page.goto('/transacoes/2026-11');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const current = nav.locator('[aria-current="page"]');
  await expect(current).toHaveText('Transações');
  await expect(
    page.getByRole('region', { name: 'Navegação por mês' }),
  ).toContainText('novembro de 2026');

  for (const [name, path] of [
    ['Contas', '/contas'],
    ['Cartão', '/cartao'],
    ['Próximos', '/proximos'],
    ['Recorrentes', '/recorrentes'],
    ['Configurações', '/configuracoes'],
  ]) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await expect(current).toHaveText(name);
  }

  await page.goBack();
  await expect(current).toHaveText('Recorrentes');
  await page.goto('/cartao?account=neon');
  await expect(current).toHaveText('Cartão');
  await page.goto('/parceladas/desk');
  await expect(current).toHaveText('Compra parcelada');
  await expect(
    page.getByRole('heading', { name: 'Mesa de trabalho' }),
  ).toBeVisible();
});

test('catálogo de fundações mostra tokens, componentes e estados e funciona por teclado', async ({
  page,
}) => {
  await page.goto('/contas');
  await page.getByRole('link', { name: 'Fundações', exact: true }).click();
  await expect(page).toHaveURL('/fundacoes');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Fundações' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fundações' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  for (const token of [
    '--gray-950',
    '--surface-raised',
    '--focus-ring',
    '--amount-transfer',
    '--text-number',
  ]) {
    await expect(page.getByText(token, { exact: true })).toBeVisible();
  }
  for (const state of ['Aberta', 'Fechada', 'Retroativa', 'Ajuste']) {
    await expect(page.getByText(state, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Nenhum lançamento encontrado.')).toBeVisible();
  await expect(page.getByRole('main').getByRole('status')).toContainText(
    'Carregando lançamentos…',
  );
  await expect(page.getByRole('alert')).toContainText(
    'Erro ao carregar lançamentos.',
  );

  const example = page.getByRole('table', { name: 'Tabela de exemplo' });
  const value = example.getByRole('cell', { name: 'R$ 126,90' });
  await expect(value).toHaveCSS('font-variant-numeric', 'tabular-nums');
  await expect(value).toHaveCSS('text-align', 'right');
  const longName = example.getByText(/^Loja fictícia com nome comprido/);
  await expect(longName).toHaveAttribute('title', await longName.innerText());

  const trigger = page.getByLabel('Mais ações do catálogo');
  await page.keyboard.press('Tab');
  await trigger.focus();
  await expect(trigger).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  const details = page.getByRole('button', { name: 'Ver detalhes' });
  await details.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('dialog', { name: 'Modal de exemplo' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page.getByRole('button', { name: 'Confirmar exemplo' }).click();
  await expect(page.getByText('Exemplo confirmado.')).toBeVisible();
});

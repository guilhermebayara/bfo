import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../src/server/index';
const db = env.DB as D1Database;
const FIXED = '2026-11-15T15:00:00.000Z';
const req = (path: string, method = 'GET', body?: object) =>
  app.request(
    `https://bfo.test/api${path}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-bfo-data': '2026-11-15',
      },
      body: body && JSON.stringify(body),
    },
    env,
  );
beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FIXED));
});
afterEach(() => {
  vi.useRealTimers();
});
afterAll(() => {
  vi.useRealTimers();
});
async function fixture() {
  await db.exec(
    `DELETE FROM transaction_tags WHERE tag_id LIKE 'd20-%';
     DELETE FROM payee_default_tags WHERE tag_id LIKE 'd20-%' OR payee_id IN (SELECT id FROM payees WHERE name LIKE '%fictícia 20' OR name LIKE '%fictício 20');
     DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE institution_id='d20-i');
     DELETE FROM accounts WHERE institution_id='d20-i';
     DELETE FROM payees WHERE name LIKE '%fictícia 20' OR name LIKE '%fictício 20';
     DELETE FROM tags WHERE id LIKE 'd20-%';
     DELETE FROM categories WHERE id LIKE 'd20-%';
     DELETE FROM category_groups WHERE id='d20-cg';
     DELETE FROM allocation_groups WHERE id='d20-g';
     DELETE FROM institutions WHERE id='d20-i';`,
  );
  await db
    .prepare(
      "INSERT INTO institutions(id,name) VALUES('d20-i','Instituição padrão fictícia')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO allocation_groups(id,name,target_percent,sort) VALUES('d20-g','Alocação padrão',0,0)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO category_groups(id,name,allocation_group_id,sort) VALUES('d20-cg','Grupo padrão','d20-g',0)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO categories(id,name,category_group_id,is_income,sort) VALUES('d20-mercado','Mercado padrão','d20-cg',0,0),('d20-casa','Casa padrão','d20-cg',0,1)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO tags(id,name,color) VALUES('d20-viagem','Viagem padrão','#112233'),('d20-casa-tag','Casa tag padrão','#445566')",
    )
    .run();
  const created = await req('/accounts', 'POST', {
    name: 'Conta padrão fictícia',
    kind: 'checking',
    currency: 'BRL',
    institution_id: 'd20-i',
    opening_balance_cents: 100000,
  });
  expect(created.status).toBe(201);
  return (await created.json()).id as string;
}
async function spend(
  account: string,
  payee: string,
  category: string,
  tags: string[],
  date = '2026-11-15',
) {
  const response = await req('/transactions', 'POST', {
    account_id: account,
    date,
    amount_cents: 1500,
    payee,
    category_id: category,
    tag_ids: tags,
  });
  expect(response.status).toBe(201);
}
it('sugere o padrão do beneficiário e, sem padrão, o último lançamento', async () => {
  const account = await fixture();
  await spend(account, 'Padaria fictícia 20', 'd20-mercado', ['d20-viagem']);
  expect(
    await (
      await req('/payees/suggestion?name=Padaria%20fict%C3%ADcia%2020')
    ).json(),
  ).toEqual({
    category_id: 'd20-mercado',
    tag_ids: ['d20-viagem'],
    source: 'last',
  });
  const payee = await db
    .prepare("SELECT id FROM payees WHERE name='Padaria fictícia 20'")
    .first<{ id: string }>();
  expect(
    (
      await req(`/payees/${payee!.id}`, 'PATCH', {
        category_id: 'd20-casa',
        tag_ids: ['d20-casa-tag'],
      })
    ).status,
  ).toBe(200);
  expect(
    await (
      await req('/payees/suggestion?name=padaria%20fict%C3%ADcia%2020')
    ).json(),
  ).toEqual({
    category_id: 'd20-casa',
    tag_ids: ['d20-casa-tag'],
    source: 'default',
  });
  await spend(account, 'Padaria fictícia 20', 'd20-mercado', ['d20-viagem']);
  expect(
    await (
      await req('/payees/suggestion?name=Padaria%20fict%C3%ADcia%2020')
    ).json(),
  ).toMatchObject({
    source: 'default',
    category_id: 'd20-casa',
  });
  expect(
    (
      await req(`/payees/${payee!.id}`, 'PATCH', {
        category_id: null,
        tag_ids: [],
      })
    ).status,
  ).toBe(200);
  const listed = (await (await req('/payees')).json()) as {
    name: string;
    has_default: number;
  }[];
  expect(listed.find((p) => p.name === 'Padaria fictícia 20')).toMatchObject({
    has_default: 0,
    default_category_id: null,
    default_tag_ids: [],
  });
  expect(
    await (
      await req('/payees/suggestion?name=Padaria%20fict%C3%ADcia%2020')
    ).json(),
  ).toEqual({
    category_id: 'd20-mercado',
    tag_ids: ['d20-viagem'],
    source: 'last',
  });
});
it('na unificação permanece o padrão do destino', async () => {
  const account = await fixture();
  await spend(account, 'Nome origem fictício 20', 'd20-mercado', [
    'd20-viagem',
  ]);
  await spend(account, 'Nome destino fictício 20', 'd20-casa', [
    'd20-casa-tag',
  ]);
  const rows = (
    await db
      .prepare('SELECT id,name FROM payees')
      .all<{ id: string; name: string }>()
  ).results;
  const source = rows.find((p) => p.name === 'Nome origem fictício 20')!;
  const target = rows.find((p) => p.name === 'Nome destino fictício 20')!;
  expect(
    (
      await req(`/payees/${source.id}`, 'PATCH', {
        category_id: 'd20-mercado',
        tag_ids: ['d20-viagem'],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req(`/payees/${target.id}`, 'PATCH', {
        category_id: 'd20-casa',
        tag_ids: [],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req('/payees/merge', 'POST', {
        target_id: target.id,
        source_ids: [source.id],
      })
    ).status,
  ).toBe(200);
  expect(
    await (
      await req('/payees/suggestion?name=Nome%20origem%20fict%C3%ADcio%2020')
    ).json(),
  ).toEqual({
    category_id: 'd20-casa',
    tag_ids: [],
    source: 'default',
  });
  expect(
    (
      await req(`/payees/${source.id}`, 'PATCH', {
        category_id: 'd20-mercado',
        tag_ids: [],
      })
    ).status,
  ).toBe(404);
});

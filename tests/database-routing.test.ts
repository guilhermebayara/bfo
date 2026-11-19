import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { beforeAll, expect, it, vi } from 'vitest';
import app from '../src/server/index';

const testDb = env.DB as D1Database;
const stagingDb = env.DB_HOMOLOGACAO as D1Database;

beforeAll(async () => {
  await applyD1Migrations(testDb, env.MIGRATIONS);
  await applyD1Migrations(stagingDb, env.MIGRATIONS);
  await testDb.exec(
    "INSERT INTO accounts(id,name,kind) VALUES ('padrao','Padrão','checking')",
  );
  await stagingDb.exec(
    "INSERT INTO accounts(id,name,kind) VALUES ('homologacao','Homologação','checking')",
  );
});

it.each([
  ['bfo.bayara.design', 'padrao'],
  ['tst-infra.bfo.bayara.design', 'padrao'],
  ['localhost:8787', 'padrao'],
  ['homologacao.bfo.bayara.design', 'homologacao'],
])('usa o D1 correto em %s', async (host, accountId) => {
  const response = await app.request(`https://${host}/api/accounts`, {}, env);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject([{ id: accountId }]);
});

it('impede acesso ao D1 padrão se faltar o binding de homologação', async () => {
  const prepare = vi.fn();
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const response = await app.request(
      'https://homologacao.bfo.bayara.design/api/health',
      {},
      { DB: { prepare } },
    );
    expect(response.status).toBe(500);
    expect(prepare).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

import { expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
it('migra uma base da sessão A sem perder referências ou registros importados', async () => {
  const db = env.DB as D1Database;
  await applyD1Migrations(db, env.MIGRATIONS.slice(0, 1));
  await db.exec(
    "INSERT INTO accounts(id,name,kind) VALUES('old','Conta anterior','checking'); INSERT INTO transactions(id,account_id,date,amount_cents,payee,origin,kind) VALUES('old-t','old','2026-01-01',1234,'Nome original','imported','regular'); INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status) VALUES('s','old','2026-01-01','2026-01-20','2026-01-27','open');",
  );
  await applyD1Migrations(db, env.MIGRATIONS);
  expect(
    await db
      .prepare(
        "SELECT t.amount_cents,t.amount_brl_cents,t.currency,p.name FROM transactions t JOIN payees p ON p.id=t.payee_id WHERE t.id='old-t'",
      )
      .first(),
  ).toEqual({
    amount_cents: 1234,
    amount_brl_cents: 1234,
    currency: 'BRL',
    name: 'Nome original',
  });
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual(
    [],
  );
  await db.prepare("UPDATE accounts SET currency='USD' WHERE id='old'").run();
  await expect(
    db
      .prepare("UPDATE transactions SET amount_brl_cents=1 WHERE id='old-t'")
      .run(),
  ).rejects.toThrow();
  expect(
    (await db.prepare("SELECT account_id FROM statements WHERE id='s'").first())
      .account_id,
  ).toBe('old');
});

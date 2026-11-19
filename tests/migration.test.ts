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

it('aplica a revisão sobre banco da Sessão F e reaplica sem mudar dados nem relacionamentos', async () => {
  const db = env.DB_HOMOLOGACAO as D1Database;
  await applyD1Migrations(db, env.MIGRATIONS.slice(0, 5));
  await db.exec(
    "INSERT INTO accounts(id,name,kind,cutoff_date) VALUES('existing','Conta existente fictícia','checking','2026-01-01'); INSERT INTO tags(id,name) VALUES('existing-tag','Tag anterior'); INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,origin,kind,external_id) VALUES('existing-t','existing','2026-02-01',12345,12345,'Nome original existente','imported','regular','fixture-existing'); INSERT INTO transaction_tags VALUES('existing-t','existing-tag'); INSERT INTO transaction_splits(id,transaction_id,position,amount_cents,amount_brl_cents,note) VALUES('existing-part-1','existing-t',0,12000,12000,'Nota da parte'),('existing-part-2','existing-t',1,345,345,'Outra nota'); INSERT INTO split_tags VALUES('existing-part-1','existing-tag'); INSERT INTO recurring(id,account_id,payee,amount_cents,cadence,next_date,notice_days) VALUES('existing-r','existing','Recorrente anterior',999,'monthly','2026-02-01',45);",
  );
  const tables = (
    await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations') ORDER BY name",
      )
      .all<{ name: string }>()
  ).results.map((t) => t.name);
  async function snapshot() {
    return Promise.all(
      tables.map(async (name) => [
        name,
        (await db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all())
          .results,
      ]),
    );
  }
  const before = await snapshot();
  await applyD1Migrations(db, env.MIGRATIONS);
  expect(await snapshot()).toEqual(before);
  await applyD1Migrations(db, env.MIGRATIONS);
  expect(await snapshot()).toEqual(before);
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual(
    [],
  );
});

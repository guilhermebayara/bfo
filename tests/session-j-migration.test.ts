import { expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
it('migra base da I com pagamento parcial, fim de mês e conta padrão sem perder referências', async () => {
  const db = env.DB as D1Database;
  await applyD1Migrations(db, env.MIGRATIONS.slice(0, 8));
  await db.exec(
    "INSERT INTO accounts(id,name,kind,currency,cutoff_date,closing_day,due_day) VALUES('j-old-checking','Corrente anterior fictícia','checking','BRL','2026-01-01',NULL,NULL),('j-old-card','Cartão anterior fictício','credit_card','BRL','2026-01-01',31,5); UPDATE preferences SET default_account_id='j-old-checking'; INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status,bank_amount_cents) VALUES('j-old-bill','j-old-card','2026-02-01','2026-02-28','2026-03-05','closed',10000); INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,origin,kind,statement_id,card_amount_cents) VALUES('j-old-purchase','j-old-card','2026-02-15',10000,10000,'Compra fictícia anterior','imported','regular','j-old-bill',NULL),('j-old-payment','j-old-checking','2026-03-05',4000,4000,'Pagamento fictício anterior','manual','card_payment','j-old-bill',4000);",
  );
  await applyD1Migrations(db, env.MIGRATIONS);
  expect(
    (await db.prepare('SELECT default_account_id FROM preferences').first())
      .default_account_id,
  ).toBe('j-old-checking');
  expect(
    await db
      .prepare(
        "SELECT n.closing_date,n.due_date,n.previous_balance_cents,n.total_cents FROM statement_carryovers c JOIN statement_totals n ON n.id=c.destination_statement_id WHERE c.source_statement_id='j-old-bill'",
      )
      .first(),
  ).toEqual({
    closing_date: '2026-03-31',
    due_date: '2026-04-05',
    previous_balance_cents: 6000,
    total_cents: 6000,
  });
  expect(
    (
      await db
        .prepare(
          "SELECT SUM(amount_cents) AS total FROM account_movements WHERE account_id='j-old-card'",
        )
        .first()
    ).total,
  ).toBe(6000);
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual(
    [],
  );
  await applyD1Migrations(db, env.MIGRATIONS);
  expect(
    (
      await db
        .prepare('SELECT COUNT(*) AS count FROM statement_carryovers')
        .first()
    ).count,
  ).toBe(1);
});

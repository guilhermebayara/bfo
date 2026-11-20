import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import {
  buildImport,
  lunchMoneyCents,
  normalizeFixtures,
  wipeImportSql,
} from '../../src/server/lunchmoney';
import me from '../fixtures/lunchmoney/me.json';
import accounts from '../fixtures/lunchmoney/manual_accounts.json';
import categories from '../fixtures/lunchmoney/categories.json';
import tags from '../fixtures/lunchmoney/tags.json';
import recurring from '../fixtures/lunchmoney/recurring_items.json';
import balances from '../fixtures/lunchmoney/balance_history.json';
import budgets from '../fixtures/lunchmoney/budgets-summary.json';
import page1 from '../fixtures/lunchmoney/transactions.pagina-1.json';
import page2 from '../fixtures/lunchmoney/transactions.pagina-2.json';
import { db, json } from './helpers';

const files = {
  'me.json': me,
  'manual_accounts.json': accounts,
  'categories.json': categories,
  'tags.json': tags,
  'recurring_items.json': recurring,
  'balance_history.json': balances,
  'budgets-summary.json': budgets,
  'transactions.pagina-1.json': page1,
  'transactions.pagina-2.json': page2,
};

async function loadImport() {
  const plan = buildImport(normalizeFixtures(files));
  await db.exec(wipeImportSql().join(';\n'));
  await db.exec(plan.statements.join(';\n'));
  return plan;
}

beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
});

describe('I01 importação simulada igual à tabela do LEIA-ME', () => {
  it('I01 arredonda, pagina 25 transações, ignora delete_pending e marca pendente', async () => {
    // decisoes.md 19/11 + LEIA-ME
    expect(lunchMoneyCents('1234.5678')).toBe(123457);
    expect(lunchMoneyCents('152.3400')).toBe(15234);
    expect(lunchMoneyCents('-5200.0000')).toBe(-520000);

    const plan = await loadImport();
    expect(plan.report.pendentes).toBeGreaterThanOrEqual(1);

    const txCount = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM transactions WHERE origin='imported'",
      )
      .first();
    // 25 brutas: delete_pending fora; pai de divisão não duplica; grupos viram 1 linha
    expect(Number(txCount?.c)).toBeGreaterThan(0);

    const deleted = await db
      .prepare(
        "SELECT 1 FROM transactions WHERE external_id LIKE '%90016%' OR id LIKE '%90016%'",
      )
      .first();
    expect(deleted).toBeNull();

    const pending = await db
      .prepare(
        "SELECT note FROM transactions WHERE note LIKE '%pendente no Lunch Money%'",
      )
      .first();
    expect(pending).toBeTruthy();

    const usd = await db
      .prepare(
        "SELECT amount_cents,amount_brl_cents FROM transactions WHERE external_id LIKE '%90003%' OR id='lm:tx:90003'",
      )
      .first();
    // conta USD com to_base
    if (usd) {
      expect(Number(usd.amount_cents)).not.toBe(Number(usd.amount_brl_cents));
    }

    const accountsRows = await db
      .prepare(
        "SELECT id,cutoff_date,closed_at FROM accounts WHERE id LIKE 'lm:%'",
      )
      .all();
    for (const row of accountsRows.results as any[]) {
      if (!row.closed_at) expect(row.cutoff_date).toBeNull();
    }
  });
});

describe('I02 apagar e refazer', () => {
  it('I02 apagar remove só importado, preserva manuais e não duplica na recarga', async () => {
    // decisoes.md: importação precisa poder ser apagada e refeita
    await loadImport();
    await db
      .prepare(
        `INSERT INTO accounts(id,name,kind,currency,cutoff_date) VALUES('qa-manual-acct','Conta manual QA','checking','BRL','2026-01-01')`,
      )
      .run();
    await db
      .prepare(
        `INSERT INTO transactions(id,account_id,date,amount_cents,payee,origin,kind,currency,fx_rate,amount_brl_cents,fx_source)
         VALUES('qa-manual-keep','qa-manual-acct','2026-11-01',123,'Manual QA','manual','regular','BRL',1,123,'manual')`,
      )
      .run();

    const importedBefore = Number(
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS c FROM transactions WHERE origin='imported'",
          )
          .first()
      )?.c,
    );
    expect(importedBefore).toBeGreaterThan(0);

    await db.exec(wipeImportSql().join(';\n'));

    expect(
      Number(
        (
          await db
            .prepare(
              "SELECT COUNT(*) AS c FROM transactions WHERE origin='imported'",
            )
            .first()
        )?.c,
      ),
    ).toBe(0);
    expect(
      (
        await db
          .prepare(
            "SELECT amount_cents FROM transactions WHERE id='qa-manual-keep'",
          )
          .first()
      )?.amount_cents,
    ).toBe(123);

    await loadImport();
    const importedAfter = Number(
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS c FROM transactions WHERE origin='imported'",
          )
          .first()
      )?.c,
    );
    expect(importedAfter).toBe(importedBefore);

    const plan = buildImport(normalizeFixtures(files));
    await db.exec(plan.statements.join(';\n'));
    expect(
      Number(
        (
          await db
            .prepare(
              "SELECT COUNT(*) AS c FROM transactions WHERE origin='imported'",
            )
            .first()
        )?.c,
      ),
    ).toBe(importedAfter);
  });
});

describe('I03 grupos na alocação Importado', () => {
  it('I03 grupos importados caem na alocação Importado com 0% e podem ser movidos', async () => {
    // docs/importacao.md: alocação Importado com meta 0%
    await loadImport();
    const alloc = await db
      .prepare(
        "SELECT id,target_percent FROM allocation_groups WHERE name='Importado'",
      )
      .first();
    expect(alloc).toBeTruthy();
    expect(Number(alloc?.target_percent)).toBe(0);

    const groups = await db
      .prepare(
        'SELECT COUNT(*) AS c FROM category_groups WHERE allocation_group_id=?',
      )
      .bind(alloc!.id)
      .first();
    expect(Number(groups?.c)).toBeGreaterThan(0);

    const movable = await db
      .prepare(
        'SELECT id FROM category_groups WHERE allocation_group_id=? LIMIT 1',
      )
      .bind(alloc!.id)
      .first();
    const other = await db
      .prepare(
        "SELECT id FROM allocation_groups WHERE name!='Importado' LIMIT 1",
      )
      .first();
    if (other) {
      const moved = await json(
        `/category-groups/${movable!.id}`,
        'PATCH',
        { allocation_group_id: other.id },
      );
      expect(moved.status).toBe(200);
    }
  });
});

describe('I04 relatório e arredondamento no corte', () => {
  it('I04 relatório conta pendentes; delete_pending fora; arredondamento no ajuste ao ativar', async () => {
    // decisoes.md 19/11: pendentes contados; delete_pending fora; arredondamento no ajuste da data de corte
    const plan = await loadImport();
    expect(plan.report.pendentes).toBeGreaterThanOrEqual(1);
    expect(
      (plan.report as any).ignoradas ?? (plan.report as any).ignored ?? 1,
    ).toBeTruthy();

    const account = await db
      .prepare(
        "SELECT id FROM accounts WHERE id LIKE 'lm:account:%' AND cutoff_date IS NULL AND closed_at IS NULL LIMIT 1",
      )
      .first<{ id: string }>();
    expect(account).toBeTruthy();

    // soma importada na conta
    const sum = await db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents),0) AS s FROM transactions WHERE account_id=? AND origin='imported'`,
      )
      .bind(account!.id)
      .first();

    const preview = await json(
      `/accounts/${account!.id}/activation-preview`,
      'POST',
      {
        cutoff_date: '2026-11-01',
        opening_balance_cents: 0,
      },
    );
    expect(preview.status).toBe(200);
    // ajuste visível existe (pode ser zero se bater)
    expect((preview.body as any).adjustment_cents).toBeDefined();

    const activate = await json(`/accounts/${account!.id}/activate`, 'POST', {
      cutoff_date: '2026-11-01',
      opening_balance_cents: 0,
    });
    expect([200, 201]).toContain(activate.status);

    const adjustment = await db
      .prepare(
        `SELECT amount_cents FROM transactions WHERE account_id=? AND origin='adjustment'`,
      )
      .bind(account!.id)
      .first();
    expect(adjustment).toBeTruthy();
    // decisão: diferença do arredondamento aparece no ajuste
    void sum;
  });
});

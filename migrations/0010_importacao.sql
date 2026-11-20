-- Importação do Lunch Money. Categorias soltas ficam sem grupo.
-- Históricos de saldo e orçamento ficam guardados para as fases 2 e 3.
PRAGMA defer_foreign_keys = ON;

DROP VIEW monthly_totals;
DROP VIEW effective_categories;

CREATE TABLE categories_k (
 id TEXT PRIMARY KEY, name TEXT NOT NULL,
 category_group_id TEXT REFERENCES category_groups(id),
 is_income INTEGER NOT NULL DEFAULT 0 CHECK(is_income IN (0,1)),
 sort INTEGER NOT NULL DEFAULT 0,
 exclude_budget INTEGER NOT NULL DEFAULT 0 CHECK(exclude_budget IN (0,1)),
 exclude_totals INTEGER NOT NULL DEFAULT 0 CHECK(exclude_totals IN (0,1)),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
);
INSERT INTO categories_k(id,name,category_group_id,is_income,sort,exclude_budget,exclude_totals,archived)
 SELECT id,name,category_group_id,is_income,sort,exclude_budget,exclude_totals,0 FROM categories;
DROP TABLE categories;
ALTER TABLE categories_k RENAME TO categories;

CREATE VIEW effective_categories AS
 SELECT c.*,max(c.is_income,COALESCE(g.is_income,0)) AS effective_income,
 max(c.exclude_budget,COALESCE(g.exclude_budget,0)) AS effective_exclude_budget,
 max(c.exclude_totals,COALESCE(g.exclude_totals,0)) AS effective_exclude_totals,
 COALESCE(g.is_income,0) AS inherited_income,
 COALESCE(g.exclude_budget,0) AS inherited_exclude_budget,
 COALESCE(g.exclude_totals,0) AS inherited_exclude_totals
 FROM categories c LEFT JOIN category_groups g ON g.id=c.category_group_id;

CREATE VIEW monthly_totals AS
 SELECT t.*,COALESCE(c.effective_income,0) AS is_income,COALESCE(c.effective_exclude_budget,0) AS exclude_budget
 FROM spending_transactions t LEFT JOIN effective_categories c ON c.id=t.category_id WHERE COALESCE(c.effective_exclude_totals,0)=0;

ALTER TABLE tags ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1));

CREATE TABLE import_links (
 source TEXT NOT NULL,
 entity TEXT NOT NULL,
 remote_id TEXT NOT NULL,
 local_id TEXT NOT NULL,
 PRIMARY KEY (source, entity, remote_id)
);
CREATE INDEX import_links_local ON import_links(source, entity, local_id);

CREATE TABLE imported_balances (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 date TEXT NOT NULL,
 balance_cents INTEGER NOT NULL CHECK(typeof(balance_cents)='integer' AND abs(balance_cents)<=9007199254740991),
 currency TEXT NOT NULL,
 UNIQUE(account_id, date)
);

CREATE TABLE imported_budgets (
 id TEXT PRIMARY KEY,
 category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
 month TEXT NOT NULL,
 budgeted_cents INTEGER NOT NULL CHECK(typeof(budgeted_cents)='integer'),
 actual_cents INTEGER NOT NULL CHECK(typeof(actual_cents)='integer'),
 UNIQUE(category_id, month)
);

PRAGMA defer_foreign_keys = OFF;

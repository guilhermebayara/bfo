ALTER TABLE category_groups ADD COLUMN is_income INTEGER NOT NULL DEFAULT 0 CHECK(is_income IN (0,1));
ALTER TABLE category_groups ADD COLUMN exclude_budget INTEGER NOT NULL DEFAULT 0 CHECK(exclude_budget IN (0,1));
ALTER TABLE category_groups ADD COLUMN exclude_totals INTEGER NOT NULL DEFAULT 0 CHECK(exclude_totals IN (0,1));
ALTER TABLE categories ADD COLUMN exclude_budget INTEGER NOT NULL DEFAULT 0 CHECK(exclude_budget IN (0,1));
ALTER TABLE categories ADD COLUMN exclude_totals INTEGER NOT NULL DEFAULT 0 CHECK(exclude_totals IN (0,1));
CREATE VIEW effective_categories AS
 SELECT c.*,max(c.is_income,g.is_income) AS effective_income,
 max(c.exclude_budget,g.exclude_budget) AS effective_exclude_budget,
 max(c.exclude_totals,g.exclude_totals) AS effective_exclude_totals,
 g.is_income AS inherited_income,g.exclude_budget AS inherited_exclude_budget,g.exclude_totals AS inherited_exclude_totals
 FROM categories c JOIN category_groups g ON g.id=c.category_group_id;
CREATE TABLE preferences (
 id INTEGER PRIMARY KEY CHECK(id=1),
 default_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL
);
INSERT INTO preferences(id) VALUES(1);
CREATE VIEW monthly_totals AS
 SELECT t.*,COALESCE(c.effective_income,0) AS is_income,
 COALESCE(c.effective_exclude_budget,0) AS exclude_budget
 FROM spending_transactions t LEFT JOIN effective_categories c ON c.id=t.category_id
 WHERE COALESCE(c.effective_exclude_totals,0)=0;

PRAGMA defer_foreign_keys = ON;
CREATE TABLE institutions (id TEXT PRIMARY KEY, name TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
-- Reconstrução necessária para remover o CHECK(currency='BRL') da migração inicial.
CREATE TABLE accounts_new (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('checking','credit_card','cash')),
 currency TEXT NOT NULL DEFAULT 'BRL' CHECK(length(currency)=3), cutoff_date TEXT,
 opening_balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(typeof(opening_balance_cents)='integer' AND abs(opening_balance_cents)<=9007199254740991),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 closing_day INTEGER CHECK(closing_day BETWEEN 1 AND 31), due_day INTEGER CHECK(due_day BETWEEN 1 AND 31),
 institution_id TEXT REFERENCES institutions(id), last_reconciled_at TEXT, closed_at TEXT
);
INSERT INTO accounts_new(id,name,kind,currency,cutoff_date,opening_balance_cents,archived,created_at,closing_day,due_day)
 SELECT id,name,kind,currency,cutoff_date,opening_balance_cents,archived,created_at,closing_day,due_day FROM accounts;
DROP TABLE accounts;
ALTER TABLE accounts_new RENAME TO accounts;
UPDATE accounts SET closed_at=substr(created_at,1,10) WHERE archived=1;
CREATE TABLE payees (id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, merged_into_id TEXT REFERENCES payees(id), CHECK(merged_into_id IS NULL OR merged_into_id<>id));
CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, color TEXT NOT NULL DEFAULT '#888888');
CREATE TABLE transaction_tags (transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(transaction_id,tag_id));
CREATE TABLE fx_rates (currency TEXT NOT NULL, date TEXT NOT NULL, rate REAL NOT NULL CHECK(rate>0), PRIMARY KEY(currency,date));
CREATE TABLE reconciliations (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), date TEXT NOT NULL, bank_balance_cents INTEGER NOT NULL CHECK(typeof(bank_balance_cents)='integer' AND abs(bank_balance_cents)<=9007199254740991), app_balance_cents INTEGER NOT NULL CHECK(typeof(app_balance_cents)='integer' AND abs(app_balance_cents)<=9007199254740991), adjustment_transaction_id TEXT REFERENCES transactions(id));
ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'BRL';
ALTER TABLE transactions ADD COLUMN fx_rate REAL NOT NULL DEFAULT 1 CHECK(fx_rate>0);
ALTER TABLE transactions ADD COLUMN amount_brl_cents INTEGER NOT NULL DEFAULT 0 CHECK(typeof(amount_brl_cents)='integer' AND abs(amount_brl_cents)<=9007199254740991);
ALTER TABLE transactions ADD COLUMN fx_source TEXT NOT NULL DEFAULT 'manual' CHECK(fx_source IN ('ptax','manual'));
ALTER TABLE transactions ADD COLUMN payee_id TEXT REFERENCES payees(id);
DROP TRIGGER imported_transaction_lock;
INSERT INTO payees(id,name) SELECT 'legacy-'||min(id),payee FROM transactions GROUP BY payee COLLATE NOCASE;
UPDATE transactions SET amount_brl_cents=amount_cents, payee_id=(SELECT id FROM payees WHERE name=transactions.payee COLLATE NOCASE);
CREATE INDEX transactions_payee_date ON transactions(payee_id,date DESC,created_at DESC);
CREATE INDEX transaction_tags_tag ON transaction_tags(tag_id,transaction_id);
CREATE TRIGGER imported_transaction_lock BEFORE UPDATE ON transactions
WHEN OLD.origin='imported' AND (
 NEW.id IS NOT OLD.id OR NEW.account_id IS NOT OLD.account_id OR NEW.date IS NOT OLD.date OR
 NEW.amount_cents IS NOT OLD.amount_cents OR NEW.payee IS NOT OLD.payee OR NEW.origin IS NOT OLD.origin OR
 NEW.kind IS NOT OLD.kind OR NEW.transfer_pair_id IS NOT OLD.transfer_pair_id OR NEW.statement_id IS NOT OLD.statement_id OR
 NEW.installment_plan_id IS NOT OLD.installment_plan_id OR NEW.external_id IS NOT OLD.external_id OR NEW.created_at IS NOT OLD.created_at OR NEW.activation_account_id IS NOT OLD.activation_account_id OR
 NEW.currency IS NOT OLD.currency OR NEW.fx_rate IS NOT OLD.fx_rate OR NEW.amount_brl_cents IS NOT OLD.amount_brl_cents OR NEW.fx_source IS NOT OLD.fx_source OR NEW.payee_id IS NOT OLD.payee_id)
BEGIN SELECT RAISE(ABORT,'Transação importada: somente categoria e nota podem mudar.'); END;

CREATE TRIGGER payee_merge_target BEFORE UPDATE OF merged_into_id ON payees
WHEN NEW.merged_into_id IS NOT NULL AND (SELECT merged_into_id FROM payees WHERE id=NEW.merged_into_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Destino já unificado. Atualize a lista.'); END;
-- O nome original foi restaurado; encerra a suspensão para as próximas operações.
PRAGMA defer_foreign_keys = OFF;

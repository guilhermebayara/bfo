PRAGMA foreign_keys = ON;
CREATE TABLE accounts (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('checking','credit_card','cash')),
 currency TEXT NOT NULL DEFAULT 'BRL' CHECK(currency = 'BRL'), cutoff_date TEXT,
 opening_balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(typeof(opening_balance_cents)='integer' AND abs(opening_balance_cents)<=9007199254740991),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 closing_day INTEGER CHECK(closing_day BETWEEN 1 AND 31), due_day INTEGER CHECK(due_day BETWEEN 1 AND 31)
);
CREATE TABLE allocation_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, target_percent INTEGER NOT NULL CHECK(target_percent BETWEEN 0 AND 100), sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE category_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, allocation_group_id TEXT NOT NULL REFERENCES allocation_groups(id), sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, category_group_id TEXT NOT NULL REFERENCES category_groups(id), is_income INTEGER NOT NULL DEFAULT 0 CHECK(is_income IN (0,1)), sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE statements (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), period_start TEXT NOT NULL, closing_date TEXT NOT NULL, due_date TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('open','closed','paid')), bank_amount_cents INTEGER CHECK(bank_amount_cents IS NULL OR (typeof(bank_amount_cents)='integer' AND abs(bank_amount_cents)<=9007199254740991)), closed_at TEXT
);
CREATE TABLE installment_plans (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), description TEXT NOT NULL,
 total_cents INTEGER NOT NULL CHECK(typeof(total_cents)='integer' AND total_cents>0 AND total_cents<=9007199254740991),
 count INTEGER NOT NULL CHECK(count>0), first_date TEXT NOT NULL, category_id TEXT REFERENCES categories(id)
);
CREATE TABLE transactions (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), date TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(typeof(amount_cents)='integer' AND abs(amount_cents)<=9007199254740991),
 payee TEXT NOT NULL, category_id TEXT REFERENCES categories(id), note TEXT NOT NULL DEFAULT '',
 origin TEXT NOT NULL CHECK(origin IN ('imported','manual','adjustment')),
 kind TEXT NOT NULL CHECK(kind IN ('regular','transfer','card_payment','installment')),
 transfer_pair_id TEXT REFERENCES transactions(id) DEFERRABLE INITIALLY DEFERRED,
 statement_id TEXT REFERENCES statements(id), installment_plan_id TEXT REFERENCES installment_plans(id),
 external_id TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 activation_account_id TEXT UNIQUE REFERENCES accounts(id)
);
CREATE INDEX transactions_date ON transactions(date DESC, id);
CREATE INDEX transactions_account_date ON transactions(account_id,date);
CREATE TRIGGER imported_transaction_lock BEFORE UPDATE ON transactions
WHEN OLD.origin = 'imported' AND (
 NEW.id IS NOT OLD.id OR NEW.account_id IS NOT OLD.account_id OR NEW.date IS NOT OLD.date OR
 NEW.amount_cents IS NOT OLD.amount_cents OR NEW.payee IS NOT OLD.payee OR NEW.origin IS NOT OLD.origin OR
 NEW.kind IS NOT OLD.kind OR NEW.transfer_pair_id IS NOT OLD.transfer_pair_id OR NEW.statement_id IS NOT OLD.statement_id OR
 NEW.installment_plan_id IS NOT OLD.installment_plan_id OR NEW.external_id IS NOT OLD.external_id OR NEW.created_at IS NOT OLD.created_at OR NEW.activation_account_id IS NOT OLD.activation_account_id)
BEGIN SELECT RAISE(ABORT,'Transação importada: somente categoria e nota podem mudar.'); END;
CREATE TABLE subscription_types (id TEXT PRIMARY KEY, name TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE recurring (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), payee TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(typeof(amount_cents)='integer' AND abs(amount_cents)<=9007199254740991), category_id TEXT REFERENCES categories(id),
 cadence TEXT NOT NULL CHECK(cadence IN ('monthly','yearly','weekly','custom')), next_date TEXT NOT NULL,
 is_subscription INTEGER NOT NULL DEFAULT 0 CHECK(is_subscription IN (0,1)), subscription_type_id TEXT REFERENCES subscription_types(id), renewal_date TEXT,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

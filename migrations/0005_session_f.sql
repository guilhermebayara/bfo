ALTER TABLE recurring ADD COLUMN notice_days INTEGER NOT NULL DEFAULT 30 CHECK(typeof(notice_days)='integer' AND notice_days BETWEEN 0 AND 3660);
ALTER TABLE transactions ADD COLUMN retroactive INTEGER NOT NULL DEFAULT 0 CHECK(retroactive IN (0,1));
ALTER TABLE transactions ADD COLUMN added_to_closed INTEGER NOT NULL DEFAULT 0 CHECK(added_to_closed IN (0,1));
CREATE TABLE installment_advances (
 id TEXT PRIMARY KEY,
 installment_plan_id TEXT NOT NULL REFERENCES installment_plans(id),
 count INTEGER NOT NULL CHECK(count>0),
 face_cents INTEGER NOT NULL CHECK(face_cents>0),
 paid_cents INTEGER NOT NULL CHECK(paid_cents>=0 AND paid_cents<=face_cents),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE transactions ADD COLUMN advance_id TEXT REFERENCES installment_advances(id);
CREATE INDEX transactions_advance ON transactions(advance_id);
CREATE TABLE statement_revisions (
 id TEXT PRIMARY KEY,
 statement_id TEXT NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
 transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
 previous_cents INTEGER NOT NULL,
 current_cents INTEGER NOT NULL,
 bank_amount_cents INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DROP TRIGGER statement_only_open_for_purchase;
CREATE TRIGGER statement_only_open_for_purchase BEFORE INSERT ON transactions
WHEN NEW.statement_id IS NOT NULL AND NEW.origin='manual' AND NEW.kind IN ('regular','installment')
 AND NOT EXISTS (SELECT 1 FROM transactions WHERE id=NEW.id)
 AND EXISTS (SELECT 1 FROM statements WHERE id=NEW.statement_id AND status<>'open')
 AND NOT (NEW.kind='installment' AND NEW.installment_number IS NOT NULL AND NEW.added_to_closed=1)
BEGIN SELECT RAISE(ABORT,'Fatura já fechada.'); END;

-- Preserva a conferência original e registra o total antes e depois da inclusão.
CREATE TRIGGER closed_statement_revision AFTER INSERT ON transactions
WHEN NEW.added_to_closed=1
BEGIN
 INSERT INTO statement_revisions(id,statement_id,transaction_id,previous_cents,current_cents,bank_amount_cents)
 SELECT lower(hex(randomblob(16))),s.id,NEW.id,s.total_cents-NEW.amount_cents,s.total_cents,s.bank_amount_cents
 FROM statement_totals s WHERE s.id=NEW.statement_id AND s.status<>'open';
END;
CREATE TABLE transaction_splits (
 id TEXT PRIMARY KEY,
 transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
 position INTEGER NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(typeof(amount_cents)='integer' AND amount_cents<>0),
 amount_brl_cents INTEGER NOT NULL CHECK(typeof(amount_brl_cents)='integer'),
 category_id TEXT REFERENCES categories(id),
 note TEXT NOT NULL DEFAULT '',
 UNIQUE(transaction_id,position)
);
CREATE TABLE split_tags (
 split_id TEXT NOT NULL REFERENCES transaction_splits(id) ON DELETE CASCADE,
 tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
 PRIMARY KEY(split_id,tag_id)
);
CREATE TRIGGER split_original_finances_lock BEFORE UPDATE OF account_id,date,amount_cents,currency,fx_rate,amount_brl_cents ON transactions
WHEN EXISTS(SELECT 1 FROM transaction_splits WHERE transaction_id=OLD.id)
 AND (NEW.account_id IS NOT OLD.account_id OR NEW.date IS NOT OLD.date OR NEW.amount_cents IS NOT OLD.amount_cents
 OR NEW.currency IS NOT OLD.currency OR NEW.fx_rate IS NOT OLD.fx_rate OR NEW.amount_brl_cents IS NOT OLD.amount_brl_cents)
BEGIN SELECT RAISE(ABORT,'Desfaça a divisão antes de alterar valor, data ou conta.'); END;

DROP VIEW spending_transactions;
DROP VIEW account_movements;
DROP VIEW statement_totals;
DROP VIEW statement_items;
CREATE VIEW active_transactions AS SELECT * FROM transactions WHERE advance_id IS NULL OR installment_number IS NULL;
CREATE VIEW statement_items AS
 SELECT statement_id,id,account_id,date,payee,amount_cents,amount_brl_cents,currency,installment_number,installment_plan_id,retroactive,added_to_closed
 FROM active_transactions WHERE statement_id IS NOT NULL AND kind IN ('regular','installment')
 UNION ALL
 SELECT s.id,t.id,t.account_id,t.date,t.payee,t.amount_cents,t.amount_brl_cents,t.currency,t.installment_number,t.installment_plan_id,t.retroactive,t.added_to_closed
 FROM statements s JOIN active_transactions t ON t.account_id=s.account_id AND t.date BETWEEN s.period_start AND s.closing_date
 WHERE t.statement_id IS NULL AND t.kind='regular' AND t.origin<>'adjustment';
CREATE VIEW statement_totals AS
 SELECT s.*,COALESCE((SELECT SUM(amount_cents) FROM statement_items WHERE statement_id=s.id),0) AS total_cents FROM statements s;
CREATE VIEW account_movements AS
 SELECT account_id,date,amount_cents FROM active_transactions
 UNION ALL
 SELECT s.account_id,t.date,-s.bank_amount_cents FROM statements s JOIN transactions t ON t.statement_id=s.id WHERE t.kind='card_payment' AND s.status='paid';
CREATE VIEW spending_transactions AS
 SELECT t.*,substr(CASE WHEN t.kind='installment' THEN COALESCE(s.due_date,t.date) ELSE t.date END,1,7) AS spending_month
 FROM active_transactions t LEFT JOIN statements s ON s.id=t.statement_id WHERE t.kind IN ('regular','installment')
 AND NOT EXISTS(SELECT 1 FROM transaction_splits WHERE transaction_id=t.id)
 UNION ALL
 SELECT t.id,t.account_id,t.date,p.amount_cents,t.payee,p.category_id,p.note,t.origin,t.kind,t.transfer_pair_id,t.statement_id,t.installment_plan_id,t.external_id,t.created_at,t.activation_account_id,t.currency,t.fx_rate,p.amount_brl_cents,t.fx_source,t.payee_id,t.installment_number,t.retroactive,t.added_to_closed,t.advance_id,
 substr(CASE WHEN t.kind='installment' THEN COALESCE(s.due_date,t.date) ELSE t.date END,1,7)
 FROM active_transactions t JOIN transaction_splits p ON p.transaction_id=t.id LEFT JOIN statements s ON s.id=t.statement_id WHERE t.kind IN ('regular','installment');

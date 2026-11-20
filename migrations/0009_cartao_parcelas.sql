-- Contas de saldo podem receber transferências. Mantém os dados e as referências.
PRAGMA defer_foreign_keys = ON;
CREATE TABLE saved_default AS SELECT default_account_id FROM preferences WHERE id=1;
CREATE TABLE accounts_j (
 id TEXT PRIMARY KEY, name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('checking','credit_card','cash','investment','property','loan')),
 currency TEXT NOT NULL DEFAULT 'BRL' CHECK(length(currency)=3), cutoff_date TEXT,
 opening_balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(typeof(opening_balance_cents)='integer' AND abs(opening_balance_cents)<=9007199254740991),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 closing_day INTEGER CHECK(closing_day BETWEEN 1 AND 31), due_day INTEGER CHECK(due_day BETWEEN 1 AND 31),
 institution_id TEXT REFERENCES institutions(id), last_reconciled_at TEXT, closed_at TEXT,
 credit_limit_cents INTEGER CHECK(credit_limit_cents IS NULL OR (typeof(credit_limit_cents)='integer' AND credit_limit_cents BETWEEN 0 AND 9007199254740991 AND kind='credit_card'))
);
INSERT INTO accounts_j SELECT *,NULL FROM accounts;
DROP TABLE accounts;
ALTER TABLE accounts_j RENAME TO accounts;
UPDATE preferences SET default_account_id=(SELECT default_account_id FROM saved_default) WHERE id=1;
DROP TABLE saved_default;
PRAGMA defer_foreign_keys = OFF;

INSERT INTO categories(id,name,category_group_id,exclude_budget,exclude_totals) VALUES('transfer','Transferência','system',1,1) ON CONFLICT(id) DO NOTHING;
INSERT INTO categories(id,name,category_group_id) VALUES('card-fees','Tarifas e encargos','system') ON CONFLICT(id) DO NOTHING;
UPDATE transactions SET category_id='transfer' WHERE kind='transfer' AND origin='manual' AND category_id IS NULL;

ALTER TABLE statements ADD COLUMN scheduled_closing_date TEXT;
UPDATE statements SET scheduled_closing_date=closing_date;
CREATE UNIQUE INDEX statements_scheduled ON statements(account_id,scheduled_closing_date);
CREATE TRIGGER statement_schedule AFTER INSERT ON statements WHEN NEW.scheduled_closing_date IS NULL
BEGIN UPDATE statements SET scheduled_closing_date=NEW.closing_date WHERE id=NEW.id; END;
CREATE TABLE statement_events (
 id TEXT PRIMARY KEY, statement_id TEXT NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
 action TEXT NOT NULL, reason TEXT NOT NULL, date TEXT NOT NULL,
 before_json TEXT NOT NULL, after_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX statement_events_statement ON statement_events(statement_id);
CREATE TABLE installment_cancellations (
 transaction_id TEXT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
 reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE statement_carryovers (
 source_statement_id TEXT PRIMARY KEY REFERENCES statements(id) ON DELETE CASCADE,
 destination_statement_id TEXT NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
 amount_cents INTEGER NOT NULL CHECK(typeof(amount_cents)='integer' AND amount_cents>0 AND amount_cents<=9007199254740991),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(source_statement_id<>destination_statement_id)
);
CREATE INDEX carryovers_destination ON statement_carryovers(destination_statement_id);

DROP VIEW monthly_totals;
DROP VIEW spending_transactions;
DROP VIEW account_movements;
DROP VIEW statement_totals;
DROP VIEW statement_items;
DROP VIEW active_transactions;
CREATE VIEW active_transactions AS SELECT * FROM transactions t
 WHERE (advance_id IS NULL OR installment_number IS NULL)
 AND NOT EXISTS(SELECT 1 FROM installment_cancellations c WHERE c.transaction_id=t.id);
CREATE VIEW statement_items AS
 SELECT statement_id,id,account_id,date,payee,amount_cents,amount_brl_cents,currency,installment_number,installment_plan_id,retroactive,added_to_closed
 FROM active_transactions WHERE statement_id IS NOT NULL AND kind IN ('regular','installment')
 UNION ALL
 SELECT s.id,t.id,t.account_id,t.date,t.payee,t.amount_cents,t.amount_brl_cents,t.currency,t.installment_number,t.installment_plan_id,t.retroactive,t.added_to_closed
 FROM statements s JOIN active_transactions t ON t.account_id=s.account_id AND t.date BETWEEN s.period_start AND s.closing_date
 WHERE t.statement_id IS NULL AND t.kind='regular' AND t.origin<>'adjustment';
-- Saldo anterior altera a cobrança, sem criar gasto ou movimentação duplicados.
CREATE VIEW statement_totals AS
 SELECT s.*,
 COALESCE((SELECT SUM(amount_cents) FROM statement_items WHERE statement_id=s.id),0)+COALESCE((SELECT SUM(amount_cents) FROM statement_carryovers WHERE destination_statement_id=s.id),0) AS total_cents,
 COALESCE((SELECT SUM(amount_cents) FROM statement_carryovers WHERE destination_statement_id=s.id),0) AS previous_balance_cents,
 COALESCE((SELECT amount_cents FROM statement_carryovers WHERE source_statement_id=s.id),0) AS carried_out_cents,
 COALESCE((SELECT SUM(card_amount_cents) FROM transactions WHERE statement_id=s.id AND kind='card_payment'),0) AS paid_cents
 FROM statements s;
CREATE VIEW account_movements AS
 SELECT account_id,date,amount_cents FROM active_transactions
 UNION ALL
 SELECT s.account_id,t.date,-COALESCE(t.card_amount_cents,s.bank_amount_cents) FROM statements s JOIN transactions t ON t.statement_id=s.id WHERE t.kind='card_payment';
CREATE VIEW spending_transactions AS
 SELECT t.*,substr(CASE WHEN t.kind='installment' THEN COALESCE(s.due_date,t.date) ELSE t.date END,1,7) AS spending_month
 FROM active_transactions t LEFT JOIN statements s ON s.id=t.statement_id
 WHERE t.kind IN ('regular','installment') AND t.activation_account_id IS NULL
 AND NOT EXISTS(SELECT 1 FROM reconciliations r WHERE r.adjustment_transaction_id=t.id)
 AND NOT EXISTS(SELECT 1 FROM transaction_splits WHERE transaction_id=t.id)
 UNION ALL
 SELECT t.id,t.account_id,t.date,p.amount_cents,t.payee,p.category_id,p.note,t.origin,t.kind,t.transfer_pair_id,t.statement_id,t.installment_plan_id,t.external_id,t.created_at,t.activation_account_id,t.currency,t.fx_rate,p.amount_brl_cents,t.fx_source,t.payee_id,t.installment_number,t.retroactive,t.added_to_closed,t.advance_id,t.card_amount_cents,
 substr(CASE WHEN t.kind='installment' THEN COALESCE(s.due_date,t.date) ELSE t.date END,1,7)
 FROM active_transactions t JOIN transaction_splits p ON p.transaction_id=t.id LEFT JOIN statements s ON s.id=t.statement_id WHERE t.kind IN ('regular','installment');
CREATE VIEW monthly_totals AS
 SELECT t.*,COALESCE(c.effective_income,0) AS is_income,COALESCE(c.effective_exclude_budget,0) AS exclude_budget
 FROM spending_transactions t LEFT JOIN effective_categories c ON c.id=t.category_id WHERE COALESCE(c.effective_exclude_totals,0)=0;

-- Uma guarda descartável permite abortar o batch inteiro após leitura concorrente.
CREATE TABLE operation_guards(id TEXT PRIMARY KEY,valid INTEGER NOT NULL CHECK(valid=1));

-- Completa pagamentos parciais já existentes sem criar movimentação ou gasto.
INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status)
 SELECT 'carry-'||s.id,s.account_id,date(s.scheduled_closing_date,'+1 day'),
 min(date(s.scheduled_closing_date,'start of month','+2 months','-1 day'),date(s.scheduled_closing_date,'start of month','+1 month','+'||(a.closing_day-1)||' days')),
 min(date(s.due_date,'start of month','+2 months','-1 day'),date(s.due_date,'start of month','+1 month','+'||(a.due_day-1)||' days')),'open'
 FROM statement_totals s JOIN accounts a ON a.id=s.account_id
 WHERE s.status='closed' AND s.paid_cents>0 AND COALESCE(s.bank_amount_cents,s.total_cents)>s.paid_cents
 ON CONFLICT DO NOTHING;
INSERT INTO statement_carryovers(source_statement_id,destination_statement_id,amount_cents)
 SELECT s.id,n.id,COALESCE(s.bank_amount_cents,s.total_cents)-s.paid_cents
 FROM statement_totals s JOIN accounts a ON a.id=s.account_id JOIN statements n ON n.account_id=s.account_id
 AND n.scheduled_closing_date=min(date(s.scheduled_closing_date,'start of month','+2 months','-1 day'),date(s.scheduled_closing_date,'start of month','+1 month','+'||(a.closing_day-1)||' days'))
 WHERE s.status='closed' AND s.paid_cents>0 AND COALESCE(s.bank_amount_cents,s.total_cents)>s.paid_cents
 ON CONFLICT DO NOTHING;

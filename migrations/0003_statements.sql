CREATE UNIQUE INDEX statements_account_closing ON statements(account_id,closing_date);
CREATE INDEX transactions_statement ON transactions(statement_id);
CREATE UNIQUE INDEX statement_single_payment ON transactions(statement_id)
 WHERE kind='card_payment' AND statement_id IS NOT NULL;
ALTER TABLE transactions ADD COLUMN installment_number INTEGER CHECK(installment_number>0);

-- Completa os dados fictícios já instalados pela base anterior.
UPDATE statements SET period_start=date(closing_date,'start of month','-1 month','+20 days')
 WHERE account_id='card-a' AND id='statement-'||substr(closing_date,1,7)
   AND period_start=substr(closing_date,1,7)||'-01' AND substr(closing_date,9,2)='20';
UPDATE transactions SET installment_number=
 (CAST(substr(date,1,4) AS INTEGER)-2026)*12+CAST(substr(date,6,2) AS INTEGER)-5
 WHERE installment_plan_id='desk' AND id GLOB 'seed-installment-*' AND origin='manual';

CREATE TABLE statement_checks (
 id TEXT PRIMARY KEY,
 statement_id TEXT NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
 app_amount_cents INTEGER NOT NULL,
 bank_amount_cents INTEGER NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('search','close')),
 adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO allocation_groups(id,name,target_percent,sort) VALUES('essential','Essencial',60,1) ON CONFLICT(id) DO NOTHING;
INSERT INTO category_groups(id,name,allocation_group_id) VALUES('system','Ajustes','essential') ON CONFLICT(id) DO NOTHING;
INSERT INTO categories(id,name,category_group_id) VALUES('statement-difference','Diferença de fatura','system') ON CONFLICT(id) DO NOTHING;

-- Compras antigas sem vínculo continuam disponíveis sem alterar dados importados.
CREATE VIEW statement_items AS
 SELECT statement_id, id, account_id, date, payee, amount_cents, amount_brl_cents, currency, installment_number, installment_plan_id
 FROM transactions WHERE statement_id IS NOT NULL AND kind IN ('regular','installment')
 UNION ALL
 SELECT s.id, t.id, t.account_id, t.date, t.payee, t.amount_cents, t.amount_brl_cents, t.currency, t.installment_number, t.installment_plan_id
 FROM statements s JOIN transactions t ON t.account_id=s.account_id AND t.date BETWEEN s.period_start AND s.closing_date
 WHERE t.statement_id IS NULL AND t.kind='regular' AND t.origin<>'adjustment';

CREATE VIEW statement_totals AS
 SELECT s.*, COALESCE((SELECT SUM(amount_cents) FROM statement_items WHERE statement_id=s.id),0) AS total_cents
 FROM statements s;

-- O crédito no cartão usa a moeda da fatura. A corrente guarda o único lançamento visível.
CREATE VIEW account_movements AS
 SELECT account_id,date,amount_cents FROM transactions
 UNION ALL
 SELECT s.account_id,t.date,-s.bank_amount_cents FROM statements s JOIN transactions t ON t.statement_id=s.id
 WHERE t.kind='card_payment' AND s.status='paid';

CREATE VIEW spending_transactions AS
 SELECT t.*, substr(CASE WHEN t.kind='installment' THEN COALESCE(s.due_date,t.date) ELSE t.date END,1,7) AS spending_month
 FROM transactions t LEFT JOIN statements s ON s.id=t.statement_id
 WHERE t.kind IN ('regular','installment');

CREATE TRIGGER statement_only_open_for_purchase BEFORE INSERT ON transactions
WHEN NEW.statement_id IS NOT NULL AND NEW.origin='manual' AND NEW.kind IN ('regular','installment')
 AND NOT EXISTS (SELECT 1 FROM transactions WHERE id=NEW.id)
 AND EXISTS (SELECT 1 FROM statements WHERE id=NEW.statement_id AND status<>'open')
BEGIN SELECT RAISE(ABORT,'Fatura já fechada.'); END;

CREATE TRIGGER payment_without_category BEFORE INSERT ON transactions
WHEN NEW.kind='card_payment' AND NEW.category_id IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Pagamento de fatura sem categoria.'); END;

CREATE TRIGGER protected_card_category BEFORE UPDATE OF category_id ON transactions
WHEN NEW.category_id IS NOT OLD.category_id AND (
 OLD.kind='card_payment' OR (OLD.origin='adjustment' AND OLD.statement_id IS NOT NULL)
)
BEGIN SELECT RAISE(ABORT,'Categoria protegida.'); END;

CREATE TRIGGER imported_installment_number_lock BEFORE UPDATE OF installment_number ON transactions
WHEN OLD.origin='imported' AND NEW.installment_number IS NOT OLD.installment_number
BEGIN SELECT RAISE(ABORT,'Transação importada: somente categoria e nota podem mudar.'); END;

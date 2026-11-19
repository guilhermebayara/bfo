ALTER TABLE recurring ADD COLUMN interval_days INTEGER CHECK(interval_days IS NULL OR interval_days BETWEEN 1 AND 3660);
ALTER TABLE recurring ADD COLUMN description TEXT NOT NULL DEFAULT '';
-- Vínculo separado preserva o registro original importado.
CREATE TABLE recurring_sources (
 recurring_id TEXT NOT NULL REFERENCES recurring(id) ON DELETE CASCADE,
 transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
 PRIMARY KEY(recurring_id,transaction_id)
);
CREATE INDEX recurring_active_date ON recurring(active,next_date);

-- Impede que uma edição mova uma compra para dentro ou para fora de fatura fechada.
CREATE TRIGGER statement_open_for_update BEFORE UPDATE OF account_id,date,amount_cents,payee,currency,fx_rate,amount_brl_cents,statement_id ON transactions
WHEN OLD.origin='manual' AND (
 NEW.account_id IS NOT OLD.account_id OR NEW.date IS NOT OLD.date OR NEW.amount_cents IS NOT OLD.amount_cents OR
 NEW.payee IS NOT OLD.payee OR NEW.currency IS NOT OLD.currency OR NEW.fx_rate IS NOT OLD.fx_rate OR
 NEW.amount_brl_cents IS NOT OLD.amount_brl_cents OR NEW.statement_id IS NOT OLD.statement_id)
 AND (EXISTS(SELECT 1 FROM statements WHERE id=OLD.statement_id AND status<>'open')
 OR EXISTS(SELECT 1 FROM statements WHERE id=NEW.statement_id AND status<>'open'))
BEGIN SELECT RAISE(ABORT,'Fatura já fechada.'); END;

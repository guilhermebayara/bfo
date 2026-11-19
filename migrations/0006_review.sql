-- Complementa a trava para os campos introduzidos na Sessão F.
CREATE TRIGGER imported_session_f_lock BEFORE UPDATE OF retroactive,added_to_closed,advance_id ON transactions
WHEN OLD.origin='imported' AND (NEW.retroactive IS NOT OLD.retroactive OR NEW.added_to_closed IS NOT OLD.added_to_closed OR NEW.advance_id IS NOT OLD.advance_id)
BEGIN SELECT RAISE(ABORT,'Transação importada: somente categoria e nota podem mudar.'); END;

CREATE INDEX transactions_plan_number ON transactions(installment_plan_id,installment_number);
CREATE INDEX transactions_category_date ON transactions(category_id,date DESC,id);
CREATE INDEX transaction_splits_category ON transaction_splits(category_id,transaction_id);
CREATE INDEX split_tags_tag ON split_tags(tag_id,split_id);
CREATE INDEX statement_checks_statement ON statement_checks(statement_id);
CREATE INDEX statement_revisions_statement ON statement_revisions(statement_id);
CREATE INDEX payees_merged ON payees(merged_into_id);
CREATE INDEX reconciliations_adjustment ON reconciliations(adjustment_transaction_id);

-- Marco de abertura e conferência de saldo não representam consumo.
-- A diferença de fatura continua sendo gasto.
DROP VIEW spending_transactions;
CREATE VIEW spending_transactions AS
 SELECT t.*,substr(CASE WHEN t.kind='installment' THEN COALESCE(s.due_date,t.date) ELSE t.date END,1,7) AS spending_month
 FROM active_transactions t LEFT JOIN statements s ON s.id=t.statement_id
 WHERE t.kind IN ('regular','installment') AND t.activation_account_id IS NULL
 AND NOT EXISTS(SELECT 1 FROM reconciliations r WHERE r.adjustment_transaction_id=t.id)
 AND NOT EXISTS(SELECT 1 FROM transaction_splits WHERE transaction_id=t.id)
 UNION ALL
 SELECT t.id,t.account_id,t.date,p.amount_cents,t.payee,p.category_id,p.note,t.origin,t.kind,t.transfer_pair_id,t.statement_id,t.installment_plan_id,t.external_id,t.created_at,t.activation_account_id,t.currency,t.fx_rate,p.amount_brl_cents,t.fx_source,t.payee_id,t.installment_number,t.retroactive,t.added_to_closed,t.advance_id,
 substr(CASE WHEN t.kind='installment' THEN COALESCE(s.due_date,t.date) ELSE t.date END,1,7)
 FROM active_transactions t JOIN transaction_splits p ON p.transaction_id=t.id LEFT JOIN statements s ON s.id=t.statement_id
 WHERE t.kind IN ('regular','installment');

-- Compras antigas podem ter vínculo inferido pelo ciclo, sem statement_id.
DROP TRIGGER statement_open_for_update;
CREATE TRIGGER statement_open_for_update BEFORE UPDATE OF account_id,date,amount_cents,payee,currency,fx_rate,amount_brl_cents,statement_id ON transactions
WHEN OLD.origin='manual' AND (
 NEW.account_id IS NOT OLD.account_id OR NEW.date IS NOT OLD.date OR NEW.amount_cents IS NOT OLD.amount_cents OR
 NEW.payee IS NOT OLD.payee OR NEW.currency IS NOT OLD.currency OR NEW.fx_rate IS NOT OLD.fx_rate OR
 NEW.amount_brl_cents IS NOT OLD.amount_brl_cents OR NEW.statement_id IS NOT OLD.statement_id)
 AND (EXISTS(SELECT 1 FROM statements WHERE id=OLD.statement_id AND status<>'open')
 OR EXISTS(SELECT 1 FROM statements WHERE id=NEW.statement_id AND status<>'open')
 OR (OLD.statement_id IS NULL AND OLD.kind='regular' AND EXISTS(SELECT 1 FROM statements WHERE account_id=OLD.account_id AND OLD.date BETWEEN period_start AND closing_date AND status<>'open')))
BEGIN SELECT RAISE(ABORT,'Fatura já fechada.'); END;

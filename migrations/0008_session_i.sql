-- Pagamentos parciais guardam o valor creditado na moeda do cartão.
DROP INDEX statement_single_payment;
ALTER TABLE transactions ADD COLUMN card_amount_cents INTEGER;
UPDATE transactions SET card_amount_cents=(SELECT bank_amount_cents FROM statements WHERE id=statement_id) WHERE kind='card_payment';
DROP VIEW account_movements;
CREATE VIEW account_movements AS
 SELECT account_id,date,amount_cents FROM active_transactions
 UNION ALL
 SELECT s.account_id,t.date,-COALESCE(t.card_amount_cents,s.bank_amount_cents) FROM statements s JOIN transactions t ON t.statement_id=s.id
 WHERE t.kind='card_payment';

DROP VIEW spending_transactions;
CREATE VIEW spending_transactions AS
 SELECT t.*,substr(CASE WHEN t.kind='installment' THEN COALESCE(s.due_date,t.date) ELSE t.date END,1,7) AS spending_month
 FROM active_transactions t LEFT JOIN statements s ON s.id=t.statement_id
 WHERE t.kind IN ('regular','installment') AND t.activation_account_id IS NULL
 AND NOT EXISTS(SELECT 1 FROM reconciliations r WHERE r.adjustment_transaction_id=t.id)
 AND NOT EXISTS(SELECT 1 FROM transaction_splits WHERE transaction_id=t.id)
 UNION ALL
 SELECT t.id,t.account_id,t.date,p.amount_cents,t.payee,p.category_id,p.note,t.origin,t.kind,t.transfer_pair_id,t.statement_id,t.installment_plan_id,t.external_id,t.created_at,t.activation_account_id,t.currency,t.fx_rate,p.amount_brl_cents,t.fx_source,t.payee_id,t.installment_number,t.retroactive,t.added_to_closed,t.advance_id,t.card_amount_cents,
 substr(CASE WHEN t.kind='installment' THEN COALESCE(s.due_date,t.date) ELSE t.date END,1,7)
 FROM active_transactions t JOIN transaction_splits p ON p.transaction_id=t.id LEFT JOIN statements s ON s.id=t.statement_id
 WHERE t.kind IN ('regular','installment');

ALTER TABLE preferences ADD COLUMN primary_currency TEXT NOT NULL DEFAULT 'BRL';
ALTER TABLE preferences ADD COLUMN currencies_in_use TEXT NOT NULL DEFAULT '["BRL"]';
UPDATE preferences SET currencies_in_use=(SELECT json_group_array(currency) FROM (SELECT 'BRL' AS currency UNION SELECT currency FROM accounts));

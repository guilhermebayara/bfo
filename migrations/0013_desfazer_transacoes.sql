ALTER TABLE transaction_actions ADD COLUMN session_id TEXT;
ALTER TABLE transaction_actions ADD COLUMN reverses_id TEXT REFERENCES transaction_actions(id);
CREATE UNIQUE INDEX transaction_action_reversal ON transaction_actions(reverses_id);

CREATE TABLE transaction_action_dependencies (
 action_id TEXT NOT NULL REFERENCES transaction_actions(id) ON DELETE CASCADE,
 entity TEXT NOT NULL,
 entity_id TEXT NOT NULL,
 before_json TEXT,
 after_json TEXT,
 PRIMARY KEY(action_id,entity,entity_id)
);

CREATE VIEW transaction_dependency_snapshots AS
 SELECT * FROM (
 SELECT 'accounts' AS entity,id AS id,json_object('cutoff_date',cutoff_date,'opening_balance_cents',opening_balance_cents,'last_reconciled_at',last_reconciled_at) AS snapshot FROM accounts
 UNION ALL
 SELECT 'statements' AS entity,id AS id,json_object('period_start',period_start,'closing_date',closing_date,'status',status,'bank_amount_cents',bank_amount_cents,'closed_at',closed_at) AS snapshot FROM statements
 UNION ALL
 SELECT 'payees' AS entity,id AS id,json_object('merged_into_id',merged_into_id) AS snapshot FROM payees
 UNION ALL
 SELECT 'installment_plans' AS entity,id AS id,json_object('id',id,'account_id',account_id,'description',description,'total_cents',total_cents,'count',count,'first_date',first_date,'category_id',category_id) AS snapshot FROM installment_plans
 UNION ALL
 SELECT 'installment_advances' AS entity,id AS id,json_object('id',id,'installment_plan_id',installment_plan_id,'count',count,'face_cents',face_cents,'paid_cents',paid_cents,'created_at',created_at) AS snapshot FROM installment_advances
 LIMIT -1)
 UNION ALL
 SELECT * FROM (
 SELECT 'recurring' AS entity,id AS id,json_object('id',id,'account_id',account_id,'payee',payee,'amount_cents',amount_cents,'category_id',category_id,'cadence',cadence,'next_date',next_date,'is_subscription',is_subscription,'subscription_type_id',subscription_type_id,'renewal_date',renewal_date,'active',active,'interval_days',interval_days,'description',description,'notice_days',notice_days) AS snapshot FROM recurring
 UNION ALL
 SELECT 'statement_carryovers' AS entity,source_statement_id AS id,json_object('source_statement_id',source_statement_id,'destination_statement_id',destination_statement_id,'amount_cents',amount_cents,'created_at',created_at) AS snapshot FROM statement_carryovers
 UNION ALL
 SELECT 'reconciliations' AS entity,id AS id,json_object('id',id,'account_id',account_id,'date',date,'bank_balance_cents',bank_balance_cents,'app_balance_cents',app_balance_cents,'adjustment_transaction_id',adjustment_transaction_id) AS snapshot FROM reconciliations
 UNION ALL
 SELECT 'statement_checks' AS entity,id AS id,json_object('id',id,'statement_id',statement_id,'app_amount_cents',app_amount_cents,'bank_amount_cents',bank_amount_cents,'action',action,'adjustment_transaction_id',adjustment_transaction_id,'created_at',created_at) AS snapshot FROM statement_checks
 LIMIT -1);

CREATE TRIGGER track_action_accounts_update BEFORE UPDATE ON accounts
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'accounts',OLD.id,json_object('cutoff_date',OLD.cutoff_date,'opening_balance_cents',OLD.opening_balance_cents,'last_reconciled_at',OLD.last_reconciled_at)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_statements_update BEFORE UPDATE ON statements
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'statements',OLD.id,json_object('period_start',OLD.period_start,'closing_date',OLD.closing_date,'status',OLD.status,'bank_amount_cents',OLD.bank_amount_cents,'closed_at',OLD.closed_at)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_payees_update BEFORE UPDATE ON payees
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'payees',OLD.id,json_object('merged_into_id',OLD.merged_into_id)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_installment_plans_insert BEFORE INSERT ON installment_plans
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'installment_plans',NEW.id,NULL
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_installment_plans_delete BEFORE DELETE ON installment_plans
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'installment_plans',OLD.id,json_object('id',OLD.id,'account_id',OLD.account_id,'description',OLD.description,'total_cents',OLD.total_cents,'count',OLD.count,'first_date',OLD.first_date,'category_id',OLD.category_id)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_installment_advances_insert BEFORE INSERT ON installment_advances
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'installment_advances',NEW.id,NULL
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_installment_advances_delete BEFORE DELETE ON installment_advances
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'installment_advances',OLD.id,json_object('id',OLD.id,'installment_plan_id',OLD.installment_plan_id,'count',OLD.count,'face_cents',OLD.face_cents,'paid_cents',OLD.paid_cents,'created_at',OLD.created_at)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_recurring_insert BEFORE INSERT ON recurring
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'recurring',NEW.id,NULL
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_recurring_update BEFORE UPDATE ON recurring
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'recurring',OLD.id,json_object('id',OLD.id,'account_id',OLD.account_id,'payee',OLD.payee,'amount_cents',OLD.amount_cents,'category_id',OLD.category_id,'cadence',OLD.cadence,'next_date',OLD.next_date,'is_subscription',OLD.is_subscription,'subscription_type_id',OLD.subscription_type_id,'renewal_date',OLD.renewal_date,'active',OLD.active,'interval_days',OLD.interval_days,'description',OLD.description,'notice_days',OLD.notice_days)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_recurring_delete BEFORE DELETE ON recurring
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'recurring',OLD.id,json_object('id',OLD.id,'account_id',OLD.account_id,'payee',OLD.payee,'amount_cents',OLD.amount_cents,'category_id',OLD.category_id,'cadence',OLD.cadence,'next_date',OLD.next_date,'is_subscription',OLD.is_subscription,'subscription_type_id',OLD.subscription_type_id,'renewal_date',OLD.renewal_date,'active',OLD.active,'interval_days',OLD.interval_days,'description',OLD.description,'notice_days',OLD.notice_days)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_statement_carryovers_insert BEFORE INSERT ON statement_carryovers
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'statement_carryovers',NEW.source_statement_id,NULL
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_statement_carryovers_update BEFORE UPDATE ON statement_carryovers
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'statement_carryovers',OLD.source_statement_id,json_object('source_statement_id',OLD.source_statement_id,'destination_statement_id',OLD.destination_statement_id,'amount_cents',OLD.amount_cents,'created_at',OLD.created_at)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_statement_carryovers_delete BEFORE DELETE ON statement_carryovers
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'statement_carryovers',OLD.source_statement_id,json_object('source_statement_id',OLD.source_statement_id,'destination_statement_id',OLD.destination_statement_id,'amount_cents',OLD.amount_cents,'created_at',OLD.created_at)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_reconciliations_insert BEFORE INSERT ON reconciliations
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'reconciliations',NEW.id,NULL
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_reconciliations_update BEFORE UPDATE ON reconciliations
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'reconciliations',OLD.id,json_object('id',OLD.id,'account_id',OLD.account_id,'date',OLD.date,'bank_balance_cents',OLD.bank_balance_cents,'app_balance_cents',OLD.app_balance_cents,'adjustment_transaction_id',OLD.adjustment_transaction_id)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_reconciliations_delete BEFORE DELETE ON reconciliations
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'reconciliations',OLD.id,json_object('id',OLD.id,'account_id',OLD.account_id,'date',OLD.date,'bank_balance_cents',OLD.bank_balance_cents,'app_balance_cents',OLD.app_balance_cents,'adjustment_transaction_id',OLD.adjustment_transaction_id)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_statement_checks_insert BEFORE INSERT ON statement_checks
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'statement_checks',NEW.id,NULL
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_statement_checks_update BEFORE UPDATE ON statement_checks
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'statement_checks',OLD.id,json_object('id',OLD.id,'statement_id',OLD.statement_id,'app_amount_cents',OLD.app_amount_cents,'bank_amount_cents',OLD.bank_amount_cents,'action',OLD.action,'adjustment_transaction_id',OLD.adjustment_transaction_id,'created_at',OLD.created_at)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_statement_checks_delete BEFORE DELETE ON statement_checks
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'statement_checks',OLD.id,json_object('id',OLD.id,'statement_id',OLD.statement_id,'app_amount_cents',OLD.app_amount_cents,'bank_amount_cents',OLD.bank_amount_cents,'action',OLD.action,'adjustment_transaction_id',OLD.adjustment_transaction_id,'created_at',OLD.created_at)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

DROP TRIGGER transaction_action_finish;
CREATE TRIGGER transaction_action_finish AFTER UPDATE OF complete ON transaction_actions
WHEN NEW.complete=1
BEGIN
 UPDATE transaction_changes SET after_json=(
   SELECT snapshot FROM transaction_snapshots WHERE id=transaction_id
 ) WHERE action_id=NEW.id;
 UPDATE transaction_action_dependencies SET after_json=(
   SELECT snapshot FROM transaction_dependency_snapshots s WHERE s.entity=transaction_action_dependencies.entity AND s.id=entity_id
 ) WHERE action_id=NEW.id;
 DELETE FROM transaction_changes WHERE action_id=NEW.id AND before_json IS after_json;
 DELETE FROM transaction_action_dependencies WHERE action_id=NEW.id AND before_json IS after_json;
 DELETE FROM transaction_action_context WHERE action_id=NEW.id;
 DELETE FROM transaction_actions WHERE id=NEW.id
   AND NOT EXISTS(SELECT 1 FROM transaction_changes WHERE action_id=NEW.id);
END;

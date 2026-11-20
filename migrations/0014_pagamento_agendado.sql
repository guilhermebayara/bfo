-- A movimentação usa a data da transação. A baixa da fatura e o saldo anterior
-- são aplicados uma única vez na mesma operação, quando chega a data civil.
CREATE TABLE scheduled_statement_payments (
 payment_id TEXT PRIMARY KEY NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
 statement_id TEXT NOT NULL REFERENCES statements(id),
 payment_date TEXT NOT NULL,
 total_cents INTEGER NOT NULL,
 bank_amount_before INTEGER,
 carry_statement_id TEXT REFERENCES statements(id),
 carry_cents INTEGER NOT NULL CHECK(carry_cents>=0),
 applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0,1)),
 CHECK((carry_statement_id IS NULL)=(carry_cents=0))
);
CREATE UNIQUE INDEX one_pending_statement_payment ON scheduled_statement_payments(statement_id) WHERE applied=0;
CREATE INDEX due_statement_payments ON scheduled_statement_payments(payment_date) WHERE applied=0;
CREATE INDEX pending_carry_statement ON scheduled_statement_payments(carry_statement_id) WHERE applied=0;

-- Recupera agendamentos futuros já registrados pelo comportamento anterior.
-- O ciclo seguinte já conferido preserva a conferência que o dono registrou.
INSERT INTO scheduled_statement_payments(payment_id,statement_id,payment_date,total_cents,bank_amount_before,carry_statement_id,carry_cents)
 SELECT t.id,s.id,t.date,COALESCE(s.bank_amount_cents,s.total_cents),s.bank_amount_cents,c.destination_statement_id,COALESCE(c.amount_cents,0)
 FROM transactions t JOIN statement_totals s ON s.id=t.statement_id
 LEFT JOIN statement_carryovers c ON c.source_statement_id=s.id
 LEFT JOIN statements target ON target.id=c.destination_statement_id
 WHERE t.kind='card_payment' AND t.date>date('now','-3 hours') AND s.status IN ('closed','paid')
 AND (target.id IS NULL OR target.status='open')
 AND t.id=(SELECT latest.id FROM transactions latest WHERE latest.statement_id=s.id AND latest.kind='card_payment'
   ORDER BY latest.date DESC, latest.rowid DESC LIMIT 1);
DELETE FROM statement_carryovers
 WHERE source_statement_id IN (SELECT statement_id FROM scheduled_statement_payments);
UPDATE statements SET status='closed'
 WHERE id IN (SELECT statement_id FROM scheduled_statement_payments);

DROP VIEW statement_totals;
CREATE VIEW statement_totals AS
 SELECT s.*,
 COALESCE((SELECT SUM(amount_cents) FROM statement_items WHERE statement_id=s.id),0)+COALESCE((SELECT SUM(amount_cents) FROM statement_carryovers WHERE destination_statement_id=s.id),0) AS total_cents,
 COALESCE((SELECT SUM(amount_cents) FROM statement_carryovers WHERE destination_statement_id=s.id),0) AS previous_balance_cents,
 COALESCE((SELECT amount_cents FROM statement_carryovers WHERE source_statement_id=s.id),0) AS carried_out_cents,
 COALESCE((SELECT SUM(card_amount_cents) FROM transactions t WHERE t.statement_id=s.id AND kind='card_payment'
   AND NOT EXISTS(SELECT 1 FROM scheduled_statement_payments p WHERE p.payment_id=t.id AND p.applied=0)),0) AS paid_cents,
 (SELECT payment_date FROM scheduled_statement_payments WHERE statement_id=s.id AND applied=0) AS scheduled_payment_date
 FROM statements s;

CREATE TRIGGER apply_scheduled_statement_payment AFTER UPDATE OF applied ON scheduled_statement_payments
WHEN OLD.applied=0 AND NEW.applied=1
BEGIN
 UPDATE statements SET status=CASE WHEN NEW.carry_cents=0 THEN 'paid' ELSE 'closed' END,
   bank_amount_cents=NEW.total_cents WHERE id=NEW.statement_id;
 INSERT INTO statement_carryovers(source_statement_id,destination_statement_id,amount_cents)
 SELECT NEW.statement_id,NEW.carry_statement_id,NEW.carry_cents WHERE NEW.carry_cents>0;
END;

CREATE TRIGGER reverse_scheduled_statement_payment BEFORE DELETE ON scheduled_statement_payments
WHEN OLD.applied=1
BEGIN
 SELECT RAISE(ABORT,'Reabra a fatura que recebeu o saldo anterior.')
 WHERE EXISTS (
   SELECT 1 FROM statement_carryovers c JOIN statements s ON s.id=c.destination_statement_id
   WHERE c.source_statement_id=OLD.statement_id AND s.status<>'open'
 );
 DELETE FROM statement_carryovers WHERE source_statement_id=OLD.statement_id
   AND destination_statement_id=OLD.carry_statement_id AND amount_cents=OLD.carry_cents;
 UPDATE statements SET status='closed',bank_amount_cents=OLD.bank_amount_before
   WHERE id=OLD.statement_id AND status IN ('closed','paid') AND bank_amount_cents IS OLD.total_cents;
END;

DROP VIEW transaction_dependency_snapshots;
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
 LIMIT -1)
 UNION ALL
 SELECT 'scheduled_statement_payments',payment_id,json_object('payment_id',payment_id,'statement_id',statement_id,'payment_date',payment_date,'total_cents',total_cents,'bank_amount_before',bank_amount_before,'carry_statement_id',carry_statement_id,'carry_cents',carry_cents) FROM scheduled_statement_payments;

CREATE TRIGGER track_action_scheduled_payment_insert BEFORE INSERT ON scheduled_statement_payments
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'scheduled_statement_payments',NEW.payment_id,NULL
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

CREATE TRIGGER track_action_scheduled_payment_delete BEFORE DELETE ON scheduled_statement_payments
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_action_dependencies(action_id,entity,entity_id,before_json)
 SELECT action_id,'scheduled_statement_payments',OLD.payment_id,json_object('payment_id',OLD.payment_id,'statement_id',OLD.statement_id,'payment_date',OLD.payment_date,'total_cents',OLD.total_cents,'bank_amount_before',OLD.bank_amount_before,'carry_statement_id',OLD.carry_statement_id,'carry_cents',OLD.carry_cents)
 FROM transaction_action_context
 WHERE singleton=1
 ON CONFLICT(action_id,entity,entity_id) DO NOTHING;
END;

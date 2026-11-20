-- O contexto existe somente dentro do lote que grava e finaliza a ação.
CREATE TABLE transaction_actions (
 id TEXT PRIMARY KEY NOT NULL,
 source TEXT NOT NULL,
 created_at TEXT NOT NULL,
 complete INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE transaction_action_context (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 action_id TEXT NOT NULL REFERENCES transaction_actions(id)
);
CREATE TABLE transaction_changes (
 action_id TEXT NOT NULL REFERENCES transaction_actions(id),
 transaction_id TEXT NOT NULL,
 before_json TEXT,
 after_json TEXT,
 PRIMARY KEY(action_id, transaction_id)
);
CREATE INDEX transaction_changes_row ON transaction_changes(transaction_id);

CREATE VIEW transaction_snapshots AS
SELECT t.id,json_object(
  'id',t.id,
  'account_id',t.account_id,
  'date',t.date,
  'amount_cents',t.amount_cents,
  'payee',t.payee,
  'category_id',t.category_id,
  'note',t.note,
  'origin',t.origin,
  'kind',t.kind,
  'transfer_pair_id',t.transfer_pair_id,
  'statement_id',t.statement_id,
  'installment_plan_id',t.installment_plan_id,
  'external_id',t.external_id,
  'created_at',t.created_at,
  'activation_account_id',t.activation_account_id,
  'currency',t.currency,
  'fx_rate',t.fx_rate,
  'amount_brl_cents',t.amount_brl_cents,
  'fx_source',t.fx_source,
  'payee_id',t.payee_id,
  'installment_number',t.installment_number,
  'retroactive',t.retroactive,
  'added_to_closed',t.added_to_closed,
  'advance_id',t.advance_id,
  'card_amount_cents',t.card_amount_cents,
  'tag_ids',json(COALESCE((SELECT json_group_array(tag_id) FROM
    (SELECT tag_id FROM transaction_tags WHERE transaction_id=t.id ORDER BY tag_id)),'[]')),
  'splits',json(COALESCE((SELECT json_group_array(json(part)) FROM
    (SELECT json_object('id',p.id,'position',p.position,'amount_cents',p.amount_cents,
      'amount_brl_cents',p.amount_brl_cents,'category_id',p.category_id,'note',p.note,
      'tag_ids',json(COALESCE((SELECT json_group_array(tag_id) FROM
        (SELECT tag_id FROM split_tags WHERE split_id=p.id ORDER BY tag_id)),'[]'))) AS part
      FROM transaction_splits p WHERE p.transaction_id=t.id ORDER BY p.position)),'[]')),
  'recurring_id',(SELECT recurring_id FROM recurring_sources WHERE transaction_id=t.id),
  'cancellation',json((SELECT json_object('reason',reason,'created_at',created_at)
    FROM installment_cancellations WHERE transaction_id=t.id)),
  'effective_payee',COALESCE((SELECT COALESCE(target.name,p.name) FROM payees p
    LEFT JOIN payees target ON target.id=p.merged_into_id WHERE p.id=t.payee_id),t.payee)
) AS snapshot FROM transactions t;

CREATE TRIGGER transaction_action_finish AFTER UPDATE OF complete ON transaction_actions
WHEN NEW.complete=1
BEGIN
 UPDATE transaction_changes SET after_json=(
   SELECT snapshot FROM transaction_snapshots WHERE id=transaction_id
 ) WHERE action_id=NEW.id;
 DELETE FROM transaction_changes WHERE action_id=NEW.id AND before_json IS after_json;
 DELETE FROM transaction_action_context WHERE action_id=NEW.id;
 DELETE FROM transaction_actions WHERE id=NEW.id
   AND NOT EXISTS(SELECT 1 FROM transaction_changes WHERE action_id=NEW.id);
END;

CREATE TRIGGER track_transactions_insert BEFORE INSERT ON transactions
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,NEW.id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=NEW.id
 WHERE NEW.id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_transactions_update BEFORE UPDATE ON transactions
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,OLD.id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=OLD.id
 WHERE OLD.id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_transactions_delete BEFORE DELETE ON transactions
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,OLD.id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=OLD.id
 WHERE OLD.id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_transaction_tags_insert BEFORE INSERT ON transaction_tags
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,NEW.transaction_id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=NEW.transaction_id
 WHERE NEW.transaction_id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_transaction_tags_delete BEFORE DELETE ON transaction_tags
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,OLD.transaction_id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=OLD.transaction_id
 WHERE OLD.transaction_id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_transaction_splits_insert BEFORE INSERT ON transaction_splits
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,NEW.transaction_id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=NEW.transaction_id
 WHERE NEW.transaction_id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_transaction_splits_update BEFORE UPDATE ON transaction_splits
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,OLD.transaction_id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=OLD.transaction_id
 WHERE OLD.transaction_id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_transaction_splits_delete BEFORE DELETE ON transaction_splits
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,OLD.transaction_id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=OLD.transaction_id
 WHERE OLD.transaction_id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_split_tags_insert BEFORE INSERT ON split_tags
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,(SELECT transaction_id FROM transaction_splits WHERE id=NEW.split_id),s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=(SELECT transaction_id FROM transaction_splits WHERE id=NEW.split_id)
 WHERE (SELECT transaction_id FROM transaction_splits WHERE id=NEW.split_id) IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_split_tags_delete BEFORE DELETE ON split_tags
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,(SELECT transaction_id FROM transaction_splits WHERE id=OLD.split_id),s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=(SELECT transaction_id FROM transaction_splits WHERE id=OLD.split_id)
 WHERE (SELECT transaction_id FROM transaction_splits WHERE id=OLD.split_id) IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_recurring_sources_insert BEFORE INSERT ON recurring_sources
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,NEW.transaction_id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=NEW.transaction_id
 WHERE NEW.transaction_id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_recurring_sources_delete BEFORE DELETE ON recurring_sources
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,OLD.transaction_id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=OLD.transaction_id
 WHERE OLD.transaction_id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_installment_cancellations_insert BEFORE INSERT ON installment_cancellations
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,NEW.transaction_id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=NEW.transaction_id
 WHERE NEW.transaction_id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_installment_cancellations_delete BEFORE DELETE ON installment_cancellations
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,OLD.transaction_id,s.snapshot
 FROM transaction_action_context c LEFT JOIN transaction_snapshots s ON s.id=OLD.transaction_id
 WHERE OLD.transaction_id IS NOT NULL
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

CREATE TRIGGER track_payee_merge BEFORE UPDATE OF merged_into_id ON payees
WHEN EXISTS(SELECT 1 FROM transaction_action_context)
BEGIN
 INSERT INTO transaction_changes(action_id,transaction_id,before_json)
 SELECT c.action_id,t.id,s.snapshot
 FROM transaction_action_context c JOIN transactions t ON t.payee_id=OLD.id
 JOIN transaction_snapshots s ON s.id=t.id
 ON CONFLICT(action_id,transaction_id) DO NOTHING;
END;

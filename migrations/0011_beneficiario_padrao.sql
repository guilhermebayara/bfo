-- Padrão de categoria e tags do beneficiário. has_default separa "sem padrão" de um padrão sem categoria.
ALTER TABLE payees ADD COLUMN default_category_id TEXT;
ALTER TABLE payees ADD COLUMN has_default INTEGER NOT NULL DEFAULT 0 CHECK(has_default IN (0,1));
CREATE TABLE payee_default_tags (
 payee_id TEXT NOT NULL REFERENCES payees(id) ON DELETE CASCADE,
 tag_id TEXT NOT NULL REFERENCES tags(id),
 PRIMARY KEY (payee_id, tag_id)
);
CREATE INDEX payee_default_tags_tag ON payee_default_tags(tag_id);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issuer_key VARCHAR(64);
CREATE TABLE IF NOT EXISTS baitly_invoice_issuer_sequences (
 id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL, issuer_key VARCHAR(64) NOT NULL,
 current_year INTEGER NOT NULL, last_number BIGINT NOT NULL DEFAULT 0 CHECK(last_number>=0),
 UNIQUE(organization_id,issuer_key,current_year)
);

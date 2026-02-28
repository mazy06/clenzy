-- V83: Create invoice_number_sequences table
-- Sequential invoice numbering per organization per year (no gaps allowed)

CREATE TABLE invoice_number_sequences (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    prefix          VARCHAR(10) NOT NULL DEFAULT 'FA-',
    current_year    INTEGER NOT NULL,
    last_number     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(organization_id, current_year)
);

CREATE INDEX idx_inv_seq_org_year ON invoice_number_sequences(organization_id, current_year);

-- V81: Create invoices and invoice_lines tables
-- Formal invoicing system for multi-country compliance

CREATE TABLE invoices (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL REFERENCES organizations(id),
    invoice_number      VARCHAR(30) NOT NULL,
    invoice_date        DATE NOT NULL,
    due_date            DATE,
    currency            VARCHAR(3) NOT NULL DEFAULT 'EUR',
    country_code        VARCHAR(3) NOT NULL DEFAULT 'FR',
    total_ht            DECIMAL(12,2) NOT NULL,
    total_tax           DECIMAL(12,2) NOT NULL,
    total_ttc           DECIMAL(12,2) NOT NULL,
    seller_name         VARCHAR(200),
    seller_address      TEXT,
    seller_tax_id       VARCHAR(50),
    buyer_name          VARCHAR(200),
    buyer_address       TEXT,
    buyer_tax_id        VARCHAR(50),
    reservation_id      BIGINT REFERENCES reservations(id),
    payout_id           BIGINT REFERENCES owner_payouts(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    legal_mentions      TEXT,
    qr_code_data        TEXT,
    xml_content         TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, invoice_number)
);

CREATE INDEX idx_invoice_org ON invoices(organization_id);
CREATE INDEX idx_invoice_status ON invoices(status);
CREATE INDEX idx_invoice_date ON invoices(invoice_date);
CREATE INDEX idx_invoice_reservation ON invoices(reservation_id);

CREATE TABLE invoice_lines (
    id              BIGSERIAL PRIMARY KEY,
    invoice_id      BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_number     INTEGER NOT NULL,
    description     VARCHAR(500) NOT NULL,
    quantity        DECIMAL(10,3) NOT NULL DEFAULT 1,
    unit_price_ht   DECIMAL(10,2) NOT NULL,
    tax_category    VARCHAR(30) NOT NULL,
    tax_rate        DECIMAL(5,4) NOT NULL,
    tax_amount      DECIMAL(10,2) NOT NULL,
    total_ht        DECIMAL(10,2) NOT NULL,
    total_ttc       DECIMAL(10,2) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id);

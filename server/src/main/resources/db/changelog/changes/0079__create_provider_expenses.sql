-- Table de suivi des depenses prestataires (societe de menage, maintenance, etc.)
-- Les depenses sont rattachees a un logement et deduites du payout proprietaire.

CREATE TABLE IF NOT EXISTS provider_expenses (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT       NOT NULL,
    provider_id     BIGINT       NOT NULL REFERENCES users(id),
    property_id     BIGINT       NOT NULL REFERENCES properties(id),
    intervention_id BIGINT                REFERENCES interventions(id),
    owner_payout_id BIGINT                REFERENCES owner_payouts(id),

    description     VARCHAR(500) NOT NULL,
    amount_ht       DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate        DECIMAL(5,4)  NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount_ttc      DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency        VARCHAR(3)    NOT NULL DEFAULT 'EUR',

    category        VARCHAR(30)   NOT NULL
        CHECK (category IN ('CLEANING','MAINTENANCE','LAUNDRY','SUPPLIES','LANDSCAPING','OTHER')),
    expense_date    DATE          NOT NULL,
    status          VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','APPROVED','INCLUDED','PAID','CANCELLED')),

    invoice_reference VARCHAR(100),
    receipt_path      VARCHAR(500),
    notes             TEXT,
    payment_reference VARCHAR(255),

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_org_id       ON provider_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_pe_provider_id  ON provider_expenses(provider_id);
CREATE INDEX IF NOT EXISTS idx_pe_property_id  ON provider_expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_pe_status       ON provider_expenses(status);
CREATE INDEX IF NOT EXISTS idx_pe_payout_id    ON provider_expenses(owner_payout_id);
CREATE INDEX IF NOT EXISTS idx_pe_expense_date ON provider_expenses(expense_date);

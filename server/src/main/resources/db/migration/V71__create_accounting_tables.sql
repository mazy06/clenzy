-- V71: Accounting tables - Owner payouts and Channel commissions

CREATE TABLE IF NOT EXISTS owner_payouts (
    id                BIGSERIAL PRIMARY KEY,
    organization_id   BIGINT       NOT NULL REFERENCES organizations(id),
    owner_id          BIGINT       NOT NULL REFERENCES users(id),
    period_start      DATE         NOT NULL,
    period_end        DATE         NOT NULL,
    gross_revenue     DECIMAL(10,2) NOT NULL DEFAULT 0,
    commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    commission_rate   DECIMAL(5,4) NOT NULL,
    expenses          DECIMAL(10,2) DEFAULT 0,
    net_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
    status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    payment_reference VARCHAR(255),
    paid_at           TIMESTAMP WITH TIME ZONE,
    notes             TEXT,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_owner_payouts_org_owner ON owner_payouts(organization_id, owner_id);
CREATE INDEX idx_owner_payouts_status ON owner_payouts(status);
CREATE INDEX idx_owner_payouts_period ON owner_payouts(period_start, period_end);

CREATE TABLE IF NOT EXISTS channel_commissions (
    id                BIGSERIAL PRIMARY KEY,
    organization_id   BIGINT       NOT NULL REFERENCES organizations(id),
    channel_name      VARCHAR(50)  NOT NULL,
    commission_rate   DECIMAL(5,4) NOT NULL,
    vat_rate          DECIMAL(5,4),
    is_guest_facing   BOOLEAN      DEFAULT false,
    notes             TEXT,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_channel_commissions_org_channel ON channel_commissions(organization_id, channel_name);

CREATE TABLE baitly_subscription_funding (
    invoice_id VARCHAR(255) PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    subscription_id VARCHAR(255) NOT NULL,
    period_end TIMESTAMPTZ,
    paid_cents BIGINT NOT NULL CHECK(paid_cents>=0),
    refunded_cents BIGINT NOT NULL CHECK(refunded_cents>=0),
    held_cents BIGINT NOT NULL CHECK(held_cents>=refunded_cents AND held_cents<=paid_cents),
    disputed BOOLEAN NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX baitly_subscription_funding_access ON baitly_subscription_funding(organization_id,subscription_id,period_end);

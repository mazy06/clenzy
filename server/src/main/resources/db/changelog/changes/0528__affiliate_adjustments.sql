CREATE TABLE baitly_affiliate_adjustments (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    commission_id BIGINT NOT NULL REFERENCES activity_commissions(id),
    request_id UUID NOT NULL,
    basis_gross NUMERIC(12,2) NOT NULL CHECK(basis_gross>0),
    basis_host NUMERIC(12,2) NOT NULL CHECK(basis_host>=0 AND basis_host<=basis_gross),
    before_gross NUMERIC(12,2) NOT NULL CHECK(before_gross>=0),
    after_gross NUMERIC(12,2) NOT NULL CHECK(after_gross>=0),
    before_host NUMERIC(12,2) NOT NULL CHECK(before_host>=0 AND before_host<=before_gross),
    after_host NUMERIC(12,2) NOT NULL CHECK(after_host>=0 AND after_host<=after_gross),
    currency VARCHAR(3) NOT NULL, proof VARCHAR(255) NOT NULL, reason VARCHAR(1000) NOT NULL, actor VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id,request_id)
);
CREATE INDEX baitly_affiliate_adjustment_history ON baitly_affiliate_adjustments(organization_id,commission_id,id);

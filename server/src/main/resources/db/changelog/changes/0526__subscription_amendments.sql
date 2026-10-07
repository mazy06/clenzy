CREATE TABLE baitly_subscription_amendments (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    order_id BIGINT NOT NULL REFERENCES baitly_subscription_orders(id),
    request_id UUID NOT NULL,
    terms JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PREPARED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_invoice_id VARCHAR(255),
    UNIQUE(organization_id,request_id),
    CONSTRAINT baitly_subscription_amendment_status CHECK(status IN ('PREPARED','SCHEDULED','APPLIED','CANCELLED'))
);
CREATE UNIQUE INDEX baitly_subscription_one_pending_amendment ON baitly_subscription_amendments(order_id)
    WHERE status IN ('PREPARED','SCHEDULED');

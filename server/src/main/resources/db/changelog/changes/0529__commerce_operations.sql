CREATE TABLE baitly_commerce_operations (
    id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL,
    source VARCHAR(30) NOT NULL CHECK(source IN ('UPSELL','HARDWARE_ORDER')), source_id BIGINT NOT NULL,
    request_id UUID NOT NULL, action VARCHAR(30) NOT NULL,
    proof VARCHAR(255) NOT NULL, note VARCHAR(1000) NOT NULL, actor VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(organization_id,request_id)
);
CREATE INDEX baitly_commerce_operations_history ON baitly_commerce_operations(organization_id,source,source_id,id);

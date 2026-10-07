CREATE TABLE baitly_purchase_requests (
    id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL, request_id UUID NOT NULL,
    source VARCHAR(30) NOT NULL CHECK(source IN ('UPSELL','HARDWARE_ORDER')), source_id BIGINT NOT NULL,
    fingerprint VARCHAR(64) NOT NULL, UNIQUE(organization_id,request_id)
);

-- ============================================================================
-- 0102 : Create booking service categories and items tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_service_categories (
    id              BIGSERIAL       PRIMARY KEY,
    organization_id BIGINT          NOT NULL REFERENCES organizations(id),
    name            VARCHAR(300)    NOT NULL,
    description     TEXT,
    sort_order      INT             NOT NULL DEFAULT 0,
    active          BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bsc_org_sort ON booking_service_categories(organization_id, sort_order);

CREATE TABLE IF NOT EXISTS booking_service_items (
    id              BIGSERIAL       PRIMARY KEY,
    category_id     BIGINT          NOT NULL REFERENCES booking_service_categories(id) ON DELETE CASCADE,
    organization_id BIGINT          NOT NULL REFERENCES organizations(id),
    name            VARCHAR(300)    NOT NULL,
    description     TEXT,
    price           DECIMAL(10,2)   NOT NULL DEFAULT 0,
    pricing_mode    VARCHAR(20)     NOT NULL DEFAULT 'PER_BOOKING'
                    CHECK (pricing_mode IN ('PER_BOOKING', 'PER_PERSON', 'PER_NIGHT')),
    input_type      VARCHAR(20)     NOT NULL DEFAULT 'CHECKBOX'
                    CHECK (input_type IN ('QUANTITY', 'CHECKBOX')),
    max_quantity    INT             DEFAULT 10,
    mandatory       BOOLEAN         NOT NULL DEFAULT FALSE,
    sort_order      INT             NOT NULL DEFAULT 0,
    active          BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bsi_cat_sort ON booking_service_items(category_id, sort_order);
CREATE INDEX idx_bsi_org ON booking_service_items(organization_id);

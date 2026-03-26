-- 0095 : Create hardware_orders table for IoT shop

CREATE TABLE hardware_orders (
    id                       BIGSERIAL PRIMARY KEY,
    organization_id          BIGINT NOT NULL,
    user_id                  VARCHAR(255) NOT NULL,
    stripe_session_id        VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    status                   VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_amount             INT NOT NULL,
    currency                 VARCHAR(3) NOT NULL DEFAULT 'eur',
    items_json               JSONB NOT NULL,
    shipping_name            VARCHAR(255),
    shipping_address         TEXT,
    shipping_city            VARCHAR(100),
    shipping_postal_code     VARCHAR(20),
    shipping_country         VARCHAR(2),
    created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hardware_orders_org ON hardware_orders(organization_id);
CREATE INDEX idx_hardware_orders_stripe ON hardware_orders(stripe_session_id);

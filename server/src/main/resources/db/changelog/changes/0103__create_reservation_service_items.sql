-- ============================================================================
-- 0103 : Create reservation service items table + add service_options_total to reservations
-- ============================================================================

CREATE TABLE IF NOT EXISTS reservation_service_items (
    id                  BIGSERIAL       PRIMARY KEY,
    reservation_id      BIGINT          NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    service_item_id     BIGINT          REFERENCES booking_service_items(id),
    service_item_name   VARCHAR(300)    NOT NULL,
    quantity            INT             NOT NULL DEFAULT 1,
    unit_price          DECIMAL(10,2)   NOT NULL,
    pricing_mode        VARCHAR(20)     NOT NULL,
    total_price         DECIMAL(10,2)   NOT NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rsi_reservation ON reservation_service_items(reservation_id);

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS service_options_total DECIMAL(10,2) NOT NULL DEFAULT 0;

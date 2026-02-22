-- =====================================================
-- V25: Table des reservations (iCal, Airbnb, Booking, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS reservations (
    id              BIGSERIAL PRIMARY KEY,
    property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_name      VARCHAR(200),
    guest_count     INTEGER DEFAULT 1,
    check_in        DATE NOT NULL,
    check_out       DATE NOT NULL,
    check_in_time   VARCHAR(5),
    check_out_time  VARCHAR(5),
    status          VARCHAR(30) NOT NULL DEFAULT 'confirmed',
    source          VARCHAR(30) NOT NULL DEFAULT 'other',
    source_name     VARCHAR(100),
    total_price     NUMERIC(10,2) DEFAULT 0,
    confirmation_code VARCHAR(100),
    external_uid    VARCHAR(500),
    notes           TEXT,
    intervention_id BIGINT REFERENCES interventions(id) ON DELETE SET NULL,
    ical_feed_id    BIGINT REFERENCES ical_feeds(id) ON DELETE SET NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Index pour les requetes frequentes
CREATE INDEX IF NOT EXISTS idx_reservations_property_id ON reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_check_in ON reservations(check_in);
CREATE INDEX IF NOT EXISTS idx_reservations_check_out ON reservations(check_out);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_external_uid ON reservations(external_uid);
CREATE INDEX IF NOT EXISTS idx_reservations_ical_feed_id ON reservations(ical_feed_id);

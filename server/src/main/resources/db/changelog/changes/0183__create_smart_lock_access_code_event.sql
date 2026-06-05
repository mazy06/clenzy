-- ============================================================================
-- 0183 : Journal d'audit des codes d'acces de serrures
-- ============================================================================
-- Trace genere / revoque / expire / delivre au voyageur / echec. Meme pattern
-- que key_exchange_events. Le PIN n'est JAMAIS stocke ici (secret d'acces).
-- ============================================================================

CREATE TABLE smart_lock_access_code_event (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT,
    code_id             BIGINT,
    device_id           BIGINT,
    reservation_id      BIGINT,
    property_id         BIGINT,
    event_type          VARCHAR(30) NOT NULL,
    actor_name          VARCHAR(255),
    notes               TEXT,
    source              VARCHAR(20) NOT NULL DEFAULT 'AUTO_RESERVATION',
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_slace_type CHECK (event_type IN (
        'CODE_GENERATED','CODE_REVOKED','CODE_EXPIRED',
        'CODE_DELIVERED','DELIVERY_FAILED','GENERATION_FAILED')),
    CONSTRAINT chk_slace_source CHECK (source IN ('AUTO_RESERVATION','MANUAL'))
);

CREATE INDEX idx_slace_org ON smart_lock_access_code_event(organization_id);
CREATE INDEX idx_slace_property ON smart_lock_access_code_event(property_id);
CREATE INDEX idx_slace_device ON smart_lock_access_code_event(device_id);
CREATE INDEX idx_slace_reservation ON smart_lock_access_code_event(reservation_id);
CREATE INDEX idx_slace_code ON smart_lock_access_code_event(code_id);
CREATE INDEX idx_slace_type ON smart_lock_access_code_event(event_type);
CREATE INDEX idx_slace_created ON smart_lock_access_code_event(created_at DESC);

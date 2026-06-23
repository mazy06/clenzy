-- Demandes de réservation (« devis ») du booking engine public — parcours « Demande de devis »
-- (sans paiement immédiat). Org-scopé ; le host est notifié et répond hors ligne.
CREATE TABLE IF NOT EXISTS booking_inquiries (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id     BIGINT,
    check_in        DATE,
    check_out       DATE,
    guests          INTEGER,
    name            VARCHAR(200),
    email           VARCHAR(320) NOT NULL,
    phone           VARCHAR(40),
    message         TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'NEW',
    created_at      TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_inquiry_org ON booking_inquiries (organization_id);

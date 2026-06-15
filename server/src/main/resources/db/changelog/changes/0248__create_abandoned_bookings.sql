-- Récupération de panier abandonné (CLZ Domaine 2). Snapshot d'une réservation PENDING expirée
-- (non payée) avec l'email du voyageur, pour déclencher un email de relance unique.

CREATE TABLE abandoned_bookings (
    id               BIGSERIAL    PRIMARY KEY,
    organization_id  BIGINT       NOT NULL,
    reservation_id   BIGINT       NOT NULL,
    property_id      BIGINT,
    property_name    VARCHAR(255),
    guest_email      VARCHAR(320) NOT NULL,
    guest_name       VARCHAR(200),
    check_in         DATE,
    check_out        DATE,
    guests           INTEGER,
    total            NUMERIC(12,2),
    currency         VARCHAR(3),
    status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    recovery_sent_at TIMESTAMPTZ
);

ALTER TABLE abandoned_bookings
    ADD CONSTRAINT uq_abandoned_bookings_org_reservation UNIQUE (organization_id, reservation_id);

-- Selection des paniers a relancer (scheduler).
CREATE INDEX idx_abandoned_bookings_due ON abandoned_bookings (status, created_at);

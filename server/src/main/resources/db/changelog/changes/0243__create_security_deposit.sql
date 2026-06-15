-- Phase 4 (différenciation) : caution / dépôt de garantie par réservation.
-- Transition de statut par CAS ; unicité (org, réservation) = idempotence + garde-fou (audit #8).

CREATE TABLE IF NOT EXISTS security_deposits (
    id               BIGSERIAL PRIMARY KEY,
    organization_id  BIGINT        NOT NULL,
    reservation_id   BIGINT        NOT NULL,
    amount           NUMERIC(12,2) NOT NULL,
    captured_amount  NUMERIC(12,2),
    currency         VARCHAR(3),
    status           VARCHAR(16)   NOT NULL DEFAULT 'PENDING',
    external_ref     VARCHAR(128),
    reason           VARCHAR(512),
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_security_deposit_org_reservation UNIQUE (organization_id, reservation_id)
);

CREATE INDEX IF NOT EXISTS idx_security_deposit_reservation
    ON security_deposits (organization_id, reservation_id);

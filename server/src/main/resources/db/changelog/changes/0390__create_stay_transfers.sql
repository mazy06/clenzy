-- M11 v2 (modèles métier constellation) : propositions de relogement avec accord
-- EXPLICITE du voyageur. La carte RELODGE_TRANSFER ne déménage plus d'office :
-- « Proposer » crée une ligne PROPOSED + email avec lien de confirmation ; le
-- transfert (chemin canonique ReservationService.relodge : calendrier, ménage,
-- codes) ne s'exécute qu'au clic du voyageur. Historique/audit des transferts.
CREATE TABLE IF NOT EXISTS stay_transfers (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    reservation_id BIGINT NOT NULL,
    from_property_id BIGINT NOT NULL,
    to_property_id BIGINT NOT NULL,
    reason TEXT,
    price_delta NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED',
    confirm_token UUID NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    proposed_by VARCHAR(120),
    confirmed_at TIMESTAMP,
    executed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stay_transfers_token ON stay_transfers (confirm_token);
CREATE INDEX IF NOT EXISTS idx_stay_transfers_org_reservation
    ON stay_transfers (organization_id, reservation_id, status);

-- STAY_MODIFICATION v2 (vague M-D) : avenants de séjour avec accord EXPLICITE du
-- voyageur. La carte n'envoie plus seulement un chiffrage : elle PROPOSE l'avenant
-- (email + lien). À l'accord, les dates sont replanifiées par le chemin canonique
-- (calendrier atomique, ménage décalé, codes régénérés) et le total RE-calculé
-- serveur est appliqué ; trop-perçu remboursé automatiquement (Stripe), complément
-- demandé au voyageur et suivi côté hôte (l'encaissement automatisé d'un montant
-- arbitraire attend la vague 2 du chantier paiement multi-provider).
CREATE TABLE IF NOT EXISTS stay_modifications (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    reservation_id BIGINT NOT NULL,
    new_check_in DATE NOT NULL,
    new_check_out DATE NOT NULL,
    old_total NUMERIC(10,2),
    new_total NUMERIC(10,2),
    price_delta NUMERIC(10,2),
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_stay_modifications_token ON stay_modifications (confirm_token);
CREATE INDEX IF NOT EXISTS idx_stay_modifications_org_reservation
    ON stay_modifications (organization_id, reservation_id, status);

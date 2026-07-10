-- Moteur Ménage (Phase 2A) — tarifs du prestataire (pattern Turno).
-- Une ligne (org, user, property NULL, HOURLY) = taux horaire général du pro.
-- Une ligne (org, user, property, FLAT)        = forfait pour CE logement, qui
-- PRIME sur le taux horaire dans le résolveur. Le forfait est exprimé pour le
-- ménage STANDARD (CLEANING) ; les autres types se dérivent par le ratio des
-- multiplicateurs du moteur (express 0.65×, deep 1.6× par défaut).
CREATE TABLE IF NOT EXISTS housekeeper_rates (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    property_id BIGINT,
    amount NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(10) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP
);

-- Un seul tarif par couple (org, user, property). property_id NULL = tarif
-- général : l'unicité NULL exige un index partiel dédié (PG traite NULL <> NULL).
CREATE UNIQUE INDEX IF NOT EXISTS housekeeper_rates_org_user_prop_unique
    ON housekeeper_rates (organization_id, user_id, property_id)
    WHERE property_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS housekeeper_rates_org_user_general_unique
    ON housekeeper_rates (organization_id, user_id)
    WHERE property_id IS NULL;
CREATE INDEX IF NOT EXISTS housekeeper_rates_user_idx
    ON housekeeper_rates (user_id);

COMMENT ON TABLE housekeeper_rates IS
    'Tarifs prestataire menage : taux horaire general (property NULL) ou forfait par logement (prime). Moteur Menage 2A';

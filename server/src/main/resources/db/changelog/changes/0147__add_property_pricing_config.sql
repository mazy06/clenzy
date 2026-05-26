-- ============================================================================
-- 0147 : Pricing config par propriete + cache d'estimation empirique
-- ----------------------------------------------------------------------------
-- Deux tables :
--
--   property_pricing_config : override manuel par l'owner (priorite la plus haute)
--     elasticity_override double precision NULL : si renseigne, SimulationService
--     utilise cette valeur sans appel a l'estimator empirique.
--
--   property_elasticity_estimate : cache de l'elasticite calculee empiriquement
--     par EmpiricalElasticityEstimator (regression simple sur 12 mois de
--     reservations). Recalcule hebdo par ElasticityRecomputeScheduler. Sert de
--     fallback quand pas d'override mais qu'on a assez de donnees historiques.
--
-- Ordre de resolution (SimulationService) :
--   1) property_pricing_config.elasticity_override (si non-null)
--   2) property_elasticity_estimate.elasticity_value (si sample_size >= 3)
--   3) DEFAULT_ELASTICITY = 0.5
-- ============================================================================

-- ─── property_pricing_config ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS property_pricing_config (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL UNIQUE
        REFERENCES property(id) ON DELETE CASCADE,
    elasticity_override DOUBLE PRECISION,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_elasticity_override_range CHECK (
        elasticity_override IS NULL
        OR (elasticity_override >= 0.0 AND elasticity_override <= 3.0)
    )
);

COMMENT ON TABLE property_pricing_config IS
    'Override manuel des parametres pricing par propriete. Une seule ligne par property_id (UNIQUE).';
COMMENT ON COLUMN property_pricing_config.elasticity_override IS
    'Elasticite prix-demande (typiquement 0.3 a 1.0). NULL = utiliser l''estimation empirique ou le defaut.';

-- ─── property_elasticity_estimate ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS property_elasticity_estimate (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL UNIQUE
        REFERENCES property(id) ON DELETE CASCADE,
    elasticity_value DOUBLE PRECISION NOT NULL,
    sample_size INT NOT NULL,
    computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_property_elasticity_computed_at
    ON property_elasticity_estimate (computed_at);

COMMENT ON TABLE property_elasticity_estimate IS
    'Cache de l''elasticite estimee empiriquement (regression sur 12 mois de donnees). Maj hebdo par ElasticityRecomputeScheduler.';
COMMENT ON COLUMN property_elasticity_estimate.sample_size IS
    'Nombre de paires (delta_price%, delta_occupancy%) utilisees pour le calcul. Doit etre >= 3 pour etre fiable.';

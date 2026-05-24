-- ============================================================================
-- 0131 : Price source of truth + table de detection des drifts OTA
-- ----------------------------------------------------------------------------
-- Contexte (Phase 3 OTA pricing) :
-- Apres l'import initial, l'host peut continuer a modifier ses prix dans
-- l'OTA (Airbnb). Si Clenzy continue de pousser ses propres prix (PriceEngine),
-- on a un conflit silencieux : qui a raison ?
--
-- Cette migration introduit :
--   1. Un champ `price_source_of_truth` sur properties (CLENZY | OTA | MANUAL)
--      pour declarer qui pilote les prix sur chaque property
--   2. Une table `channex_price_drifts` qui persiste les ecarts detectes par
--      le ChannexRatesReconciliationScheduler, avec resolution manuelle par l'admin
--
-- Defaut : CLENZY (comportement actuel : Clenzy push, OTA suit). L'admin
-- peut passer une property en mode OTA pour la rendre read-only cote sync.
-- ============================================================================

-- ─── 1. properties.price_source_of_truth ────────────────────────────────────
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS price_source_of_truth VARCHAR(10)
        NOT NULL DEFAULT 'CLENZY'
        CHECK (price_source_of_truth IN ('CLENZY', 'OTA', 'MANUAL'));

COMMENT ON COLUMN properties.price_source_of_truth IS
    'Pilote des prix nuit : CLENZY (PriceEngine push vers OTA), '
    'OTA (Channex pull vers RateOverride, push desactive), '
    'MANUAL (aucune sync auto, admin gere a la main).';

-- ─── 2. channex_price_drifts (detections du watchdog) ───────────────────────
CREATE TABLE IF NOT EXISTS channex_price_drifts (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    clenzy_property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    mapping_id UUID NOT NULL,
    drift_date DATE NOT NULL,
    clenzy_price DECIMAL(10, 2) NOT NULL,
    ota_price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution VARCHAR(20),
    resolved_by VARCHAR(255),
    CONSTRAINT chk_channex_price_drift_resolution
        CHECK (resolution IS NULL OR resolution IN ('KEEP_CLENZY', 'KEEP_OTA', 'DISMISSED')),
    CONSTRAINT uq_channex_price_drift_unresolved
        UNIQUE (clenzy_property_id, drift_date)
);

CREATE INDEX IF NOT EXISTS idx_channex_price_drifts_org_unresolved
    ON channex_price_drifts (organization_id, detected_at DESC)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_channex_price_drifts_property_history
    ON channex_price_drifts (clenzy_property_id, drift_date DESC);

COMMENT ON TABLE channex_price_drifts IS
    'Ecarts de prix Clenzy vs OTA detectes par ChannexRatesReconciliationScheduler. '
    'Resolution manuelle par l admin : KEEP_CLENZY (push force), KEEP_OTA (overwrite '
    'RateOverride local), DISMISSED (ignore l ecart, ex: difference attendue).';
COMMENT ON COLUMN channex_price_drifts.drift_date IS
    'Date sur laquelle les prix divergent (pas la date de detection).';
COMMENT ON COLUMN channex_price_drifts.clenzy_price IS
    'Prix resolu par PriceEngine au moment du scan.';
COMMENT ON COLUMN channex_price_drifts.ota_price IS
    'Prix retourne par Channex GET /restrictions au moment du scan.';

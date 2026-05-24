-- ============================================================================
-- 0129 : Channex sync logs (Phase 3 — historique des push par property)
-- ----------------------------------------------------------------------------
-- Contexte : jusqu'a present les details des push Channex (success/fail, count,
-- duree, message d'erreur) etaient uniquement dans les logs applicatifs.
-- Cette table persiste un historique consultable depuis l'UI Clenzy pour :
--   - Diagnostiquer les patterns d'echec recurrents par property
--   - Repondre a "quand a-t-on push pour la derniere fois ?" sans grep
--   - Fournir une base pour des alertes (X echecs consecutifs sur la meme prop)
--
-- Indexes :
--   - (organization_id, clenzy_property_id, started_at DESC) : query UI
--     "logs de cette property les plus recents"
--   - (status) : query alerting "tous les FAIL des dernieres 24h"
-- ============================================================================

CREATE TABLE IF NOT EXISTS channex_sync_logs (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    clenzy_property_id BIGINT NOT NULL,
    mapping_id UUID,
    sync_type VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    duration_ms BIGINT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    CONSTRAINT chk_channex_sync_log_status
        CHECK (status IN ('SUCCESS', 'FAIL', 'SKIPPED'))
);

CREATE INDEX IF NOT EXISTS idx_channex_sync_logs_property
    ON channex_sync_logs (organization_id, clenzy_property_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_channex_sync_logs_status
    ON channex_sync_logs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_channex_sync_logs_mapping
    ON channex_sync_logs (mapping_id, started_at DESC);

COMMENT ON TABLE channex_sync_logs IS
    'Historique des operations Channex sync (push avail/rates, pull bookings, etc).';
COMMENT ON COLUMN channex_sync_logs.sync_type IS
    'PUSH_AVAILABILITY | PUSH_RATES | PUSH_PROPERTY | PULL_BOOKINGS | RESYNC_CONTENT';
COMMENT ON COLUMN channex_sync_logs.status IS
    'SUCCESS=push reussi · FAIL=erreur API · SKIPPED=no-op (ex: pas d OTA actif)';
COMMENT ON COLUMN channex_sync_logs.record_count IS
    'Nombre d updates pushes / bookings importes selon le sync_type.';

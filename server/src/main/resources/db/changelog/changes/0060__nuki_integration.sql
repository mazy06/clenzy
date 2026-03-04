-- ============================================================================
-- 0060 : Nuki smart lock integration
-- ============================================================================
-- 1. Table nuki_connections (OAuth tokens chiffres par organisation)
-- 2. Colonne brand sur smart_lock_devices (TUYA par defaut)
-- ============================================================================

-- ─── 1. Table nuki_connections ──────────────────────────────────

CREATE TABLE nuki_connections (
    id                      BIGSERIAL PRIMARY KEY,
    organization_id         BIGINT NOT NULL,
    user_id                 VARCHAR(255) NOT NULL,
    access_token_encrypted  TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at        TIMESTAMP,
    status                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED', 'ERROR')),
    connected_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_sync_at            TIMESTAMP,
    error_message           TEXT,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP
);

CREATE INDEX idx_nuki_conn_org_id ON nuki_connections(organization_id);
CREATE INDEX idx_nuki_conn_status ON nuki_connections(status);

-- ─── 2. Colonne brand sur smart_lock_devices ────────────────────

ALTER TABLE smart_lock_devices
    ADD COLUMN IF NOT EXISTS brand VARCHAR(20) DEFAULT 'TUYA';

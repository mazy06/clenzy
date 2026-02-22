-- ====================================================================
-- V52 : Tables ChannelConnector abstraction layer (G9)
--
-- Tables :
--   1. channel_connections   — connexion generique org <-> channel
--   2. channel_mappings      — mapping property <-> listing channel
--   3. channel_sync_log      — audit des syncs INBOUND/OUTBOUND
-- ====================================================================

-- ============================
-- 1. Table channel_connections
-- ============================
CREATE TABLE channel_connections (
    id                    BIGSERIAL PRIMARY KEY,
    organization_id       BIGINT NOT NULL REFERENCES organizations(id),
    channel               VARCHAR(30) NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    credentials_ref       VARCHAR(255),
    webhook_url           TEXT,
    sync_config           JSONB,
    last_sync_at          TIMESTAMP,
    last_error            TEXT,
    created_at            TIMESTAMP NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_channel_connections_org ON channel_connections(organization_id);
CREATE UNIQUE INDEX idx_channel_connections_org_channel
    ON channel_connections(organization_id, channel);

-- ============================
-- 2. Table channel_mappings
-- ============================
CREATE TABLE channel_mappings (
    id                    BIGSERIAL PRIMARY KEY,
    connection_id         BIGINT NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
    entity_type           VARCHAR(30) NOT NULL DEFAULT 'PROPERTY',
    internal_id           BIGINT NOT NULL,
    external_id           VARCHAR(200) NOT NULL,
    mapping_config        JSONB,
    sync_enabled          BOOLEAN NOT NULL DEFAULT true,
    last_sync_at          TIMESTAMP,
    last_sync_status      VARCHAR(30),
    organization_id       BIGINT NOT NULL REFERENCES organizations(id),
    created_at            TIMESTAMP NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_channel_mapping_conn_entity
        UNIQUE(connection_id, entity_type, internal_id),
    CONSTRAINT uq_channel_mapping_conn_external
        UNIQUE(connection_id, entity_type, external_id)
);
CREATE INDEX idx_channel_mappings_internal ON channel_mappings(internal_id, entity_type);
CREATE INDEX idx_channel_mappings_org ON channel_mappings(organization_id);

-- ============================
-- 3. Table channel_sync_log
-- ============================
CREATE TABLE channel_sync_log (
    id                    BIGSERIAL PRIMARY KEY,
    organization_id       BIGINT NOT NULL REFERENCES organizations(id),
    connection_id         BIGINT NOT NULL REFERENCES channel_connections(id),
    mapping_id            BIGINT REFERENCES channel_mappings(id),
    direction             VARCHAR(10) NOT NULL,
    event_type            VARCHAR(50) NOT NULL,
    status                VARCHAR(20) NOT NULL,
    details               TEXT,
    error_message         TEXT,
    duration_ms           INTEGER,
    created_at            TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_channel_sync_log_conn ON channel_sync_log(connection_id, created_at DESC);
CREATE INDEX idx_channel_sync_log_mapping ON channel_sync_log(mapping_id, created_at DESC);

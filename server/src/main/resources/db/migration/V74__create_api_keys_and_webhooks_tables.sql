-- V74: Public API - API Keys and Webhook Configurations

CREATE TABLE IF NOT EXISTS api_keys (
    id                      BIGSERIAL PRIMARY KEY,
    organization_id         BIGINT       NOT NULL REFERENCES organizations(id),
    key_name                VARCHAR(100) NOT NULL,
    key_prefix              VARCHAR(8)   NOT NULL,
    key_hash                VARCHAR(255) NOT NULL UNIQUE,
    status                  VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    scopes                  TEXT,
    rate_limit_per_minute   INTEGER      DEFAULT 60,
    last_used_at            TIMESTAMP WITH TIME ZONE,
    expires_at              TIMESTAMP WITH TIME ZONE,
    created_by              BIGINT       REFERENCES users(id),
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at              TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_status ON api_keys(status);

CREATE TABLE IF NOT EXISTS webhook_configs (
    id                      BIGSERIAL PRIMARY KEY,
    organization_id         BIGINT       NOT NULL REFERENCES organizations(id),
    url                     VARCHAR(500) NOT NULL,
    secret_hash             VARCHAR(255) NOT NULL,
    events                  TEXT         NOT NULL,
    status                  VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    failure_count           INTEGER      DEFAULT 0,
    last_triggered_at       TIMESTAMP WITH TIME ZONE,
    last_failure_at         TIMESTAMP WITH TIME ZONE,
    last_failure_reason     TEXT,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_configs_org ON webhook_configs(organization_id);
CREATE INDEX idx_webhook_configs_status ON webhook_configs(status);

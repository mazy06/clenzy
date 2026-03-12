-- ============================================================================
-- 0073 : Per-organization AI API keys (BYOK)
-- ============================================================================
-- Allows organizations to bring their own OpenAI/Anthropic API keys.
-- Keys are encrypted at rest using EncryptedFieldConverter (Jasypt AES-256).
-- When an org has its own key, it takes precedence over the platform key.
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_ai_api_keys (
    id                  BIGSERIAL       PRIMARY KEY,
    organization_id     BIGINT          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider            VARCHAR(30)     NOT NULL,
    api_key             TEXT            NOT NULL,
    model_override      VARCHAR(100),
    is_valid            BOOLEAN         NOT NULL DEFAULT FALSE,
    last_validated_at   TIMESTAMP,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_org_ai_api_keys_org_provider UNIQUE (organization_id, provider)
);

CREATE INDEX idx_org_ai_api_keys_org ON org_ai_api_keys (organization_id);

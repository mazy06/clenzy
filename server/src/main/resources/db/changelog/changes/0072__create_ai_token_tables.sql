-- ============================================================================
-- 0072 : AI Token Budget & Usage tracking tables
-- ============================================================================
-- Tables pour le suivi de la consommation tokens par organisation et feature AI.
-- - ai_token_budgets : limites mensuelles par org/feature
-- - ai_token_usage   : logs d'utilisation par appel LLM
-- ============================================================================

-- ─── ai_token_budgets ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_token_budgets (
    id                  BIGSERIAL       PRIMARY KEY,
    organization_id     BIGINT          NOT NULL REFERENCES organizations(id),
    feature             VARCHAR(50)     NOT NULL,
    monthly_token_limit BIGINT          NOT NULL DEFAULT 100000,
    enabled             BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, feature)
);

CREATE INDEX idx_ai_token_budgets_org
    ON ai_token_budgets (organization_id);

-- ─── ai_token_usage ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_token_usage (
    id                  BIGSERIAL       PRIMARY KEY,
    organization_id     BIGINT          NOT NULL REFERENCES organizations(id),
    feature             VARCHAR(50)     NOT NULL,
    provider            VARCHAR(30)     NOT NULL,
    model               VARCHAR(100),
    prompt_tokens       INT             NOT NULL DEFAULT 0,
    completion_tokens   INT             NOT NULL DEFAULT 0,
    total_tokens        INT             NOT NULL DEFAULT 0,
    month_year          VARCHAR(7)      NOT NULL,  -- format: YYYY-MM
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_token_usage_org_feature_month
    ON ai_token_usage (organization_id, feature, month_year);

CREATE INDEX idx_ai_token_usage_org_month
    ON ai_token_usage (organization_id, month_year);

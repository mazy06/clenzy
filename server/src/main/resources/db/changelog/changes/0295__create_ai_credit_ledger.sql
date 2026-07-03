-- Campagne multi-agent (T-06, ADR-005/006) : facturation IA a l'usage en credits.
-- ai_credit_rate_card = table de conversion VERSIONNEE (append-only : on ferme une
--   version en posant effective_to, on n'UPDATE jamais un taux) — chaque debit du
--   ledger reference la version appliquee (audit + rejouabilite).
-- ai_usage_ledger = ledger APPEND-ONLY, source de verite temps reel de l'usage IA.
--   Porte a la fois le debit client (millicredits) et le cout provider reel
--   (micro-USD, cache deduit) → la marge du prompt caching se mesure ligne a
--   ligne SANS toucher le debit client (ADR-006 : caching garde en marge).
-- Les poches de credits (ai_credit_grant) et l'enforcement arrivent au ticket suivant.

CREATE TABLE ai_credit_rate_card (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    -- prefix-match du model id, meme convention que LlmPricingService (le plus long gagne)
    model_prefix VARCHAR(96) NOT NULL,
    token_type VARCHAR(16) NOT NULL,               -- INPUT | OUTPUT (pas de type CACHED cote client : ADR-006)
    provider_cost_micro_usd_per_1k INT NOT NULL,   -- cout provider plein tarif (audit marge)
    millicredits_per_1k INT NOT NULL,              -- taux client, markup inclus (1 credit = 1000 millicredits = 0,02 EUR)
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_to TIMESTAMPTZ,                      -- NULL = version courante
    created_by VARCHAR(64) NOT NULL
);

CREATE INDEX idx_rate_card_current ON ai_credit_rate_card (provider, token_type) WHERE effective_to IS NULL;

CREATE TABLE ai_usage_ledger (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    keycloak_user_id VARCHAR(64),
    run_id UUID,                                   -- = agent_run.id (0294) ; NULL pour l'usage hors run (transition)
    step_seq INT,
    agent VARCHAR(64) NOT NULL,                    -- mono | multi_agent | router | scan:<module> | embedding
    feature VARCHAR(32) NOT NULL,                  -- AiFeature (ASSISTANT_CHAT, EMBEDDINGS, ...)
    entry_type VARCHAR(16) NOT NULL,               -- DEBIT | GRANT | EXPIRY | ADJUSTMENT | REFUND
    autonomy_bucket VARCHAR(16) NOT NULL,          -- INTERACTIVE | SOCLE | PREMIUM_AUTO
    provider VARCHAR(32),
    model VARCHAR(96),
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    cached_prompt_tokens INT NOT NULL DEFAULT 0,
    input_rate_card_id BIGINT,                     -- versions de taux appliquees (audit)
    output_rate_card_id BIGINT,
    millicredits BIGINT NOT NULL,                  -- negatif = debit client
    provider_cost_micro_usd BIGINT NOT NULL DEFAULT 0,  -- cout reel → pilotage marge
    idempotency_key VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ai_usage_ledger_idem UNIQUE (idempotency_key)
);

CREATE INDEX idx_ai_usage_ledger_org_created ON ai_usage_ledger (organization_id, created_at DESC);
CREATE INDEX idx_ai_usage_ledger_run ON ai_usage_ledger (run_id) WHERE run_id IS NOT NULL;
CREATE INDEX idx_ai_usage_ledger_org_bucket ON ai_usage_ledger (organization_id, autonomy_bucket, created_at DESC);

-- ─── Seed de la grille initiale (campagne Phase 2 §2.2 : markup x5, 1 credit = 0,02 EUR) ───
-- Taux client = plein tarif input independamment du cache (ADR-006).
INSERT INTO ai_credit_rate_card (provider, model_prefix, token_type, provider_cost_micro_usd_per_1k, millicredits_per_1k, created_by) VALUES
    -- Anthropic
    ('anthropic', 'claude-haiku-4',    'INPUT',    800,   200, 'seed-0295'),
    ('anthropic', 'claude-haiku-4',    'OUTPUT',  4000,  1000, 'seed-0295'),
    ('anthropic', 'claude-3-5-haiku',  'INPUT',    800,   200, 'seed-0295'),
    ('anthropic', 'claude-3-5-haiku',  'OUTPUT',  4000,  1000, 'seed-0295'),
    ('anthropic', 'claude-sonnet-4',   'INPUT',   3000,   750, 'seed-0295'),
    ('anthropic', 'claude-sonnet-4',   'OUTPUT', 15000,  4000, 'seed-0295'),
    ('anthropic', 'claude-3-5-sonnet', 'INPUT',   3000,   750, 'seed-0295'),
    ('anthropic', 'claude-3-5-sonnet', 'OUTPUT', 15000,  4000, 'seed-0295'),
    ('anthropic', 'claude-opus-4',     'INPUT',  15000,  4000, 'seed-0295'),
    ('anthropic', 'claude-opus-4',     'OUTPUT', 75000, 20000, 'seed-0295'),
    -- OpenAI
    ('openai', 'gpt-5-mini',  'INPUT',    250,    65, 'seed-0295'),
    ('openai', 'gpt-5-mini',  'OUTPUT',  2000,   500, 'seed-0295'),
    ('openai', 'gpt-5',       'INPUT',   1250,   315, 'seed-0295'),
    ('openai', 'gpt-5',       'OUTPUT', 10000,  2500, 'seed-0295'),
    ('openai', 'gpt-4o-mini', 'INPUT',    150,    40, 'seed-0295'),
    ('openai', 'gpt-4o-mini', 'OUTPUT',   600,   150, 'seed-0295'),
    ('openai', 'gpt-4o',      'INPUT',   2500,   625, 'seed-0295'),
    ('openai', 'gpt-4o',      'OUTPUT', 10000,  2500, 'seed-0295'),
    ('openai', 'text-embedding-3-small', 'INPUT', 20, 5, 'seed-0295'),
    ('openai', 'text-embedding-3-small', 'OUTPUT', 0, 0, 'seed-0295'),
    -- Voyage (embeddings)
    ('voyage', 'voyage-3-lite',  'INPUT',  20,  5, 'seed-0295'),
    ('voyage', 'voyage-3-lite',  'OUTPUT',  0,  0, 'seed-0295'),
    ('voyage', 'voyage-3-large', 'INPUT', 180, 45, 'seed-0295'),
    ('voyage', 'voyage-3-large', 'OUTPUT',  0,  0, 'seed-0295');

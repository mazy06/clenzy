-- Campagne multi-agent (T-05, ADR-002/D-001) : etat de run persiste et rejouable.
-- agent_run = 1 ligne par run d'agent (chat, reprise HITL, batch...).
-- agent_step = 1 ligne par etape (appel LLM, outil, delegation, pause, resume, synthese).
-- Sert : replay/time-travel Constellation, Regles de Confiance (X2), et le futur
-- ledger de credits (T-06 : run_id/step_seq references par ai_usage_ledger).
-- Ecriture ASYNC best-effort hors chemin critique (AgentRunRecorder) — jamais bloquant.

CREATE TABLE agent_run (
    id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    keycloak_user_id VARCHAR(64),
    conversation_id BIGINT,
    origin VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    error TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_run_org_started ON agent_run (organization_id, started_at DESC);
CREATE INDEX idx_agent_run_conversation ON agent_run (conversation_id) WHERE conversation_id IS NOT NULL;

CREATE TABLE agent_step (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES agent_run (id) ON DELETE CASCADE,
    step_seq INT NOT NULL,
    kind VARCHAR(24) NOT NULL,
    agent VARCHAR(64) NOT NULL,
    tool_name VARCHAR(96),
    -- Resume court (<=512) : requete deleguee, raison d'erreur, outils executes.
    -- JAMAIS les arguments d'outils (PII) : ils restent dans l'audit masque.
    detail VARCHAR(512),
    status VARCHAR(16) NOT NULL,
    model VARCHAR(96),
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    cached_prompt_tokens INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_agent_step_run_seq UNIQUE (run_id, step_seq)
);

CREATE INDEX idx_agent_step_run ON agent_step (run_id, step_seq);

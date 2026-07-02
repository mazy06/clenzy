-- Campagne multi-agent (X1, ADR-002) : pending_action HITL durci.
-- Journal DURABLE de toutes les pauses de confirmation avec leur resolution :
--   1. reprise apres reboot pour le flux MONO (payload_history_json — images
--      strippees ; le multi-agent porte un etat moteur + JWT non serialisables,
--      son comportement volatil actuel est conserve) ;
--   2. affichage "en attente" resilient (fallback si l'index Redis est perdu) ;
--   3. donnee d'apprentissage des Regles de Confiance (X2) : couples
--      (tool, agent, contexte) → CONFIRMED / REFUSED / EXPIRED.

CREATE TABLE agent_pending_action (
    tool_call_id VARCHAR(96) PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    keycloak_user_id VARCHAR(64) NOT NULL,
    conversation_id BIGINT,
    tool_name VARCHAR(96) NOT NULL,
    -- Arguments COMPLETS : necessaires a l'execution en cas de reprise post-reboot.
    args_json TEXT,
    description VARCHAR(512),
    specialist VARCHAR(64),                    -- null = flux mono-agent
    multi_agent BOOLEAN NOT NULL DEFAULT false,
    -- Historique de reprise mono (JSON List<ChatMessage>, attachments strippes).
    -- NULL pour le multi-agent (etat moteur non serialisable → pas de reprise post-reboot).
    payload_history_json TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',  -- PENDING | CONFIRMED | REFUSED | EXPIRED
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_pending_user_status ON agent_pending_action (keycloak_user_id, status);
CREATE INDEX idx_agent_pending_expiry ON agent_pending_action (expires_at) WHERE status = 'PENDING';
-- Apprentissage X2 : historique des resolutions par org/outil.
CREATE INDEX idx_agent_pending_org_tool ON agent_pending_action (organization_id, tool_name, status);

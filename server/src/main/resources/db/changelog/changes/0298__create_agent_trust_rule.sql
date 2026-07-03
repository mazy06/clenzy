-- Campagne multi-agent (X2) : Regles de Confiance — l'autonomie qui s'apprend.
-- Une regle = un couple (org, outil) dont l'historique des pauses HITL
-- (agent_pending_action, X1) montre N confirmations consecutives sans refus.
-- Cycle : SUGGESTED (proposee par l'evaluateur, INERTE) → ACTIVE (acceptee
-- EXPLICITEMENT par un humain : l'outil s'execute alors sans pause, en mode
-- « notifier ») → REVOKED. Jamais de bascule silencieuse ; la regle est un
-- objet visible et revocable (signature feature Phase 6 n°2).
-- Les outils ARGENT (remboursement, reglement) sont exclus par blocklist code.

CREATE TABLE agent_trust_rule (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    tool_name VARCHAR(96) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'SUGGESTED',   -- SUGGESTED | ACTIVE | DISMISSED | REVOKED
    confirmations_seen INT NOT NULL,                   -- nb de confirmations au moment de la suggestion
    suggested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    decided_by VARCHAR(64),                            -- keycloakId de l'humain qui a tranche
    CONSTRAINT uq_agent_trust_rule_org_tool UNIQUE (organization_id, tool_name)
);

CREATE INDEX idx_agent_trust_rule_org_status ON agent_trust_rule (organization_id, status);

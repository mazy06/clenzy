-- Persistance de la conversation opérateur ↔ orchestrateur de la constellation (B7) :
-- chaque tour (operator/orchestrator) d'un échange de supervision, org + logement scopé,
-- pour l'historique/recherche (« qu'ai-je demandé hier ? »). Volatil auparavant (mémoire front).
CREATE TABLE IF NOT EXISTS supervision_conversation_message (
    id                BIGSERIAL PRIMARY KEY,
    organization_id   BIGINT       NOT NULL,
    property_id       BIGINT,
    keycloak_user_id  VARCHAR(255),
    role              VARCHAR(20)  NOT NULL,
    content           TEXT         NOT NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supervision_conv_org_prop_created
    ON supervision_conversation_message (organization_id, property_id, created_at);

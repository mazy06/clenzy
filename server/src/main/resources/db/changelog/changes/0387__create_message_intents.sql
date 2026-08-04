-- M8 (modèles métier constellation) : intentions détectées dans les messages ENTRANTS
-- des voyageurs. Une ligne par message classifié (dédup par message_id) — la brique
-- qui débloque les cartes LATE_CHECKOUT_APPROVAL / STAY_MODIFICATION et enrichit
-- CONVERSATION_TAKEOVER (réclamation à haute confiance). Best-effort : un message
-- sans intent (budget IA épuisé, échec LLM) reste un message normal.
CREATE TABLE IF NOT EXISTS message_intents (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    intent VARCHAR(40) NOT NULL,
    confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
    extracted JSONB,
    model VARCHAR(80),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Dédup stricte : un message n'est classifié qu'une fois.
CREATE UNIQUE INDEX IF NOT EXISTS uq_message_intents_message ON message_intents (message_id);
-- Parcours scanner : intents récents d'une org par type.
CREATE INDEX IF NOT EXISTS idx_message_intents_org_intent
    ON message_intents (organization_id, intent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_intents_org_conv
    ON message_intents (organization_id, conversation_id);

-- ============================================================================
-- 0137 : Tables pour l'assistant conversationnel multi-turn
-- ----------------------------------------------------------------------------
-- Contexte : ajout d'un AI Agent conversationnel (PMS assistant). Chaque user
-- peut avoir plusieurs conversations. Chaque conversation contient des messages
-- alternant user/assistant + retours d'outils (role=tool).
--
-- Multi-tenant : organization_id obligatoire, indexe — utilise par le filtre
-- Hibernate `organizationFilter` pour isoler les conversations entre orgs.
--
-- Securite : un user ne voit QUE ses propres conversations (filtre keycloak_id
-- au niveau service). Aucun cross-org leak possible meme en cas de bug applicatif
-- grace au filtre Hibernate.
--
-- Structure messages :
--   role IN ('user', 'assistant', 'tool')
--   content : texte (peut etre vide si role=assistant emet uniquement un tool_call)
--   tool_calls : JSONB array des tool_calls emis par l'assistant (id, name, args)
--   tool_call_id : reference au tool_call quand role=tool (resultat d'execution)
--
-- Index : (conversation_id, created_at) pour le scroll de l'historique.
-- ============================================================================

CREATE TABLE IF NOT EXISTS assistant_conversation (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    keycloak_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    model VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assistant_conv_org
    ON assistant_conversation (organization_id);

CREATE INDEX IF NOT EXISTS idx_assistant_conv_user_updated
    ON assistant_conversation (keycloak_id, updated_at DESC)
    WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS assistant_message (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES assistant_conversation(id) ON DELETE CASCADE,
    organization_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant','tool')),
    content TEXT,
    tool_calls JSONB,
    tool_call_id VARCHAR(120),
    prompt_tokens INT,
    completion_tokens INT,
    finish_reason VARCHAR(40),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assistant_msg_conv_created
    ON assistant_message (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_assistant_msg_org
    ON assistant_message (organization_id);

COMMENT ON TABLE assistant_conversation IS
    'Conversations de l''assistant AI conversationnel. Scope user (keycloak_id) + tenant (organization_id).';
COMMENT ON COLUMN assistant_conversation.title IS
    'Titre generere automatiquement a partir du premier message (max 255). Null jusqu''a la premiere reponse.';
COMMENT ON COLUMN assistant_conversation.model IS
    'Modele LLM utilise (ex: claude-sonnet-4-20250514). Sert au debug et au tracking d''usage.';

COMMENT ON TABLE assistant_message IS
    'Messages individuels d''une conversation assistant (multi-turn). Inclut les tool_calls et resultats d''outils.';
COMMENT ON COLUMN assistant_message.tool_calls IS
    'JSON array : [{"id":"toolu_xxx","name":"list_reservations","arguments":"{...}"}]. Non-null si role=assistant a emis un tool_call.';
COMMENT ON COLUMN assistant_message.tool_call_id IS
    'Reference au tool_call.id quand role=tool (resultat d''execution).';

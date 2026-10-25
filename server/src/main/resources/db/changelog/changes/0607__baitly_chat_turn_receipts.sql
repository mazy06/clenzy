-- Baitly: durable admission and completion metadata. No business payload or secrets.
-- Related names verified against AssistantConversation, AssistantMessage,
-- AgentPendingAction, AgentRun and their existing changesets.
CREATE TABLE baitly_chat_turns (
    id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    keycloak_user_id VARCHAR(255) NOT NULL,
    conversation_id BIGINT NOT NULL,
    request_id UUID NOT NULL,
    turn_sequence BIGINT NOT NULL CHECK (turn_sequence > 0),
    status VARCHAR(16) NOT NULL CHECK (status IN ('RUNNING','SAFE_TEXT','PAUSED','UNCERTAIN')),
    baseline_message_id BIGINT,
    end_message_id BIGINT,
    covered_message_count INTEGER NOT NULL DEFAULT 0 CHECK (covered_message_count >= 0),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (organization_id, keycloak_user_id, request_id),
    UNIQUE (organization_id, conversation_id, turn_sequence),
    CHECK ((status = 'RUNNING') = (finished_at IS NULL)),
    CHECK (status <> 'SAFE_TEXT' OR (end_message_id IS NOT NULL AND covered_message_count >= 2))
);
-- Ownership is validated while locking the existing conversation row. No FK that
-- changes legacy deletion semantics; a receipt can never grant access by itself.
CREATE INDEX baitly_chat_turns_scope_idx ON baitly_chat_turns
    (organization_id, conversation_id, turn_sequence DESC);

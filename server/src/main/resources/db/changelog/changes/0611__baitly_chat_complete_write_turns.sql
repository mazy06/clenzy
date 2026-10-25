CREATE TABLE baitly_chat_complete_write_turns (
    turn_id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    root_turn_id UUID NOT NULL,
    end_message_id BIGINT NOT NULL,
    covered_message_count INTEGER NOT NULL CHECK (covered_message_count >= 4),
    policy VARCHAR(32) NOT NULL CHECK (policy = 'write-turn-evidence-v1')
);
CREATE INDEX idx_baitly_chat_complete_write_scope
    ON baitly_chat_complete_write_turns (organization_id, conversation_id);

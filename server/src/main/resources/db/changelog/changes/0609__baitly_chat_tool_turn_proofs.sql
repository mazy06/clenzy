-- Baitly: versioned certificate, independent of the legacy fail-closed status.
CREATE TABLE baitly_chat_tool_turn_proofs (
    turn_id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    policy VARCHAR(32) NOT NULL CHECK (policy='durable-tools-v2'),
    end_message_id BIGINT NOT NULL,
    covered_message_count INTEGER NOT NULL CHECK (covered_message_count>=4)
);

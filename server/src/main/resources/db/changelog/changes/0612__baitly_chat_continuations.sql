CREATE TABLE baitly_chat_continuations (
    turn_id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    state VARCHAR(16) NOT NULL CHECK (state IN ('COMPLETE','PAUSED')),
    end_message_id BIGINT NOT NULL,
    covered_message_count INTEGER NOT NULL CHECK (covered_message_count >= 2)
);
CREATE TABLE baitly_chat_declined_results (
    id UUID PRIMARY KEY,
    turn_id UUID NOT NULL,
    organization_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    tool_call_id VARCHAR(96) NOT NULL,
    result_message_id BIGINT NOT NULL,
    UNIQUE (organization_id, conversation_id, tool_call_id)
);
CREATE TABLE baitly_chat_read_bindings (
    tool_evidence_id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    tool_name VARCHAR(96) NOT NULL
);

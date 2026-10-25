-- Baitly: invocation evidence contains references only, never arguments or results.
CREATE TABLE baitly_chat_tool_evidence (
    id UUID PRIMARY KEY,
    turn_id UUID NOT NULL,
    organization_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    tool_call_id VARCHAR(96) NOT NULL,
    proof_kind VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL,
    result_message_id BIGINT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_baitly_chat_tool_call UNIQUE (organization_id, conversation_id, tool_call_id),
    CONSTRAINT ck_baitly_chat_tool_kind CHECK (proof_kind IN ('NAVIGATION_ONLY_V1','TAX_READ_ONLY_V1','UNVERIFIED')),
    CONSTRAINT ck_baitly_chat_tool_status CHECK (status IN ('STARTED','READ_ONLY_COMPLETED','UNCERTAIN')),
    CONSTRAINT ck_baitly_chat_tool_finished CHECK ((status='STARTED' AND finished_at IS NULL)
        OR (status<>'STARTED' AND finished_at IS NOT NULL)),
    CONSTRAINT ck_baitly_chat_tool_result CHECK (status<>'READ_ONLY_COMPLETED'
        OR (result_message_id IS NOT NULL AND proof_kind<>'UNVERIFIED'))
);
CREATE INDEX idx_baitly_chat_tool_turn ON baitly_chat_tool_evidence (organization_id,turn_id);

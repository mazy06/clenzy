-- Baitly: committed internal effects only. No arguments, keys, values or results.
CREATE TABLE baitly_chat_write_business_proofs (
    id UUID PRIMARY KEY,
    tool_evidence_id UUID NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    proof_kind VARCHAR(32) NOT NULL,
    resource_id BIGINT NOT NULL CHECK (resource_id>0),
    target_state VARCHAR(32),
    committed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CHECK ((proof_kind='PROPERTY_STATUS_V1' AND target_state IS NOT NULL AND target_state IN ('ACTIVE','INACTIVE','UNDER_MAINTENANCE','ARCHIVED'))
        OR (proof_kind='MEMORY_DELETE_V1' AND target_state IS NULL))
);
CREATE INDEX idx_baitly_chat_write_scope ON baitly_chat_write_business_proofs (organization_id,conversation_id);

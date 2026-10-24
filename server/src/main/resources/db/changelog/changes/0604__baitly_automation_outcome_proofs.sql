-- Baitly JDBC-only receipt journal. Existing FK verified against AutomationExecution @Table.
-- No backfill: historical uncertainty cannot establish that an action returned successfully.
CREATE TABLE baitly_automation_outcome_proofs (
    execution_id BIGINT NOT NULL REFERENCES automation_executions(id),
    attempt_token UUID NOT NULL,
    organization_id BIGINT NOT NULL,
    automation_rule_id BIGINT NOT NULL,
    subject_type VARCHAR(30) NOT NULL,
    subject_id BIGINT NOT NULL,
    rule_revision TIMESTAMP,
    attempted_at TIMESTAMP NOT NULL,
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('EXECUTED','SKIPPED')),
    effect_ref_id BIGINT CHECK (effect_ref_id > 0),
    observed_at TIMESTAMP NOT NULL,
    disputed BOOLEAN NOT NULL DEFAULT FALSE,
    applied_at TIMESTAMP,
    apply_mode VARCHAR(20) CHECK (apply_mode IN ('NORMAL','RECOVERY')),
    PRIMARY KEY (execution_id, attempt_token),
    UNIQUE (execution_id),
    CHECK (observed_at >= attempted_at),
    CHECK (outcome <> 'SKIPPED' OR effect_ref_id IS NULL),
    CHECK ((applied_at IS NULL AND apply_mode IS NULL) OR (applied_at IS NOT NULL AND apply_mode IS NOT NULL))
);
CREATE INDEX idx_baitly_automation_unapplied_proof ON baitly_automation_outcome_proofs
    (applied_at, disputed, observed_at, execution_id);

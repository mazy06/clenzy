-- Baitly: names verified against AutomationExecution, AutomationRule and migration 0305.
ALTER TABLE automation_executions ADD COLUMN durable_state VARCHAR(20);
ALTER TABLE automation_executions ADD COLUMN durable_context TEXT;
ALTER TABLE automation_executions ADD COLUMN durable_key VARCHAR(160);
ALTER TABLE automation_executions ADD COLUMN rule_revision TIMESTAMP;
ALTER TABLE automation_executions ADD COLUMN durable_expires_at TIMESTAMP;
ALTER TABLE automation_executions ADD COLUMN attempt_token UUID;
ALTER TABLE automation_executions ADD COLUMN attempted_at TIMESTAMP;
CREATE UNIQUE INDEX uq_baitly_automation_durable_key ON automation_executions(durable_key);
CREATE INDEX idx_baitly_automation_due ON automation_executions(durable_state,status,scheduled_at,id);
CREATE INDEX idx_baitly_automation_uncertain ON automation_executions
    (automation_rule_id,organization_id,subject_type,subject_id,durable_state);

-- Legacy pending rows cannot establish whether an external effect already happened.
UPDATE automation_executions SET status='FAILED',error_message='AUTOMATION_LEGACY_REVIEW'
    WHERE status='PENDING' AND durable_state IS NULL;

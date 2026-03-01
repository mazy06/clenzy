-- V64 : Automation rules for sequential messaging

CREATE TABLE automation_rules (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    trigger_type    VARCHAR(40) NOT NULL,
    trigger_offset_days INT NOT NULL DEFAULT 0,
    trigger_time    VARCHAR(5) DEFAULT '09:00',
    conditions      JSONB,
    action_type     VARCHAR(30) NOT NULL DEFAULT 'SEND_MESSAGE',
    template_id     BIGINT,
    delivery_channel VARCHAR(20) DEFAULT 'EMAIL',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ar_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_ar_template FOREIGN KEY (template_id) REFERENCES message_templates(id),
    CONSTRAINT chk_ar_trigger CHECK (trigger_type IN ('RESERVATION_CONFIRMED','CHECK_IN_APPROACHING','CHECK_IN_DAY','CHECK_OUT_DAY','CHECK_OUT_PASSED','REVIEW_REMINDER')),
    CONSTRAINT chk_ar_action CHECK (action_type IN ('SEND_MESSAGE','SEND_CHECKIN_LINK','SEND_GUIDE'))
);

CREATE INDEX idx_ar_org ON automation_rules(organization_id);
CREATE INDEX idx_ar_enabled ON automation_rules(organization_id, enabled);

CREATE TABLE automation_executions (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL,
    automation_rule_id  BIGINT NOT NULL,
    reservation_id      BIGINT NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message       TEXT,
    scheduled_at        TIMESTAMP NOT NULL,
    executed_at         TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ae_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_ae_rule FOREIGN KEY (automation_rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
    CONSTRAINT fk_ae_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id),
    CONSTRAINT chk_ae_status CHECK (status IN ('PENDING','EXECUTED','SKIPPED','FAILED'))
);

CREATE INDEX idx_ae_org ON automation_executions(organization_id);
CREATE INDEX idx_ae_rule ON automation_executions(automation_rule_id);
CREATE INDEX idx_ae_status ON automation_executions(status, scheduled_at);
CREATE UNIQUE INDEX idx_ae_unique ON automation_executions(automation_rule_id, reservation_id);

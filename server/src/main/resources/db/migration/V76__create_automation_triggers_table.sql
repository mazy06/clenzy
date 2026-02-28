-- V76: Zapier/Make Automation Triggers

CREATE TABLE IF NOT EXISTS automation_triggers (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT       NOT NULL REFERENCES organizations(id),
    trigger_name        VARCHAR(100) NOT NULL,
    platform            VARCHAR(20)  NOT NULL,
    trigger_event       VARCHAR(40)  NOT NULL,
    callback_url        VARCHAR(500) NOT NULL,
    is_active           BOOLEAN      DEFAULT true,
    last_triggered_at   TIMESTAMP WITH TIME ZONE,
    trigger_count       BIGINT       DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_automation_triggers_org ON automation_triggers(organization_id);
CREATE INDEX idx_automation_triggers_event ON automation_triggers(trigger_event);
CREATE INDEX idx_automation_triggers_active ON automation_triggers(is_active) WHERE is_active = true;

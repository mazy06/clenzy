-- liquibase formatted sql
-- changeset clenzy-team:0104-add-admin-to-audit-log-source-check

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_source_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_source_check
    CHECK (source IN ('WEB', 'API', 'AIRBNB_SYNC', 'SYSTEM', 'WEBHOOK', 'CRON', 'ADMIN'));

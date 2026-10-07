-- Baitly: cutover plan for leaving a previous PMS. One plan per importing user and organisation.
CREATE TABLE pms_migration_plans (
    id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    created_by VARCHAR(255) NOT NULL,
    source_pms VARCHAR(80),
    contract_end_date DATE,
    notice_days INTEGER CHECK (notice_days IS NULL OR (notice_days >= 0 AND notice_days <= 730)),
    checklist TEXT NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_pms_migration_plan UNIQUE (organization_id, created_by)
);
ALTER TABLE pms_migration_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_migration_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pms_migration_plans
    USING (current_setting('app.bypass_rls', true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint)
    WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint);

-- V78: PMS-to-PMS Migration Jobs

CREATE TABLE IF NOT EXISTS migration_jobs (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT       NOT NULL REFERENCES organizations(id),
    source              VARCHAR(30)  NOT NULL,
    status              VARCHAR(30)  NOT NULL DEFAULT 'PENDING',
    data_type           VARCHAR(20)  NOT NULL DEFAULT 'ALL',
    total_records       INTEGER      DEFAULT 0,
    processed_records   INTEGER      DEFAULT 0,
    failed_records      INTEGER      DEFAULT 0,
    error_log           TEXT,
    source_api_key      VARCHAR(500),
    source_config       JSONB,
    started_at          TIMESTAMP WITH TIME ZONE,
    completed_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_migration_jobs_org ON migration_jobs(organization_id);
CREATE INDEX idx_migration_jobs_status ON migration_jobs(status);

-- Existing JPA tables: organizations and prospects (@Table); composite identity from 0568.
CREATE TABLE baitly_crm_enrichment_runs (
    id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    created_by VARCHAR(255) NOT NULL,
    location_only BOOLEAN NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING' CHECK(status IN ('RUNNING','COMPLETED','CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id,id)
);
CREATE UNIQUE INDEX baitly_crm_enrichment_active ON baitly_crm_enrichment_runs(organization_id,created_by) WHERE status='RUNNING';
CREATE INDEX baitly_crm_enrichment_latest ON baitly_crm_enrichment_runs(organization_id,created_by,created_at DESC);
CREATE TABLE baitly_crm_enrichment_items (
    organization_id BIGINT NOT NULL,
    run_id UUID NOT NULL,
    prospect_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK(status IN ('QUEUED','PROCESSING','CONFIRMED','REVIEW','SKIPPED','NEEDS_DATA','FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    lease UUID,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(run_id,prospect_id),
    FOREIGN KEY(organization_id,run_id) REFERENCES baitly_crm_enrichment_runs(organization_id,id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id,prospect_id) REFERENCES prospects(organization_id,id) ON DELETE CASCADE
);
CREATE INDEX baitly_crm_enrichment_queue ON baitly_crm_enrichment_items(available_at) WHERE status IN ('QUEUED','PROCESSING');

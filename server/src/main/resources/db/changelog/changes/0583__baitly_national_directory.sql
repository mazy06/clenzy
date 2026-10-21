-- Shared Sirene source only. Organization CRM copies and contact permissions are unchanged.
-- Exact existing table: 0577__baitly_professional_directory.sql (JDBC-managed).
ALTER TABLE baitly_directory_professionals ADD COLUMN source_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE baitly_directory_professionals ADD COLUMN national_revision UUID;
CREATE INDEX idx_baitly_directory_activity ON baitly_directory_professionals(activity,postal_code,id)
    WHERE suppressed=false AND source_active=true;
CREATE TABLE baitly_directory_sync (
    id BOOLEAN PRIMARY KEY DEFAULT true CHECK(id),
    revision UUID NOT NULL,
    establishments_url TEXT NOT NULL,
    units_url TEXT NOT NULL,
    establishments_etag VARCHAR(255),
    units_etag VARCHAR(255),
    phase VARCHAR(20) NOT NULL CHECK(phase IN ('ESTABLISHMENTS','UNITS','PUBLISH','COMPLETED')),
    cursor BIGINT NOT NULL DEFAULT 0,
    scanned BIGINT NOT NULL DEFAULT 0,
    selected BIGINT NOT NULL DEFAULT 0,
    published BIGINT NOT NULL DEFAULT 0,
    failures INTEGER NOT NULL DEFAULT 0,
    retry_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
-- Bounded streaming batches, never retain the complete Sirene file in memory or on disk.
CREATE TABLE baitly_directory_sync_stage (
    siret VARCHAR(14) PRIMARY KEY CHECK(siret ~ '^[0-9]{14}$'),
    siren VARCHAR(9) NOT NULL,
    trade_name VARCHAR(200),
    legal_name VARCHAR(200),
    legal_public BOOLEAN NOT NULL DEFAULT false,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(120) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    activity VARCHAR(10) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION
);
CREATE INDEX idx_baitly_directory_sync_siren ON baitly_directory_sync_stage(siren);

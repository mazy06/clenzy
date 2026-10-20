-- JDBC table names and source CHECK verified against changeset 0577 and BaitlyProfessionalDirectory.
-- Keep ADEME values separate from OSM/manual choices and organization-owned CRM data.
ALTER TABLE baitly_directory_professionals
    ADD COLUMN rge_phone varchar(80),
    ADD COLUMN rge_email varchar(254),
    ADD COLUMN rge_website varchar(500),
    ADD COLUMN rge_retrieved_at timestamptz;
ALTER TABLE baitly_directory_source_evidence DROP CONSTRAINT baitly_directory_source_evidence_source_check;
ALTER TABLE baitly_directory_source_evidence ADD CONSTRAINT baitly_directory_source_evidence_source_check
    CHECK(source IN ('SIRENE','OSM','ADEME'));
CREATE INDEX idx_baitly_directory_ademe_evidence ON baitly_directory_source_evidence(professional_id,id DESC)
    WHERE source='ADEME';
CREATE TABLE baitly_directory_rge_sync (
    id boolean PRIMARY KEY DEFAULT true CHECK(id),
    source_version varchar(100),
    applied_at timestamptz,
    next_check timestamptz NOT NULL DEFAULT now(),
    matched bigint NOT NULL DEFAULT 0,
    retired bigint NOT NULL DEFAULT 0
);

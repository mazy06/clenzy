-- Shared JDBC tables verified against 0577, 0589 and 0594; no tenant CRM changes.
ALTER TABLE baitly_directory_professionals ADD COLUMN website_services JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK(jsonb_typeof(website_services)='array');
ALTER TABLE baitly_directory_source_evidence DROP CONSTRAINT baitly_directory_source_evidence_source_check;
ALTER TABLE baitly_directory_source_evidence ADD CONSTRAINT baitly_directory_source_evidence_source_check
    CHECK(source IN ('SIRENE','OSM','ADEME','OMPIC','WATHQ','SPL','OVERTURE','WEBSITE'));

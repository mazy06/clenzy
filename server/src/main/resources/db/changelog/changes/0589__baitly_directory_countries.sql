-- JDBC tables verified against 0577/0578/0583. Preserve all existing French identifiers.
ALTER TABLE baitly_directory_professionals
    ADD COLUMN country_code VARCHAR(2) NOT NULL DEFAULT 'FR' CHECK(country_code IN ('FR','MA','SA')),
    ADD COLUMN identifier_type VARCHAR(12) NOT NULL DEFAULT 'SIRET',
    ADD COLUMN identifier VARCHAR(80),
    ADD COLUMN identifiers JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN service VARCHAR(30),
    ADD COLUMN base_source VARCHAR(10) NOT NULL DEFAULT 'SIRENE',
    ADD COLUMN source_url VARCHAR(500),
    ADD COLUMN source_licence VARCHAR(80);
UPDATE baitly_directory_professionals SET identifier=siret;
ALTER TABLE baitly_directory_professionals ALTER COLUMN siret DROP NOT NULL;
ALTER TABLE baitly_directory_professionals ALTER COLUMN identifier SET NOT NULL;
ALTER TABLE baitly_directory_professionals ADD CONSTRAINT baitly_directory_country_identity
    CHECK((country_code='FR' AND identifier_type='SIRET' AND siret=identifier AND siret IS NOT NULL)
       OR (country_code='MA' AND siret IS NULL AND identifier_type IN ('ICE','RC') AND base_source='OMPIC')
       OR (country_code='SA' AND siret IS NULL AND identifier_type IN ('UNN','CR') AND base_source='WATHQ'));
CREATE UNIQUE INDEX idx_baitly_directory_identity ON baitly_directory_professionals(country_code,identifier_type,identifier);
-- Conflicting alternate identifiers stop publication for review instead of duplicating an entity.
CREATE UNIQUE INDEX idx_baitly_directory_ma_ice ON baitly_directory_professionals((identifiers->>'ICE'))
    WHERE country_code='MA' AND (identifiers->>'ICE') IS NOT NULL;
CREATE UNIQUE INDEX idx_baitly_directory_ma_rc ON baitly_directory_professionals((identifiers->>'RC'))
    WHERE country_code='MA' AND (identifiers->>'RC') IS NOT NULL;
CREATE UNIQUE INDEX idx_baitly_directory_sa_unn ON baitly_directory_professionals((identifiers->>'UNN'))
    WHERE country_code='SA' AND (identifiers->>'UNN') IS NOT NULL;
CREATE UNIQUE INDEX idx_baitly_directory_sa_cr ON baitly_directory_professionals((identifiers->>'CR'))
    WHERE country_code='SA' AND (identifiers->>'CR') IS NOT NULL;
CREATE INDEX idx_baitly_directory_country_service ON baitly_directory_professionals(country_code,service,id)
    WHERE NOT suppressed AND source_active;
CREATE FUNCTION baitly_directory_french_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.country_code='FR' THEN NEW.identifier_type='SIRET'; NEW.identifier=NEW.siret; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER baitly_directory_french_identity BEFORE INSERT OR UPDATE ON baitly_directory_professionals
    FOR EACH ROW EXECUTE FUNCTION baitly_directory_french_identity();
ALTER TABLE baitly_directory_source_evidence DROP CONSTRAINT baitly_directory_source_evidence_source_check;
ALTER TABLE baitly_directory_source_evidence ADD CHECK(source IN ('SIRENE','OSM','ADEME','OMPIC','WATHQ','SPL'));
ALTER TABLE baitly_directory_sync ADD COLUMN country_code VARCHAR(2) NOT NULL DEFAULT 'FR' CHECK(country_code IN ('FR','MA','SA'));
ALTER TABLE baitly_directory_sync DROP CONSTRAINT baitly_directory_sync_pkey;
ALTER TABLE baitly_directory_sync ADD PRIMARY KEY(country_code);
ALTER TABLE baitly_directory_sync ADD COLUMN source_manifest JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE baitly_directory_sync ADD COLUMN source_error VARCHAR(40);
ALTER TABLE baitly_directory_sync_stage ADD COLUMN country_code VARCHAR(2) NOT NULL DEFAULT 'FR';
ALTER TABLE baitly_directory_sync_stage ADD COLUMN identifier_type VARCHAR(12) NOT NULL DEFAULT 'SIRET';
ALTER TABLE baitly_directory_sync_stage ADD COLUMN identifier VARCHAR(80);
ALTER TABLE baitly_directory_sync_stage ADD COLUMN payload JSONB;
ALTER TABLE baitly_directory_sync_stage DROP CONSTRAINT baitly_directory_sync_stage_pkey;
ALTER TABLE baitly_directory_sync_stage ALTER COLUMN siret DROP NOT NULL;
ALTER TABLE baitly_directory_sync_stage ALTER COLUMN siren DROP NOT NULL;
ALTER TABLE baitly_directory_sync_stage ADD UNIQUE(siret);
ALTER TABLE baitly_directory_sync_stage ADD UNIQUE(country_code,identifier_type,identifier);

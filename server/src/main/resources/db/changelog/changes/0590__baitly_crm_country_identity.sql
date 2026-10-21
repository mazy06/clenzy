ALTER TABLE baitly_crm_professional_imports ADD COLUMN country_code VARCHAR(2) NOT NULL DEFAULT 'FR';
ALTER TABLE baitly_crm_professional_imports ADD COLUMN identifier_type VARCHAR(12) NOT NULL DEFAULT 'SIRET';
ALTER TABLE baitly_crm_professional_imports ADD COLUMN identifier VARCHAR(80);
UPDATE baitly_crm_professional_imports SET identifier=siret;
ALTER TABLE baitly_crm_professional_imports DROP CONSTRAINT baitly_crm_professional_imports_pkey;
ALTER TABLE baitly_crm_professional_imports ALTER COLUMN siret DROP NOT NULL;
ALTER TABLE baitly_crm_professional_imports ALTER COLUMN identifier SET NOT NULL;
ALTER TABLE baitly_crm_professional_imports ADD PRIMARY KEY(organization_id,country_code,identifier_type,identifier);
CREATE UNIQUE INDEX idx_baitly_crm_import_siret ON baitly_crm_professional_imports(organization_id,siret);
CREATE TRIGGER baitly_crm_french_identity BEFORE INSERT OR UPDATE ON baitly_crm_professional_imports
    FOR EACH ROW EXECUTE FUNCTION baitly_directory_french_identity();

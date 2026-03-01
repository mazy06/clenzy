-- V85: Backfill fiscal_profiles for all existing organizations
-- All existing tenants are assumed to be French (FR/EUR)

INSERT INTO fiscal_profiles (organization_id, country_code, default_currency, fiscal_regime, vat_registered, invoice_language, invoice_prefix)
SELECT id, 'FR', 'EUR', 'STANDARD', TRUE, 'fr', 'FA-'
FROM organizations
WHERE id NOT IN (SELECT organization_id FROM fiscal_profiles);

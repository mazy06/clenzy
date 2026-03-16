-- 0087: Add SEPA debtor fields to organizations for pain.001 XML generation
-- These fields store the organization's own bank details (debtor side of SEPA transfers)

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sepa_debtor_name VARCHAR(70);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sepa_debtor_iban VARCHAR(512);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sepa_debtor_bic VARCHAR(20);

-- Baitly : noms vérifiés dans ActivityCommission et le changeset 0203.
-- Les anciennes lignes PAID et leurs écritures ne sont pas requalifiées en preuve bancaire.
ALTER TABLE activity_commissions ADD COLUMN IF NOT EXISTS property_id BIGINT;
ALTER TABLE activity_commissions ADD COLUMN IF NOT EXISTS beneficiary_owner_id BIGINT;
ALTER TABLE activity_commissions ADD COLUMN IF NOT EXISTS receipt_reference VARCHAR(255);
ALTER TABLE activity_commissions ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;
ALTER TABLE activity_commissions ADD COLUMN IF NOT EXISTS recorded_by VARCHAR(255);

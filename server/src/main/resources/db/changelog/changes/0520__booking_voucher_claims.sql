-- Conserver les anciens usages consommés : aucune remise historique n'est libérée sans preuve.
ALTER TABLE voucher_usage ADD COLUMN IF NOT EXISTS claim_status VARCHAR(16) NOT NULL DEFAULT 'CONSUMED';
ALTER TABLE voucher_usage ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_voucher_usage_active_guest ON voucher_usage(voucher_id, lower(trim(guest_email)))
    WHERE claim_status <> 'RELEASED';

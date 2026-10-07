ALTER TABLE guest_credit_transactions ADD COLUMN IF NOT EXISTS source_credit_id BIGINT REFERENCES guest_credit_transactions(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_guest_credit_tx_org ON guest_credit_transactions(id,organization_id);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_guest_credit_source_org' AND conrelid='guest_credit_transactions'::regclass) THEN
        ALTER TABLE guest_credit_transactions ADD CONSTRAINT fk_guest_credit_source_org FOREIGN KEY(source_credit_id,organization_id)
            REFERENCES guest_credit_transactions(id,organization_id);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_guest_credit_reversal_source ON guest_credit_transactions(organization_id,source_credit_id)
    WHERE source_credit_id IS NOT NULL;

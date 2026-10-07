ALTER TABLE invoices ADD COLUMN IF NOT EXISTS owner_refund_transaction_id BIGINT REFERENCES payment_transactions(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_refund_credit_note ON invoices(original_invoice_id,owner_refund_transaction_id)
    WHERE owner_refund_transaction_id IS NOT NULL;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_owner_refund_credit_note' AND conrelid='invoices'::regclass) THEN
        ALTER TABLE invoices ADD CONSTRAINT ck_owner_refund_credit_note CHECK(owner_refund_transaction_id IS NULL
            OR (original_invoice_id IS NOT NULL AND refund_transaction_id IS NULL AND invoice_type='COMMISSION' AND status='CREDIT_NOTE' AND total_ttc<0));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_owner_refund_note_org' AND conrelid='invoices'::regclass) THEN
        ALTER TABLE invoices ADD CONSTRAINT fk_owner_refund_note_org FOREIGN KEY(owner_refund_transaction_id,organization_id) REFERENCES payment_transactions(id,organization_id);
    END IF;
END $$;

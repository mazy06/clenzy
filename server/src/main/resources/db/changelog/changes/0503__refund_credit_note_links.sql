-- Baitly : liens documentaires, sans réécrire les anciennes factures ni inventer d'avoir.
-- Tables et colonnes vérifiées contre Invoice, PaymentTransaction et les migrations 0000/0502.
ALTER TABLE invoices ADD COLUMN original_invoice_id bigint;
ALTER TABLE invoices ADD COLUMN refund_transaction_id bigint;
ALTER TABLE invoices ADD CONSTRAINT uq_invoice_id_org UNIQUE (id, organization_id);
ALTER TABLE invoices ADD CONSTRAINT fk_credit_note_original_org
    FOREIGN KEY (original_invoice_id, organization_id) REFERENCES invoices (id, organization_id);
ALTER TABLE invoices ADD CONSTRAINT fk_credit_note_refund_org
    FOREIGN KEY (refund_transaction_id, organization_id) REFERENCES payment_transactions (id, organization_id);
ALTER TABLE invoices ADD CONSTRAINT uq_credit_note_refund UNIQUE (refund_transaction_id);
ALTER TABLE invoices ADD CONSTRAINT ck_credit_note_links CHECK (
    (original_invoice_id IS NULL AND refund_transaction_id IS NULL)
    OR (original_invoice_id IS NOT NULL AND original_invoice_id <> id
        AND status = 'CREDIT_NOTE' AND total_ttc <= 0 AND duplicate_of_id IS NULL
        AND (refund_transaction_id IS NULL OR total_ttc < 0)));
CREATE INDEX idx_credit_note_original ON invoices (organization_id, original_invoice_id)
    WHERE original_invoice_id IS NOT NULL;

-- V94: Invoice Payment Enhancements for B2B
-- Add payment tracking columns and new statuses

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_transaction_id BIGINT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_invoice_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_tx ON invoices(payment_transaction_id);

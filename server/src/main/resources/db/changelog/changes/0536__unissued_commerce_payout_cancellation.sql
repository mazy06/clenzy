ALTER TABLE baitly_commerce_payouts ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE baitly_commerce_payouts ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(255);

-- V95: Add payment_status and paid_at to reservations for Facturation integration
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

-- Mark existing reservations that already have a Stripe session as PROCESSING
UPDATE reservations SET payment_status = 'PROCESSING'
  WHERE stripe_session_id IS NOT NULL AND payment_status = 'PENDING';

-- V92: Add payment link tracking fields to reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMP;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_link_email VARCHAR(255);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255);

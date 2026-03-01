-- V84: Add currency column to financial entities
-- All existing data defaults to EUR (France)

ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS room_revenue DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS cleaning_fee DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS tourist_tax_amount DECIMAL(10,2);

ALTER TABLE interventions
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'EUR';

ALTER TABLE owner_payouts
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'EUR';

ALTER TABLE rate_overrides
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'EUR';

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) NOT NULL DEFAULT 'EUR';

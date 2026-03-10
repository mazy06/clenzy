-- V99: Add per-seat pricing fields to pricing_configs
-- Allows dynamic billing based on number of organization members

ALTER TABLE pricing_configs
    ADD COLUMN pms_per_seat_price_cents INTEGER DEFAULT 1000,
    ADD COLUMN pms_free_seats INTEGER DEFAULT 1;

COMMENT ON COLUMN pricing_configs.pms_per_seat_price_cents IS 'Price in cents per additional seat per month (default 10 EUR)';
COMMENT ON COLUMN pricing_configs.pms_free_seats IS 'Number of seats included in the base price (default 1 = owner)';

-- ============================================================
-- V103 : Fix booking_engine_visible — set NOT NULL + default
-- Existing rows may have NULL because V102 did not enforce NOT NULL.
-- ============================================================

UPDATE properties SET booking_engine_visible = false WHERE booking_engine_visible IS NULL;
ALTER TABLE properties ALTER COLUMN booking_engine_visible SET NOT NULL;
ALTER TABLE properties ALTER COLUMN booking_engine_visible SET DEFAULT false;

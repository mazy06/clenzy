-- 0069 : Fix booking_engine_visible — set NOT NULL + default
-- Les lignes existantes peuvent avoir NULL car 0068 n'imposait pas NOT NULL.

UPDATE properties SET booking_engine_visible = false WHERE booking_engine_visible IS NULL;
ALTER TABLE properties ALTER COLUMN booking_engine_visible SET NOT NULL;
ALTER TABLE properties ALTER COLUMN booking_engine_visible SET DEFAULT false;

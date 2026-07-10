-- Phase C Channex — Booking CRS : les reservations DIRECTES Baitly poussees
-- vers Channex (POST /bookings, ota_name "Offline") recoivent un id Channex.
-- On le stocke pour pouvoir modifier/annuler le booking cote Channex ensuite
-- (PUT /bookings/:id) — sans lui, un push serait a sens unique.
-- NULL = reservation jamais poussee au CRS (cas normal par defaut).
ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS channex_crs_booking_id VARCHAR(64);

COMMENT ON COLUMN reservations.channex_crs_booking_id IS
    'Id booking Channex si la resa directe a ete poussee via le Booking CRS (ota Offline)';

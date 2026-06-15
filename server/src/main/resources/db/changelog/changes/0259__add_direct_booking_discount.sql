-- Book Direct & Save (2.8) : remise « réservation directe » appliquée au sous-total des quotes
-- du booking engine (le tarif direct devient le tarif facturé ; l'économie est affichée au voyageur).
-- NULL/0 = aucune remise (comportement actuel préservé).

ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS direct_booking_discount_percent INTEGER;

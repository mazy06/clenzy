-- Book Direct & Save (2.8, phase 2) : tarif membre — remise pour un voyageur CONNECTÉ (compte guest).
-- Le membre obtient max(remise réservation directe, remise membre) → jamais moins bien que le public.
-- NULL/0 = pas de tarif membre (comportement actuel préservé).
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS member_discount_percent INTEGER;

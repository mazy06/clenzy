-- Bibliothèque de parcours de réservation custom (« funnels ») éditée dans le Studio (JSON).
-- Opt-in, NULL par défaut (= seuls les presets intégrés du front sont proposés).
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS funnel_presets TEXT;

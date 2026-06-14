-- Baitly Studio : persistance de la page composée par blocs (builder F2).
-- page_layout = layout JSON (liste ordonnée de blocs {type, props}) édité dans le Studio.
-- NULL = jamais composée (le builder propose une page de démarrage).

ALTER TABLE booking_engine_config ADD COLUMN IF NOT EXISTS page_layout TEXT;

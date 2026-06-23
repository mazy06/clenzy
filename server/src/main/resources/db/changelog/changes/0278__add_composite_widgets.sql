-- Bibliothèque de widgets composites custom (ex. barre de recherche) éditée dans le Studio (JSON).
-- Opt-in, NULL par défaut (= seuls les composites intégrés du front sont proposés).
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS composite_widgets TEXT;

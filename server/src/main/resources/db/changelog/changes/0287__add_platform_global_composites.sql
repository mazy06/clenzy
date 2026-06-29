-- Bibliothèque GLOBALE de widgets composites du booking engine (niveau plateforme).
-- Alimentée par les SUPER_ADMIN / SUPER_MANAGER, visible (lecture) dans le Studio de TOUS les
-- booking engines, en plus des composites propres à chaque engine. JSON sérialisé (même format
-- que booking_engine_configs.composite_widgets). NULL = aucune.
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS global_composite_widgets TEXT;

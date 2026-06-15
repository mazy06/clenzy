-- Booking engine — propriétés affichées (curation par booking engine).
-- featured_property_ids = IDs de propriétés en CSV ("12,7,3") sélectionnés dans le Studio.
-- NULL ou vide = toutes les propriétés visibles du booking engine (comportement par défaut préservé).

ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS featured_property_ids TEXT;

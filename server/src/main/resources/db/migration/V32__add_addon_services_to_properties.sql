-- V32 : Prestations à la carte pour estimation dynamique de la durée de ménage

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS window_count          INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS french_door_count     INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sliding_door_count    INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS has_ironing           BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_deep_kitchen      BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_disinfection      BOOLEAN NOT NULL DEFAULT FALSE;

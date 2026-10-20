-- Parcours Baitly : la table est celle de WelcomeGuide (@Table welcome_guides), créée en 0195.
ALTER TABLE welcome_guides ADD COLUMN structure VARCHAR(24) NOT NULL DEFAULT 'complet';
ALTER TABLE welcome_guides ADD CONSTRAINT welcome_guides_structure_check
    CHECK (structure IN ('essentiel', 'complet', 'cityguide', 'longue', 'conciergerie'));

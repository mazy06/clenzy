-- Horodatage de rejet d'une suggestion de supervision : alimente le cooldown
-- anti-re-suggestion (une carte « Ignorée » ne réapparaît pas au scan suivant
-- avant expiration du cooldown).
ALTER TABLE supervision_suggestion
    ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP;

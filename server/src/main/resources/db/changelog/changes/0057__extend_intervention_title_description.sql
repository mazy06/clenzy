-- 0057 : Extend intervention title (100 → 255) and description (varchar 500 → TEXT with CHECK)
-- Fix: "value too long for type character varying(500)" when creating intervention from service request

ALTER TABLE interventions ALTER COLUMN title TYPE VARCHAR(255);
ALTER TABLE interventions ALTER COLUMN description TYPE TEXT;

-- Ajouter un CHECK constraint pour limiter la description à 500 caractères (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_intervention_description_length'
    ) THEN
        ALTER TABLE interventions ADD CONSTRAINT chk_intervention_description_length CHECK (length(description) <= 500);
    END IF;
END $$;

-- Ajouter un CHECK constraint pour limiter le titre à 255 caractères (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_intervention_title_length'
    ) THEN
        ALTER TABLE interventions ADD CONSTRAINT chk_intervention_title_length CHECK (length(title) <= 255);
    END IF;
END $$;

-- Codes d'accès additionnels libres (résidence, immeuble, parking…) par logement.
-- JSON : [{"label": "Parking", "code": "9012"}, ...]. Chaque code génère un tag email {code_<slug>}.
ALTER TABLE check_in_instructions
    ADD COLUMN IF NOT EXISTS extra_access_codes JSONB NOT NULL DEFAULT '[]';
